"""
Employee model — Core entity connecting contracts, attendance, payroll.
"""

import enum
from datetime import date, datetime
from sqlalchemy import (
    String, Integer, Date, DateTime, Text, Enum, ForeignKey, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class EmployeeType(str, enum.Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERN = "intern"


class EmployeeStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    TERMINATED = "terminated"


class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True
    )
    employee_number: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[Gender | None] = mapped_column(
        Enum(Gender, name="gender_enum", create_constraint=True), nullable=True
    )
    department_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    job_title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    employee_type: Mapped[EmployeeType] = mapped_column(
        Enum(EmployeeType, name="employee_type_enum", create_constraint=True),
        nullable=False,
        default=EmployeeType.FULL_TIME,
    )
    joining_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[EmployeeStatus] = mapped_column(
        Enum(EmployeeStatus, name="employee_status_enum", create_constraint=True),
        nullable=False,
        default=EmployeeStatus.ACTIVE,
    )
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="employee")
    department: Mapped["Department"] = relationship(
        "Department", back_populates="employees", foreign_keys=[department_id]
    )
    contracts: Mapped[list["Contract"]] = relationship(
        "Contract", back_populates="employee", order_by="Contract.start_date.desc()", cascade="all, delete-orphan"
    )
    attendance_records: Mapped[list["Attendance"]] = relationship(
        "Attendance", back_populates="employee", cascade="all, delete-orphan"
    )
    time_off_allocations: Mapped[list["TimeOffAllocation"]] = relationship(
        "TimeOffAllocation", back_populates="employee", foreign_keys="[TimeOffAllocation.employee_id]", cascade="all, delete-orphan"
    )
    time_off_requests: Mapped[list["TimeOffRequest"]] = relationship(
        "TimeOffRequest", back_populates="employee", cascade="all, delete-orphan"
    )
    payslips: Mapped[list["Payslip"]] = relationship("Payslip", back_populates="employee", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def roles(self) -> list[str]:
        from sqlalchemy.orm.attributes import instance_state
        state = instance_state(self)
        if 'user' in state.dict and self.user:
            return self.user.roles
        return []

    def __repr__(self) -> str:
        return f"<Employee {self.employee_number}: {self.full_name}>"
