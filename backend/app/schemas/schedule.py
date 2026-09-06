"""
Working Schedule schemas.
"""

from datetime import time, datetime
from pydantic import BaseModel, Field


class ScheduleDayInfo(BaseModel):
    """Represents one working day in the schedule detail."""
    day: str
    start_time: str | None = None
    end_time: str | None = None
    break_minutes: int = 60
    hours: float = 0.0


class ScheduleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    company: str = Field(default="My Company", max_length=100)
    timezone: str = Field(default="Asia/Kolkata", max_length=60)
    status: str = Field(default="active")
    monday_start: time | None = None
    monday_end: time | None = None
    tuesday_start: time | None = None
    tuesday_end: time | None = None
    wednesday_start: time | None = None
    wednesday_end: time | None = None
    thursday_start: time | None = None
    thursday_end: time | None = None
    friday_start: time | None = None
    friday_end: time | None = None
    saturday_start: time | None = None
    saturday_end: time | None = None
    sunday_start: time | None = None
    sunday_end: time | None = None
    break_duration_minutes: int = Field(default=60, ge=0, le=480)


class ScheduleUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    company: str | None = Field(None, max_length=100)
    timezone: str | None = Field(None, max_length=60)
    status: str | None = None
    monday_start: time | None = None
    monday_end: time | None = None
    tuesday_start: time | None = None
    tuesday_end: time | None = None
    wednesday_start: time | None = None
    wednesday_end: time | None = None
    thursday_start: time | None = None
    thursday_end: time | None = None
    friday_start: time | None = None
    friday_end: time | None = None
    saturday_start: time | None = None
    saturday_end: time | None = None
    sunday_start: time | None = None
    sunday_end: time | None = None
    break_duration_minutes: int | None = Field(None, ge=0, le=480)


class ScheduleResponse(BaseModel):
    id: int
    name: str
    company: str
    timezone: str
    status: str
    monday_start: time | None
    monday_end: time | None
    tuesday_start: time | None
    tuesday_end: time | None
    wednesday_start: time | None
    wednesday_end: time | None
    thursday_start: time | None
    thursday_end: time | None
    friday_start: time | None
    friday_end: time | None
    saturday_start: time | None
    saturday_end: time | None
    sunday_start: time | None
    sunday_end: time | None
    break_duration_minutes: int
    total_weekly_hours: float
    working_days_count: int
    working_days: list[str]
    assigned_contracts_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
