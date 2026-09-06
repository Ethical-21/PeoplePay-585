"""
Working Schedules router — CRUD with search, filter, and deletion protection.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func as sql_func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.schedule import WorkingSchedule
from app.models.contract import Contract
from app.auth.dependencies import require_min_role
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate, ScheduleResponse

router = APIRouter(prefix="/schedules", tags=["Working Schedules"])


def _schedule_to_response(schedule: WorkingSchedule, contracts_count: int = 0) -> ScheduleResponse:
    """Convert a WorkingSchedule ORM instance to a ScheduleResponse with contract count."""
    data = {
        "id": schedule.id,
        "name": schedule.name,
        "company": schedule.company,
        "timezone": schedule.timezone,
        "status": schedule.status or "active",
        "monday_start": schedule.monday_start,
        "monday_end": schedule.monday_end,
        "tuesday_start": schedule.tuesday_start,
        "tuesday_end": schedule.tuesday_end,
        "wednesday_start": schedule.wednesday_start,
        "wednesday_end": schedule.wednesday_end,
        "thursday_start": schedule.thursday_start,
        "thursday_end": schedule.thursday_end,
        "friday_start": schedule.friday_start,
        "friday_end": schedule.friday_end,
        "saturday_start": schedule.saturday_start,
        "saturday_end": schedule.saturday_end,
        "sunday_start": schedule.sunday_start,
        "sunday_end": schedule.sunday_end,
        "break_duration_minutes": schedule.break_duration_minutes,
        "total_weekly_hours": schedule.total_weekly_hours,
        "working_days_count": schedule.working_days_count,
        "working_days": schedule.working_days,
        "assigned_contracts_count": contracts_count,
        "created_at": schedule.created_at,
    }
    return ScheduleResponse(**data)


@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(
    search: str | None = Query(None, description="Search by name or company"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    company: str | None = Query(None, description="Filter by company"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.EMPLOYEE)),
):
    """List all working schedules with optional search and filtering."""
    query = select(WorkingSchedule)

    # Search
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                WorkingSchedule.name.ilike(search_term),
                WorkingSchedule.company.ilike(search_term),
            )
        )

    # Filter by status
    if status_filter and status_filter in ("active", "inactive"):
        query = query.where(WorkingSchedule.status == status_filter)

    # Filter by company
    if company:
        query = query.where(WorkingSchedule.company.ilike(f"%{company}%"))

    query = query.order_by(WorkingSchedule.name)
    result = await db.execute(query)
    schedules = result.scalars().all()

    # Get contract counts for each schedule
    responses = []
    for s in schedules:
        count_result = await db.execute(
            select(sql_func.count(Contract.id)).where(Contract.working_schedule_id == s.id)
        )
        count = count_result.scalar() or 0
        responses.append(_schedule_to_response(s, count))

    return responses


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.EMPLOYEE)),
):
    result = await db.execute(select(WorkingSchedule).where(WorkingSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Working schedule not found.")

    count_result = await db.execute(
        select(sql_func.count(Contract.id)).where(Contract.working_schedule_id == schedule.id)
    )
    count = count_result.scalar() or 0

    return _schedule_to_response(schedule, count)


@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    """Create a new working schedule."""
    existing = await db.execute(select(WorkingSchedule).where(WorkingSchedule.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A schedule with this name already exists.")

    # Validate at least one working day
    dump = data.model_dump()
    has_day = False
    for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]:
        start = dump.get(f"{day}_start")
        end = dump.get(f"{day}_end")
        if start is not None and end is not None:
            has_day = True
            # Validate end > start
            if end <= start:
                raise HTTPException(
                    status_code=422,
                    detail=f"End time must be after start time for {day.capitalize()}."
                )

    if not has_day:
        raise HTTPException(
            status_code=422,
            detail="Schedule must have at least one working day."
        )

    # Validate status value
    status_val = dump.pop("status", "active")
    if status_val not in ("active", "inactive"):
        status_val = "active"
    
    schedule = WorkingSchedule(**dump, status=status_val)
    db.add(schedule)
    await db.flush()
    await db.refresh(schedule)
    return _schedule_to_response(schedule, 0)


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    data: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    result = await db.execute(select(WorkingSchedule).where(WorkingSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Working schedule not found.")

    update_data = data.model_dump(exclude_unset=True)

    # Check name uniqueness if name is being changed
    if "name" in update_data and update_data["name"] != schedule.name:
        existing = await db.execute(
            select(WorkingSchedule).where(
                WorkingSchedule.name == update_data["name"],
                WorkingSchedule.id != schedule_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="A schedule with this name already exists.")

    # Validate day times if provided
    for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]:
        start_key = f"{day}_start"
        end_key = f"{day}_end"
        start_val = update_data.get(start_key, getattr(schedule, start_key))
        end_val = update_data.get(end_key, getattr(schedule, end_key))
        if start_val is not None and end_val is not None and end_val <= start_val:
            raise HTTPException(
                status_code=422,
                detail=f"End time must be after start time for {day.capitalize()}."
            )

    # Validate status string if provided
    if "status" in update_data and update_data["status"] is not None:
        if update_data["status"] not in ("active", "inactive"):
            raise HTTPException(status_code=422, detail="Invalid status value. Use 'active' or 'inactive'.")

    for field, value in update_data.items():
        setattr(schedule, field, value)

    await db.flush()
    await db.refresh(schedule)

    count_result = await db.execute(
        select(sql_func.count(Contract.id)).where(Contract.working_schedule_id == schedule.id)
    )
    count = count_result.scalar() or 0

    return _schedule_to_response(schedule, count)


@router.delete("/{schedule_id}", status_code=status.HTTP_200_OK)
async def delete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    """Delete a working schedule. Prevents deletion if assigned to contracts."""
    result = await db.execute(select(WorkingSchedule).where(WorkingSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Working schedule not found.")

    # Check for assigned contracts
    count_result = await db.execute(
        select(sql_func.count(Contract.id)).where(Contract.working_schedule_id == schedule.id)
    )
    count = count_result.scalar() or 0

    if count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete this schedule. It is currently assigned to {count} contract(s). "
                   f"Please reassign or remove the schedule from those contracts first."
        )

    await db.delete(schedule)
    await db.flush()
    return {"detail": f"Schedule '{schedule.name}' deleted successfully."}
