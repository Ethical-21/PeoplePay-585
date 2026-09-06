"""
Attendance schemas.
"""

from datetime import date, datetime
from pydantic import BaseModel, Field, model_validator
from app.models.attendance import AttendanceStatus


class AttendanceCreate(BaseModel):
    employee_id: int
    date: date
    check_in: datetime
    check_out: datetime | None = None
    status: AttendanceStatus = AttendanceStatus.PRESENT
    notes: str | None = None

    @model_validator(mode="after")
    def validate_checkout(self):
        if self.check_out is not None and self.check_out <= self.check_in:
            raise ValueError("Check-out time must be after check-in time.")
        return self


class AttendanceUpdate(BaseModel):
    check_in: datetime | None = None
    check_out: datetime | None = None
    status: AttendanceStatus | None = None
    notes: str | None = None


class AttendanceResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str | None = None
    employee_number: str | None = None
    department_name: str | None = None
    manager_name: str | None = None
    date: date
    check_in: datetime
    check_out: datetime | None
    worked_hours: float | None
    overtime_hours: float | None = None
    status: AttendanceStatus
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
