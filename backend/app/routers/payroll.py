"""
Payroll router — Payruns and Payslips with the complete payroll workflow.
"""

from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.employee import Employee, EmployeeStatus
from app.models.contract import Contract, ContractStatus
from app.models.payroll import (
    Payrun, PayrunEmployee, Payslip, PayslipLine,
    PayrunStatus, PayslipStatus,
)
from app.models.salary import SalaryStructure
from app.auth.dependencies import require_min_role, get_current_user
from app.schemas.payroll import (
    PayrunCreate, PayrunAddEmployees, PayrunResponse,
    PayslipResponse, PayslipSummary,
)
from app.services.payroll_engine import compute_and_save_payrun

router = APIRouter(prefix="/payroll", tags=["Payroll"])


# ── Helper ──

async def _get_payrun_response(db: AsyncSession, payrun: Payrun) -> PayrunResponse:
    """Build a PayrunResponse with computed counts and totals."""
    emp_count = await db.execute(
        select(func.count()).where(
            PayrunEmployee.payrun_id == payrun.id,
            PayrunEmployee.is_excluded == False,
        )
    )
    payslip_result = await db.execute(
        select(
            func.count(Payslip.id),
            func.coalesce(func.sum(Payslip.net_salary), 0),
        ).where(Payslip.payrun_id == payrun.id)
    )
    payslip_row = payslip_result.one()

    # Load salary structure name
    struct_result = await db.execute(
        select(SalaryStructure).where(SalaryStructure.id == payrun.salary_structure_id)
    )
    salary_struct = struct_result.scalar_one_or_none()

    resp = PayrunResponse.model_validate(payrun)
    resp.employee_count = emp_count.scalar() or 0
    resp.payslip_count = payslip_row[0] or 0
    resp.total_net_salary = Decimal(str(payslip_row[1]))
    resp.salary_structure_name = salary_struct.name if salary_struct else "Unknown"
    return resp


# ── Payruns ──

@router.get("/payruns", response_model=list[PayrunResponse])
async def list_payruns(
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_USER)),
):
    """List all payruns."""
    query = select(Payrun)
    if status_filter:
        query = query.where(Payrun.status == status_filter)
    query = query.order_by(Payrun.created_at.desc())

    result = await db.execute(query)
    payruns = result.scalars().all()
    return [await _get_payrun_response(db, p) for p in payruns]


@router.get("/payruns/{payrun_id}", response_model=PayrunResponse)
async def get_payrun(
    payrun_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_USER)),
):
    result = await db.execute(select(Payrun).where(Payrun.id == payrun_id))
    payrun = result.scalar_one_or_none()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found.")
    return await _get_payrun_response(db, payrun)


@router.post("/payruns", response_model=PayrunResponse, status_code=status.HTTP_201_CREATED)
async def create_payrun(
    data: PayrunCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_USER)),
):
    """Create a new payrun (draft state)."""
    # Validate salary structure exists
    struct_result = await db.execute(
        select(SalaryStructure).where(SalaryStructure.id == data.salary_structure_id)
    )
    if not struct_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Salary structure not found.")

    payrun = Payrun(
        **data.model_dump(),
        status=PayrunStatus.DRAFT,
        created_by=current_user.id,
    )
    db.add(payrun)
    await db.flush()
    await db.refresh(payrun)
    return await _get_payrun_response(db, payrun)


@router.post("/payruns/{payrun_id}/add-employees")
async def add_employees_to_payrun(
    payrun_id: int,
    data: PayrunAddEmployees,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_USER)),
):
    """Add employees to a draft payrun."""
    result = await db.execute(select(Payrun).where(Payrun.id == payrun_id))
    payrun = result.scalar_one_or_none()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found.")

    if payrun.status != PayrunStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot add employees to a payrun with status '{payrun.status.value}'. The payrun must be in 'draft' status.",
        )

    added = 0
    skipped = []
    for emp_id in data.employee_ids:
        # Check if already added
        existing = await db.execute(
            select(PayrunEmployee).where(
                PayrunEmployee.payrun_id == payrun_id,
                PayrunEmployee.employee_id == emp_id,
            )
        )
        if existing.scalar_one_or_none():
            skipped.append(emp_id)
            continue

        # Verify employee exists and is active
        emp_result = await db.execute(select(Employee).where(Employee.id == emp_id))
        emp = emp_result.scalar_one_or_none()
        if not emp or emp.status != EmployeeStatus.ACTIVE:
            skipped.append(emp_id)
            continue

        pe = PayrunEmployee(payrun_id=payrun_id, employee_id=emp_id)
        db.add(pe)
        added += 1

    return {
        "message": f"Added {added} employee(s) to payrun.",
        "added": added,
        "skipped": skipped,
    }


@router.post("/payruns/{payrun_id}/auto-add-employees")
async def auto_add_eligible_employees(
    payrun_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_USER)),
):
    """Automatically add all eligible employees (active with active contract) to the payrun."""
    result = await db.execute(select(Payrun).where(Payrun.id == payrun_id))
    payrun = result.scalar_one_or_none()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found.")

    if payrun.status != PayrunStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot add employees to a payrun with status '{payrun.status.value}'.",
        )

    # Find active employees with active contracts covering the payrun period
    emp_result = await db.execute(
        select(Employee).where(Employee.status == EmployeeStatus.ACTIVE)
    )
    active_employees = emp_result.scalars().all()

    added = 0
    skipped_no_contract = []
    skipped_already = []

    for emp in active_employees:
        # Check if already in payrun
        existing = await db.execute(
            select(PayrunEmployee).where(
                PayrunEmployee.payrun_id == payrun_id,
                PayrunEmployee.employee_id == emp.id,
            )
        )
        if existing.scalar_one_or_none():
            skipped_already.append({"id": emp.id, "name": emp.full_name})
            continue

        # Check for active contract
        contract_result = await db.execute(
            select(Contract).where(
                Contract.employee_id == emp.id,
                Contract.status == ContractStatus.ACTIVE,
                Contract.start_date <= payrun.period_end,
                (Contract.end_date.is_(None)) | (Contract.end_date >= payrun.period_start),
            )
        )
        contract = contract_result.scalar_one_or_none()
        if not contract:
            skipped_no_contract.append({"id": emp.id, "name": emp.full_name})
            continue

        pe = PayrunEmployee(payrun_id=payrun_id, employee_id=emp.id)
        db.add(pe)
        added += 1

    return {
        "message": f"Added {added} eligible employee(s) to payrun.",
        "added": added,
        "skipped_no_contract": skipped_no_contract,
        "skipped_already_added": skipped_already,
    }


@router.post("/payruns/{payrun_id}/compute")
async def compute_payrun(
    payrun_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_USER)),
):
    """Compute payslips for all included employees in the payrun."""
    result = await db.execute(select(Payrun).where(Payrun.id == payrun_id))
    payrun = result.scalar_one_or_none()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found.")

    if payrun.status not in (PayrunStatus.DRAFT, PayrunStatus.COMPUTED):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot compute a payrun with status '{payrun.status.value}'. Must be 'draft' or 'computed' (for recomputation).",
        )

    # If recomputing, delete existing payslips for this payrun
    if payrun.status == PayrunStatus.COMPUTED:
        existing_payslips = await db.execute(
            select(Payslip).where(Payslip.payrun_id == payrun_id)
        )
        for ps in existing_payslips.scalars().all():
            await db.delete(ps)
        await db.flush()

    # Run the payroll engine
    engine_result = await compute_and_save_payrun(db, payrun)

    # Update payrun status
    payrun.status = PayrunStatus.COMPUTED
    payrun.computed_at = datetime.now(timezone.utc)

    successful = sum(1 for c in engine_result.payslips if c.success)
    failed = sum(1 for c in engine_result.payslips if not c.success)

    return {
        "message": f"Payrun computed. {successful} payslip(s) generated, {failed} failed.",
        "successful": successful,
        "failed": failed,
        "warnings": engine_result.warnings,
        "errors": engine_result.errors,
    }


@router.post("/payruns/{payrun_id}/validate")
async def validate_payrun(
    payrun_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_MANAGER)),
):
    """Validate a computed payrun — confirms payslips."""
    result = await db.execute(select(Payrun).where(Payrun.id == payrun_id))
    payrun = result.scalar_one_or_none()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found.")

    if payrun.status != PayrunStatus.COMPUTED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot validate a payrun with status '{payrun.status.value}'. Must be 'computed' first.",
        )

    # Confirm all payslips
    payslips_result = await db.execute(
        select(Payslip).where(Payslip.payrun_id == payrun_id)
    )
    for ps in payslips_result.scalars().all():
        ps.status = PayslipStatus.CONFIRMED

    payrun.status = PayrunStatus.VALIDATED
    payrun.validated_at = datetime.now(timezone.utc)

    return {"message": "Payrun validated. All payslips confirmed."}


@router.post("/payruns/{payrun_id}/mark-paid")
async def mark_payrun_paid(
    payrun_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_MANAGER)),
):
    """Mark a validated payrun as paid."""
    result = await db.execute(select(Payrun).where(Payrun.id == payrun_id))
    payrun = result.scalar_one_or_none()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found.")

    if payrun.status != PayrunStatus.VALIDATED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot mark as paid: payrun status is '{payrun.status.value}'. Must be 'validated' first.",
        )

    payslips_result = await db.execute(
        select(Payslip).where(Payslip.payrun_id == payrun_id)
    )
    for ps in payslips_result.scalars().all():
        ps.status = PayslipStatus.PAID

    payrun.status = PayrunStatus.PAID
    payrun.paid_at = datetime.now(timezone.utc)

    return {"message": "Payrun marked as paid. All payslips updated."}


# ── Payslips ──

@router.get("/payslips", response_model=list[PayslipSummary])
async def list_payslips(
    payrun_id: int | None = Query(None),
    employee_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List payslips with optional filters."""
    query = select(Payslip).options(
        selectinload(Payslip.employee).selectinload(Employee.department),
        selectinload(Payslip.lines),
    )

    # Employees can only see their own payslips
    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1):
        emp_result = await db.execute(
            select(Employee).where(Employee.user_id == current_user.id)
        )
        emp = emp_result.scalar_one_or_none()
        if emp:
            query = query.where(Payslip.employee_id == emp.id)
        else:
            return []
    else:
        if payrun_id:
            query = query.where(Payslip.payrun_id == payrun_id)
        if employee_id:
            query = query.where(Payslip.employee_id == employee_id)

    query = query.order_by(Payslip.created_at.desc())
    result = await db.execute(query)
    payslips = result.scalars().all()

    # Pre-fetch all payruns and structures for efficiency
    payrun_ids = list(set(ps.payrun_id for ps in payslips))
    structure_map: dict[int, str] = {}  # payrun_id -> structure_name
    if payrun_ids:
        pr_result = await db.execute(select(Payrun).where(Payrun.id.in_(payrun_ids)))
        payruns_list = pr_result.scalars().all()
        struct_ids = list(set(pr.salary_structure_id for pr in payruns_list if pr.salary_structure_id))
        if struct_ids:
            sr_result = await db.execute(select(SalaryStructure).where(SalaryStructure.id.in_(struct_ids)))
            structs = {s.id: s.name for s in sr_result.scalars().all()}
        else:
            structs = {}
        for pr in payruns_list:
            structure_map[pr.id] = structs.get(pr.salary_structure_id, "N/A") if pr.salary_structure_id else "N/A"

    summaries = []
    for ps in payslips:
        summary = PayslipSummary.model_validate(ps)
        summary.payrun_id = ps.payrun_id
        if ps.employee:
            summary.employee_name = ps.employee.full_name
            summary.employee_number = ps.employee.employee_number
            summary.department = ps.employee.department.name if ps.employee.department else ""
        # Compute basic salary from payslip lines
        from decimal import Decimal as D
        basic = D("0.00")
        for line in (ps.lines or []):
            if line.category.lower() == "basic":
                basic += line.amount
        summary.basic_salary = basic
        summary.structure_name = structure_map.get(ps.payrun_id, "N/A")
        summaries.append(summary)

    return summaries


@router.get("/payslips/{payslip_id}", response_model=PayslipResponse)
async def get_payslip(
    payslip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single payslip with all line items."""
    result = await db.execute(
        select(Payslip)
        .options(selectinload(Payslip.lines))
        .where(Payslip.id == payslip_id)
    )
    payslip = result.scalar_one_or_none()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found.")

    # Employee can only view their own
    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1):
        emp_result = await db.execute(
            select(Employee).where(Employee.user_id == current_user.id)
        )
        emp = emp_result.scalar_one_or_none()
        if not emp or payslip.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="You can only view your own payslips.")

    return PayslipResponse.model_validate(payslip)


@router.get("/payslips/{payslip_id}/pdf")
async def download_payslip_pdf(
    payslip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and download a payslip as PDF."""
    from fastapi.responses import Response
    from app.services.pdf_service import generate_payslip_pdf

    result = await db.execute(
        select(Payslip)
        .options(
            selectinload(Payslip.lines),
            selectinload(Payslip.employee).selectinload(Employee.department),
        )
        .where(Payslip.id == payslip_id)
    )
    payslip = result.scalar_one_or_none()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found.")

    # Employee can only download their own
    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1):
        emp_result = await db.execute(
            select(Employee).where(Employee.user_id == current_user.id)
        )
        emp = emp_result.scalar_one_or_none()
        if not emp or payslip.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="You can only download your own payslips.")

    # Get employee and contract info
    emp_result = await db.execute(
        select(Employee).options(selectinload(Employee.department)).where(Employee.id == payslip.employee_id)
    )
    employee = emp_result.scalar_one()

    contract_result = await db.execute(
        select(Contract).where(Contract.id == payslip.contract_id)
    )
    contract = contract_result.scalar_one_or_none()

    # Get payrun and salary structure info
    payrun_result = await db.execute(select(Payrun).where(Payrun.id == payslip.payrun_id))
    payrun = payrun_result.scalar_one_or_none()

    structure_name = "N/A"
    if payrun:
        from app.models.salary import SalaryStructure
        struct_result = await db.execute(
            select(SalaryStructure).where(SalaryStructure.id == payrun.salary_structure_id)
        )
        structure = struct_result.scalar_one_or_none()
        if structure:
            structure_name = structure.name

    # Build line items
    lines_data = []
    for line in sorted(payslip.lines, key=lambda l: l.sequence):
        lines_data.append({
            "name": line.name,
            "code": line.code,
            "category": line.category,
            "calculation_type": "fixed",
            "amount": float(line.amount),
        })

    pdf_bytes = generate_payslip_pdf(
        employee_name=employee.full_name,
        employee_number=employee.employee_number,
        employee_email=employee.email,
        department=employee.department.name if employee.department else "N/A",
        job_title=employee.job_title or "N/A",
        contract_name=contract.name if contract else "N/A",
        wage=float(contract.wage) if contract else 0,
        period_start=payslip.period_start,
        period_end=payslip.period_end,
        salary_structure_name=structure_name,
        lines=lines_data,
        gross_salary=float(payslip.gross_salary),
        total_deductions=float(payslip.total_deductions),
        net_salary=float(payslip.net_salary),
        payrun_name=payrun.name if payrun else "",
        payslip_id=payslip.id,
    )

    filename = f"payslip_{employee.employee_number}_{payslip.period_start}_{payslip.period_end}.pdf"
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

