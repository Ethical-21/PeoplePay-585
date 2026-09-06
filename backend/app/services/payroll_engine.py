"""
PeoplePay585 — Payroll Calculation Engine

★ THE CORE BUSINESS LOGIC MODULE ★

This engine processes salary rules in sequence order to compute payslips.
It supports three calculation types:
  - fixed: Returns a fixed amount
  - percentage: Computes a percentage of another rule's result
  - formula: Evaluates a safe arithmetic expression

Security: Uses AST-based safe evaluation — NO eval() of raw strings.
"""

import ast
import operator
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass, field
from datetime import timedelta, date, datetime

from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee, EmployeeStatus
from app.models.contract import Contract, ContractStatus
from app.models.attendance import Attendance
from app.models.salary import SalaryStructure, SalaryRule, RuleCategory, CalculationType
from app.models.payroll import (
    Payrun, PayrunEmployee, Payslip, PayslipLine,
    PayrunStatus, PayslipStatus,
)


# ── Safe Expression Evaluator ──

# Allowed operators for formula evaluation
SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def safe_eval(expression: str, context: dict[str, float]) -> float:
    """
    Safely evaluate an arithmetic expression with variable substitution.
    
    Supports: +, -, *, /, parentheses, numbers, and variable names from context.
    Does NOT support: function calls, attribute access, imports, or any other Python features.
    
    Examples:
        safe_eval("BASIC * 0.2", {"BASIC": 50000}) → 10000.0
        safe_eval("GROSS - PF - TAX", {"GROSS": 63000, "PF": 6000, "TAX": 200}) → 56800.0
    """
    # Replace variable names with their values in the expression
    # We need to be careful about longer variable names being substrings of shorter ones
    # Sort by length (longest first) to avoid partial replacements
    sorted_vars = sorted(context.keys(), key=len, reverse=True)
    processed = expression
    for var_name in sorted_vars:
        processed = processed.replace(var_name, str(context[var_name]))

    try:
        tree = ast.parse(processed, mode="eval")
    except SyntaxError:
        raise ValueError(f"Invalid formula syntax: '{expression}'")

    return _eval_node(tree.body)


def _eval_node(node: ast.AST) -> float:
    """Recursively evaluate an AST node."""
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return float(node.value)
        raise ValueError(f"Unsupported constant type: {type(node.value)}")

    elif isinstance(node, ast.BinOp):
        op_func = SAFE_OPERATORS.get(type(node.op))
        if op_func is None:
            raise ValueError(f"Unsupported operator: {type(node.op).__name__}")
        left = _eval_node(node.left)
        right = _eval_node(node.right)
        if isinstance(node.op, ast.Div) and right == 0:
            raise ValueError("Division by zero in formula.")
        return op_func(left, right)

    elif isinstance(node, ast.UnaryOp):
        op_func = SAFE_OPERATORS.get(type(node.op))
        if op_func is None:
            raise ValueError(f"Unsupported unary operator: {type(node.op).__name__}")
        return op_func(_eval_node(node.operand))

    elif isinstance(node, ast.Name):
        raise ValueError(
            f"Unknown variable '{node.id}' in formula. "
            f"Make sure this rule code exists and has a lower sequence number."
        )

    else:
        raise ValueError(f"Unsupported expression element: {type(node).__name__}")


# ── Data Classes ──

@dataclass
class RuleResult:
    """Result of a single salary rule computation."""
    rule_id: int
    code: str
    name: str
    category: str
    sequence: int
    amount: Decimal
    appears_on_payslip: bool = True


@dataclass
class PayslipCalculation:
    """Complete payslip calculation result for one employee."""
    employee_id: int
    contract_id: int
    gross_salary: Decimal = Decimal("0.00")
    total_deductions: Decimal = Decimal("0.00")
    net_salary: Decimal = Decimal("0.00")
    expected_hours: Decimal = Decimal("0.00")
    worked_hours: Decimal = Decimal("0.00")
    short_hours: Decimal = Decimal("0.00")
    overtime_hours: Decimal = Decimal("0.00")
    lines: list[RuleResult] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    success: bool = True


@dataclass
class PayrunResult:
    """Result of computing an entire payrun."""
    payslips: list[PayslipCalculation] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


# ── Engine ──

class PayrollEngine:
    """
    The payroll calculation engine.
    
    Usage:
        engine = PayrollEngine(db_session)
        result = await engine.compute_payrun(payrun)
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def compute_payrun(self, payrun: Payrun) -> PayrunResult:
        """
        Compute payslips for all included employees in a payrun.
        
        1. Load salary structure and rules
        2. For each included employee:
           a. Find active contract for the payroll period
           b. Execute salary rules in sequence
           c. Compute gross, deductions, net
           d. Create payslip + lines
        """
        result = PayrunResult()

        # Load salary structure with rules
        struct_result = await self.db.execute(
            select(SalaryStructure)
            .options(selectinload(SalaryStructure.rules))
            .where(SalaryStructure.id == payrun.salary_structure_id)
        )
        structure = struct_result.scalar_one_or_none()
        if not structure:
            result.errors.append("Salary structure not found.")
            return result

        # Get active rules sorted by sequence
        active_rules = sorted(
            [r for r in structure.rules if r.is_active],
            key=lambda r: r.sequence,
        )

        if not active_rules:
            result.errors.append(f"No active salary rules found in structure '{structure.name}'.")
            return result

        # Load included employees
        pe_result = await self.db.execute(
            select(PayrunEmployee)
            .where(
                PayrunEmployee.payrun_id == payrun.id,
                PayrunEmployee.is_excluded == False,
            )
        )
        payrun_employees = pe_result.scalars().all()

        if not payrun_employees:
            result.warnings.append("No employees are included in this payrun.")
            return result

        for pe in payrun_employees:
            calc = await self._compute_employee_payslip(
                employee_id=pe.employee_id,
                payrun=payrun,
                rules=active_rules,
            )
            result.payslips.append(calc)

            if not calc.success:
                for err in calc.errors:
                    result.warnings.append(f"Employee #{pe.employee_id}: {err}")

        return result

    async def _compute_employee_payslip(
        self,
        employee_id: int,
        payrun: Payrun,
        rules: list[SalaryRule],
    ) -> PayslipCalculation:
        """Compute salary for a single employee."""
        calc = PayslipCalculation(employee_id=employee_id, contract_id=0)

        # 1. Check for duplicate payslip
        existing = await self.db.execute(
            select(Payslip).where(
                Payslip.employee_id == employee_id,
                Payslip.period_start == payrun.period_start,
                Payslip.period_end == payrun.period_end,
            )
        )
        if existing.scalar_one_or_none():
            calc.success = False
            calc.errors.append(
                f"A payslip already exists for period {payrun.period_start} to {payrun.period_end}."
            )
            return calc

        # 2. Find active contract for the period
        contract_result = await self.db.execute(
            select(Contract).options(selectinload(Contract.working_schedule)).where(
                Contract.employee_id == employee_id,
                Contract.status == ContractStatus.ACTIVE,
                Contract.start_date <= payrun.period_end,
                (Contract.end_date.is_(None)) | (Contract.end_date >= payrun.period_start),
            )
        )
        contract = contract_result.scalar_one_or_none()

        if not contract:
            calc.success = False
            calc.errors.append(
                f"No active contract found for period {payrun.period_start} to {payrun.period_end}."
            )
            return calc

        calc.contract_id = contract.id

        # 2.5 Compute Attendance metrics
        expected_hours = 0.0
        worked_hours = 0.0
        
        # Calculate expected hours by iterating days in period
        schedule = contract.working_schedule
        if schedule:
            current_day = payrun.period_start
            while current_day <= payrun.period_end:
                days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
                day_name = days[current_day.weekday()]
                start = getattr(schedule, f"{day_name}_start", None)
                end = getattr(schedule, f"{day_name}_end", None)
                if start and end:
                    dt_start = datetime.combine(current_day, start)
                    dt_end = datetime.combine(current_day, end)
                    hrs = (dt_end - dt_start).total_seconds() / 3600.0
                    break_mins = getattr(schedule, 'break_duration_minutes', 60) or 60
                    hrs -= break_mins / 60.0
                    expected_hours += max(0.0, hrs)
                current_day += timedelta(days=1)

        # Fetch attendance records
        att_result = await self.db.execute(
            select(Attendance).where(
                Attendance.employee_id == employee_id,
                Attendance.date >= payrun.period_start,
                Attendance.date <= payrun.period_end,
            )
        )
        attendances = att_result.scalars().all()
        for a in attendances:
            if a.worked_hours:
                worked_hours += a.worked_hours

        short_hours = max(0.0, expected_hours - worked_hours)
        overtime_hours = max(0.0, worked_hours - expected_hours)

        calc.expected_hours = Decimal(str(round(expected_hours, 2)))
        calc.worked_hours = Decimal(str(round(worked_hours, 2)))
        calc.short_hours = Decimal(str(round(short_hours, 2)))
        calc.overtime_hours = Decimal(str(round(overtime_hours, 2)))

        # 3. Build computation context
        context: dict[str, float] = {
            "contract_wage": float(contract.wage),
            "EXPECTED_HOURS": float(calc.expected_hours),
            "WORKED_HOURS": float(calc.worked_hours),
            "SHORT_HOURS": float(calc.short_hours),
            "OVERTIME_HOURS": float(calc.overtime_hours),
        }

        # 4. Execute rules in sequence
        earnings = Decimal("0.00")
        deductions = Decimal("0.00")

        for rule in rules:
            try:
                amount = self._evaluate_rule(rule, context, contract)
                amount_decimal = Decimal(str(amount)).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )

                # Store result in context for subsequent rules
                context[rule.code] = float(amount_decimal)

                # Track earnings and deductions
                if rule.category in (RuleCategory.BASIC, RuleCategory.ALLOWANCE):
                    earnings += amount_decimal
                elif rule.category == RuleCategory.DEDUCTION:
                    deductions += amount_decimal
                elif rule.category == RuleCategory.GROSS:
                    # GROSS is typically a computed summary — store it but don't double-add
                    context[rule.code] = float(earnings)
                    amount_decimal = earnings
                elif rule.category == RuleCategory.NET:
                    # NET is computed
                    net = earnings - deductions
                    context[rule.code] = float(net)
                    amount_decimal = net

                calc.lines.append(RuleResult(
                    rule_id=rule.id,
                    code=rule.code,
                    name=rule.name,
                    category=rule.category.value,
                    sequence=rule.sequence,
                    amount=amount_decimal,
                    appears_on_payslip=rule.appears_on_payslip,
                ))

            except Exception as e:
                calc.success = False
                calc.errors.append(f"Error computing rule '{rule.name}' ({rule.code}): {str(e)}")
                return calc

        calc.gross_salary = earnings
        calc.total_deductions = deductions
        calc.net_salary = earnings - deductions

        return calc

    def _evaluate_rule(
        self,
        rule: SalaryRule,
        context: dict[str, float],
        contract: Contract,
    ) -> float:
        """Evaluate a single salary rule and return the computed amount."""

        if rule.calculation_type == CalculationType.FIXED:
            if rule.fixed_amount is not None:
                return float(rule.fixed_amount)
            # If fixed amount is not set, use contract wage for BASIC
            if rule.category == RuleCategory.BASIC:
                return float(contract.wage)
            raise ValueError("Fixed amount not configured.")

        elif rule.calculation_type == CalculationType.PERCENTAGE:
            if rule.percentage is None or rule.percentage_of is None:
                raise ValueError("Percentage and percentage_of must be configured.")

            base_code = rule.percentage_of
            if base_code not in context:
                raise ValueError(
                    f"Cannot compute {rule.code}: reference rule '{base_code}' "
                    f"has not been computed yet. Check the sequence order."
                )

            base_value = context[base_code]
            return base_value * (rule.percentage / 100.0)

        elif rule.calculation_type == CalculationType.FORMULA:
            if not rule.formula:
                raise ValueError("Formula expression not configured.")
            return safe_eval(rule.formula, context)

        else:
            raise ValueError(f"Unknown calculation type: {rule.calculation_type}")


async def compute_and_save_payrun(db: AsyncSession, payrun: Payrun) -> PayrunResult:
    """
    High-level function: compute payrun and persist payslips to database.
    """
    engine = PayrollEngine(db)
    result = await engine.compute_payrun(payrun)

    # Create payslip records for successful computations
    for calc in result.payslips:
        if not calc.success:
            continue

        payslip = Payslip(
            payrun_id=payrun.id,
            employee_id=calc.employee_id,
            contract_id=calc.contract_id,
            period_start=payrun.period_start,
            period_end=payrun.period_end,
            gross_salary=calc.gross_salary,
            total_deductions=calc.total_deductions,
            net_salary=calc.net_salary,
            expected_hours=calc.expected_hours,
            worked_hours=calc.worked_hours,
            short_hours=calc.short_hours,
            overtime_hours=calc.overtime_hours,
            status=PayslipStatus.DRAFT,
        )
        db.add(payslip)
        await db.flush()

        # Create payslip lines
        for line in calc.lines:
            if line.appears_on_payslip:
                payslip_line = PayslipLine(
                    payslip_id=payslip.id,
                    salary_rule_id=line.rule_id,
                    name=line.name,
                    code=line.code,
                    category=line.category,
                    sequence=line.sequence,
                    amount=line.amount,
                )
                db.add(payslip_line)

    return result
