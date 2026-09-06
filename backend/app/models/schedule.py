"""
WorkingSchedule model — Weekly work schedule assigned to contracts.
Hours are computed dynamically from per-day start/end times.
"""

import enum
from datetime import time, datetime
from sqlalchemy import String, Integer, Time, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ScheduleStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class WorkingSchedule(Base):
    __tablename__ = "working_schedules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    company: Mapped[str] = mapped_column(String(100), nullable=False, default="My Company")
    timezone: Mapped[str] = mapped_column(String(60), nullable=False, default="Asia/Kolkata")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    # Monday
    monday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    monday_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    # Tuesday
    tuesday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    tuesday_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    # Wednesday
    wednesday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    wednesday_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    # Thursday
    thursday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    thursday_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    # Friday
    friday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    friday_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    # Saturday
    saturday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    saturday_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    # Sunday
    sunday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    sunday_end: Mapped[time | None] = mapped_column(Time, nullable=True)

    break_duration_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    contracts: Mapped[list["Contract"]] = relationship("Contract", back_populates="working_schedule")

    @property
    def working_days(self) -> list[str]:
        """Return list of days that have a schedule."""
        days = []
        for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]:
            start = getattr(self, f"{day}_start")
            end = getattr(self, f"{day}_end")
            if start is not None and end is not None:
                days.append(day)
        return days

    @property
    def working_days_count(self) -> int:
        """Number of working days per week."""
        return len(self.working_days)

    @property
    def total_weekly_hours(self) -> float:
        """Dynamically compute total weekly working hours minus breaks."""
        total_minutes = 0.0
        for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]:
            start = getattr(self, f"{day}_start")
            end = getattr(self, f"{day}_end")
            if start is not None and end is not None:
                start_minutes = start.hour * 60 + start.minute
                end_minutes = end.hour * 60 + end.minute
                day_minutes = end_minutes - start_minutes - self.break_duration_minutes
                if day_minutes > 0:
                    total_minutes += day_minutes
        return round(total_minutes / 60.0, 2)

    def __repr__(self) -> str:
        return f"<WorkingSchedule {self.name}: {self.total_weekly_hours}h/week>"
