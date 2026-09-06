"""
Contract schemas.
"""

from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator
from app.models.contract import ContractStatus, WageType


class ContractCreate(BaseModel):
    employee_id: int
    name: str = Field(..., min_length=1, max_length=100)
    start_date: date
    end_date: date | None = None
    wage: Decimal = Field(..., gt=0)
    wage_type: WageType = WageType.MONTHLY
    working_schedule_id: int | None = None
    salary_structure_id: int | None = None
    status: ContractStatus = ContractStatus.DRAFT
    notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date is not None and self.end_date <= self.start_date:
            raise ValueError("End date must be after start date.")
        return self


class ContractUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    start_date: date | None = None
    end_date: date | None = None
    wage: Decimal | None = Field(None, gt=0)
    wage_type: WageType | None = None
    working_schedule_id: int | None = None
    salary_structure_id: int | None = None
    status: ContractStatus | None = None
    notes: str | None = None


class ContractResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str | None = None
    employee_number: str | None = None
    department_name: str | None = None
    job_role: str | None = None
    schedule_name: str | None = None
    salary_structure_name: str | None = None
    name: str
    start_date: date
    end_date: date | None
    wage: Decimal
    wage_type: WageType
    working_schedule_id: int | None
    salary_structure_id: int | None
    status: ContractStatus
    notes: str | None
    notice_days: int = 30
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
