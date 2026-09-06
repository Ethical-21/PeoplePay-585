"""
Time Off schemas — Types, Allocations, Requests.
"""

from datetime import date, datetime
from pydantic import BaseModel, Field, model_validator
from app.models.timeoff import TimeOffStatus


# ── Time Off Type ──

class TimeOffTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=20)
    is_paid: bool = True
    color: str | None = None
    unit: str = "days"
    requires_allocation: bool = True
    is_active: bool = True
    approval: str = "Manager"
    work_entry_type: str | None = None
    configuration_notes: str | None = None


class TimeOffTypeUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    code: str | None = Field(None, min_length=1, max_length=20)
    is_paid: bool | None = None
    color: str | None = None
    unit: str | None = None
    requires_allocation: bool | None = None
    is_active: bool | None = None
    approval: str | None = None
    work_entry_type: str | None = None
    configuration_notes: str | None = None


class TimeOffTypeResponse(BaseModel):
    id: int
    name: str
    code: str
    is_paid: bool
    color: str | None
    unit: str
    requires_allocation: bool
    is_active: bool
    approval: str
    work_entry_type: str | None
    configuration_notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Allocation ──

class TimeOffAllocationCreate(BaseModel):
    employee_id: int
    time_off_type_id: int
    total_days: float = Field(..., gt=0)
    year: int = Field(..., ge=2020, le=2099)
    status: TimeOffStatus | None = None
    description: str | None = None
    valid_from: date | None = None
    valid_until: date | None = None
    approver_id: int | None = None


class TimeOffAllocationUpdate(BaseModel):
    total_days: float | None = Field(None, gt=0)
    status: TimeOffStatus | None = None
    description: str | None = None
    valid_from: date | None = None
    valid_until: date | None = None
    approver_id: int | None = None


class TimeOffAllocationResponse(BaseModel):
    id: int
    employee_id: int
    time_off_type_id: int
    total_days: float
    used_days: float
    remaining_days: float
    year: int
    status: TimeOffStatus
    description: str | None
    valid_from: date | None
    valid_until: date | None
    approver_id: int | None
    created_at: datetime
    
    # Enriched fields
    employee_name: str | None = None
    type_name: str | None = None
    approver_name: str | None = None

    model_config = {"from_attributes": True}


# ── Request ──

class TimeOffRequestCreate(BaseModel):
    employee_id: int
    time_off_type_id: int
    start_date: date
    end_date: date
    reason: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("End date must be on or after start date.")
        return self


class TimeOffRequestUpdate(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    reason: str | None = None


class TimeOffRequestResponse(BaseModel):
    id: int
    employee_id: int
    time_off_type_id: int
    start_date: date
    end_date: date
    days: float
    reason: str | None
    status: TimeOffStatus
    approved_by: int | None
    created_at: datetime
    updated_at: datetime
    
    # Enriched fields
    employee_name: str | None = None
    type_name: str | None = None
    approver_name: str | None = None
    allocation_name: str | None = None

    model_config = {"from_attributes": True}
