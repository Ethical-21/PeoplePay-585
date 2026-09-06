"""
Time Off models — Types, Allocations, and Requests with approval workflow.
"""

import enum
from datetime import date, datetime
from sqlalchemy import (
    String, Integer, Float, Date, DateTime, Boolean, Text, Enum, ForeignKey,
    UniqueConstraint, CheckConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TimeOffUnit(str, enum.Enum):
    DAYS = "DAYS"
    HOURS = "HOURS"


class TimeOffType(Base):
    __tablename__ = "time_off_types"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    color: Mapped[str | None] = mapped_column(String(30), nullable=True)  # Hex or named color
    unit: Mapped[TimeOffUnit] = mapped_column(
        Enum(TimeOffUnit, name="timeoff_unit_enum", create_constraint=False),
        nullable=False,
        default=TimeOffUnit.DAYS,
    )
    requires_allocation: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    approval: Mapped[str] = mapped_column(String(50), default="Manager", nullable=False)
    work_entry_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    configuration_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    allocations: Mapped[list["TimeOffAllocation"]] = relationship(
        "TimeOffAllocation", back_populates="time_off_type"
    )
    requests: Mapped[list["TimeOffRequest"]] = relationship(
        "TimeOffRequest", back_populates="time_off_type"
    )

    def __repr__(self) -> str:
        return f"<TimeOffType {self.code}: {self.name}>"


class TimeOffStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REFUSED = "refused"
    CANCELLED = "cancelled"


class TimeOffAllocation(Base):
    __tablename__ = "time_off_allocations"
    __table_args__ = (
        UniqueConstraint(
            "employee_id", "time_off_type_id", "year",
            name="uq_allocation_employee_type_year"
        ),
        CheckConstraint("total_days > 0", name="ck_allocation_total_positive"),
        CheckConstraint("used_days >= 0", name="ck_allocation_used_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    time_off_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("time_off_types.id", ondelete="CASCADE"), nullable=False
    )
    total_days: Mapped[float] = mapped_column(Float, nullable=False)
    used_days: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[TimeOffStatus] = mapped_column(
        Enum(TimeOffStatus, name="timeoff_status_enum", create_constraint=False),
        nullable=False,
        default=TimeOffStatus.APPROVED, # Default to approved to support legacy data
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    approver_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="time_off_allocations", foreign_keys=[employee_id])
    time_off_type: Mapped["TimeOffType"] = relationship("TimeOffType", back_populates="allocations")
    approver: Mapped["Employee"] = relationship("Employee", foreign_keys=[approver_id])

    @property
    def remaining_days(self) -> float:
        return self.total_days - self.used_days

    def __repr__(self) -> str:
        return f"<TimeOffAllocation Employee#{self.employee_id} {self.remaining_days}/{self.total_days} days>"

class TimeOffRequest(Base):
    __tablename__ = "time_off_requests"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="ck_timeoff_dates_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    time_off_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("time_off_types.id", ondelete="CASCADE"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TimeOffStatus] = mapped_column(
        Enum(TimeOffStatus, name="timeoff_status_enum", create_constraint=True),
        nullable=False,
        default=TimeOffStatus.DRAFT,
    )
    approved_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="time_off_requests")
    time_off_type: Mapped["TimeOffType"] = relationship("TimeOffType", back_populates="requests")

    def __repr__(self) -> str:
        return f"<TimeOffRequest Employee#{self.employee_id} {self.start_date}-{self.end_date} ({self.status.value})>"
