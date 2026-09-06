"""
Salary schemas — Structures and Rules.
"""

from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator
from app.models.salary import RuleCategory, CalculationType


# ── Salary Structure ──

class SalaryStructureCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=20)
    description: str | None = None
    is_active: bool = True


class SalaryStructureUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    code: str | None = Field(None, min_length=1, max_length=20)
    description: str | None = None
    is_active: bool | None = None


class SalaryRuleResponse(BaseModel):
    id: int
    structure_id: int
    structure_name: str = ""
    name: str
    code: str
    category: RuleCategory
    sequence: int
    calculation_type: CalculationType
    fixed_amount: Decimal | None
    percentage: float | None
    percentage_of: str | None
    formula: str | None
    is_active: bool
    appears_on_payslip: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SalaryStructureResponse(BaseModel):
    id: int
    name: str
    code: str
    description: str | None
    is_active: bool
    rules: list[SalaryRuleResponse] = []
    employee_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Salary Rule ──

class SalaryRuleCreate(BaseModel):
    structure_id: int
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=20)
    category: RuleCategory
    sequence: int = Field(..., ge=1)
    calculation_type: CalculationType
    fixed_amount: Decimal | None = None
    percentage: float | None = None
    percentage_of: str | None = None
    formula: str | None = None
    is_active: bool = True
    appears_on_payslip: bool = True

    @model_validator(mode="after")
    def validate_calculation_config(self):
        if self.calculation_type == CalculationType.FIXED:
            if self.fixed_amount is None:
                raise ValueError("Fixed amount is required for 'fixed' calculation type.")
        elif self.calculation_type == CalculationType.PERCENTAGE:
            if self.percentage is None:
                raise ValueError("Percentage value is required for 'percentage' calculation type.")
            if self.percentage_of is None:
                raise ValueError("'percentage_of' (rule code) is required for 'percentage' calculation type.")
            if not (0 < self.percentage <= 100):
                raise ValueError("Percentage must be between 0 and 100.")
        elif self.calculation_type == CalculationType.FORMULA:
            if not self.formula:
                raise ValueError("Formula expression is required for 'formula' calculation type.")
        return self


class SalaryRuleUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    code: str | None = Field(None, min_length=1, max_length=20)
    category: RuleCategory | None = None
    sequence: int | None = Field(None, ge=1)
    calculation_type: CalculationType | None = None
    fixed_amount: Decimal | None = None
    percentage: float | None = None
    percentage_of: str | None = None
    formula: str | None = None
    is_active: bool | None = None
    appears_on_payslip: bool | None = None
