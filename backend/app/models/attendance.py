"""
Attendance model — Daily check-in/check-out records per employee.
"""

import enum
from datetime import date, datetime
from sqlalchemy import (
    Integer, Date, DateTime, Float, String, Text, Enum, ForeignKey,
    UniqueConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    LATE = "late"
    HALF_DAY = "half_day"
    ABSENT = "absent"


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    check_in: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    check_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    worked_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    overtime_hours: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    status: Mapped[AttendanceStatus] = mapped_column(
        Enum(AttendanceStatus, name="attendance_status_enum", create_constraint=True),
        nullable=False,
        default=AttendanceStatus.PRESENT,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="attendance_records")

    def compute_worked_hours(self) -> float | None:
        """Calculate worked hours from check_in and check_out."""
        if self.check_in and self.check_out:
            delta = self.check_out - self.check_in
            return round(delta.total_seconds() / 3600.0, 2)
        return None

    def __repr__(self) -> str:
        return f"<Attendance Employee#{self.employee_id} {self.date} ({self.status.value})>"
