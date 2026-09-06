"""
Payroll schemas — Payrun, Payslip, PayslipLine.
"""

from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator
from app.models.payroll import PayrunStatus, PayslipStatus


# ── Payrun ──

class PayrunCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    period_start: date
    period_end: date
    salary_structure_id: int

    @model_validator(mode="after")
    def validate_period(self):
        if self.period_end <= self.period_start:
            raise ValueError("Period end date must be after period start date.")
        return self


class PayrunAddEmployees(BaseModel):
    employee_ids: list[int] = Field(..., min_length=1)


class PayrunResponse(BaseModel):
    id: int
    name: str
    period_start: date
    period_end: date
    salary_structure_id: int
    salary_structure_name: str = ""
    status: PayrunStatus
    created_by: int | None
    created_at: datetime
    computed_at: datetime | None
    validated_at: datetime | None
    paid_at: datetime | None
    employee_count: int = 0
    payslip_count: int = 0
    total_net_salary: Decimal = Decimal("0.00")

    model_config = {"from_attributes": True}


# ── Payslip ──

class PayslipLineResponse(BaseModel):
    id: int
    name: str
    code: str
    category: str
    sequence: int
    amount: Decimal

    model_config = {"from_attributes": True}


class PayslipResponse(BaseModel):
    id: int
    payrun_id: int
    employee_id: int
    contract_id: int
    period_start: date
    period_end: date
    gross_salary: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    status: PayslipStatus
    lines: list[PayslipLineResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class PayslipSummary(BaseModel):
    id: int
    payrun_id: int = 0
    employee_id: int
    employee_name: str = ""
    employee_number: str = ""
    department: str = ""
    period_start: date
    period_end: date
    basic_salary: Decimal = Decimal("0.00")
    gross_salary: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    status: PayslipStatus
    structure_name: str = ""
    created_at: datetime

    model_config = {"from_attributes": True}
