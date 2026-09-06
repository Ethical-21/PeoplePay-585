"""
Employee schemas — Request/response models for employee management.
"""

from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field
from app.models.employee import EmployeeType, EmployeeStatus, Gender


class EmployeeCreate(BaseModel):
    employee_number: str | None = None
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str | None = None
    date_of_birth: date | None = None
    gender: Gender | None = None
    department_id: int | None = None
    job_title: str | None = None
    employee_type: EmployeeType = EmployeeType.FULL_TIME
    joining_date: date
    status: EmployeeStatus = EmployeeStatus.ACTIVE
    address: str | None = None
    city: str | None = None
    state: str | None = None
    user_id: int | None = None


class EmployeeUpdate(BaseModel):
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    gender: Gender | None = None
    department_id: int | None = None
    job_title: str | None = None
    employee_type: EmployeeType | None = None
    status: EmployeeStatus | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    user_id: int | None = None


class DepartmentInfo(BaseModel):
    id: int
    name: str
    code: str

    model_config = {"from_attributes": True}


class EmployeeResponse(BaseModel):
    id: int
    employee_number: str
    first_name: str
    last_name: str
    full_name: str
    email: str
    phone: str | None
    date_of_birth: date | None
    gender: Gender | None
    department_id: int | None
    department: DepartmentInfo | None = None
    job_title: str | None
    employee_type: EmployeeType
    joining_date: date
    status: EmployeeStatus
    address: str | None
    city: str | None
    state: str | None
    user_id: int | None
    roles: list[str] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmployeeListResponse(BaseModel):
    employees: list[EmployeeResponse]
    total: int


class EmployeeStatsResponse(BaseModel):
    contracts_count: int = 0
    attendance_count: int = 0
    timeoff_count: int = 0
    payslips_count: int = 0
