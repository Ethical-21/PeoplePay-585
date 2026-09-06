"""
Attendance router — Full CRUD with search, filters, overtime, and employee self-service.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime as dt, timezone

from app.database import get_db
from app.models.user import User, UserRole
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee
from app.models.contract import Contract, ContractStatus
from app.models.schedule import WorkingSchedule
from app.auth.dependencies import require_min_role, get_current_user
from app.schemas.attendance import AttendanceCreate, AttendanceUpdate, AttendanceResponse

router = APIRouter(prefix="/attendance", tags=["Attendance"])


# ── Helpers ──

def _get_day_schedule(schedule: WorkingSchedule, weekday: int):
    """Return (start_time, end_time) for a given weekday (0=Monday)."""
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_name = days[weekday]
    start = getattr(schedule, f"{day_name}_start", None)
    end = getattr(schedule, f"{day_name}_end", None)
    return start, end


def _calc_overtime(worked_hours: float | None, schedule: WorkingSchedule | None, weekday: int) -> float:
    """Calculate overtime hours based on worked hours vs schedule expected hours."""
    if not worked_hours or not schedule:
        return 0.0
    start, end = _get_day_schedule(schedule, weekday)
    if not start or not end:
        return 0.0  # Not a working day, any hours could be considered OT but keep simple
    from datetime import datetime, timedelta
    start_dt = datetime.combine(date.today(), start)
    end_dt = datetime.combine(date.today(), end)
    expected = (end_dt - start_dt).total_seconds() / 3600.0
    break_mins = getattr(schedule, 'break_duration_minutes', 60) or 60
    expected -= break_mins / 60.0
    overtime = worked_hours - expected
    return round(max(0.0, overtime), 2)


async def _get_employee_schedule(db, employee_id: int):
    """Get the working schedule from the employee's active contract."""
    result = await db.execute(
        select(Contract)
        .options(selectinload(Contract.working_schedule))
        .where(
            Contract.employee_id == employee_id,
            Contract.status == ContractStatus.ACTIVE,
        )
        .order_by(Contract.start_date.desc())
        .limit(1)
    )
    contract = result.scalar_one_or_none()
    if contract and contract.working_schedule:
        return contract.working_schedule
    return None


async def _enrich_response(a: Attendance, db, schedule_cache: dict | None = None, manager_cache: dict | None = None) -> AttendanceResponse:
    """Build an enriched AttendanceResponse from an Attendance record."""
    resp = AttendanceResponse.model_validate(a)

    if a.employee:
        resp.employee_name = f"{a.employee.first_name} {a.employee.last_name}"
        resp.employee_number = a.employee.employee_number
        if a.employee.department:
            resp.department_name = a.employee.department.name
            # Populate manager name from department's assigned manager
            dept = a.employee.department
            if dept.manager_id:
                mgr_name = None
                if manager_cache is not None and dept.manager_id in manager_cache:
                    mgr_name = manager_cache[dept.manager_id]
                else:
                    mgr_result = await db.execute(
                        select(Employee).where(Employee.id == dept.manager_id)
                    )
                    mgr = mgr_result.scalar_one_or_none()
                    if mgr:
                        mgr_name = f"{mgr.first_name} {mgr.last_name}"
                    if manager_cache is not None:
                        manager_cache[dept.manager_id] = mgr_name
                resp.manager_name = mgr_name

    # Overtime calculation
    if a.worked_hours and a.date:
        if getattr(a, 'overtime_hours', None) is not None:
            resp.overtime_hours = a.overtime_hours
        else:
            schedule = None
            if schedule_cache is not None and a.employee_id in schedule_cache:
                schedule = schedule_cache[a.employee_id]
            elif schedule_cache is not None:
                schedule = await _get_employee_schedule(db, a.employee_id)
                schedule_cache[a.employee_id] = schedule
            else:
                schedule = await _get_employee_schedule(db, a.employee_id)
            resp.overtime_hours = _calc_overtime(a.worked_hours, schedule, a.date.weekday())
    else:
        resp.overtime_hours = getattr(a, 'overtime_hours', 0.0)

    return resp


# ── List Attendance ──

@router.get("", response_model=list[AttendanceResponse])
async def list_attendance(
    employee_id: int | None = Query(None),
    date_filter: date | None = Query(None, alias="date"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List attendance records with optional filters and search."""
    query = select(Attendance).options(
        selectinload(Attendance.employee).selectinload(Employee.department)
    )

    # Employees can only see their own attendance
    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1):
        emp_result = await db.execute(
            select(Employee).where(Employee.user_id == current_user.id)
        )
        emp = emp_result.scalar_one_or_none()
        if emp:
            query = query.where(Attendance.employee_id == emp.id)
        else:
            return []
    elif employee_id:
        query = query.where(Attendance.employee_id == employee_id)

    # Date filters
    if date_filter:
        query = query.where(Attendance.date == date_filter)
    else:
        if date_from:
            query = query.where(Attendance.date >= date_from)
        if date_to:
            query = query.where(Attendance.date <= date_to)

    # Search by employee name or notes
    if search:
        search_term = f"%{search}%"
        query = query.join(Attendance.employee, isouter=True).where(
            or_(
                Employee.first_name.ilike(search_term),
                Employee.last_name.ilike(search_term),
                Employee.employee_number.ilike(search_term),
                Attendance.notes.ilike(search_term),
            )
        )

    query = query.order_by(Attendance.date.desc(), Attendance.check_in.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    records = result.scalars().unique().all()

    schedule_cache: dict = {}
    manager_cache: dict = {}
    responses = []
    for a in records:
        resp = await _enrich_response(a, db, schedule_cache, manager_cache)
        responses.append(resp)
    return responses


# ── Employee Self-Service Endpoints ──

async def _get_employee_for_user(db: AsyncSession, user: User) -> Employee:
    """Helper: resolve current user → employee record."""
    result = await db.execute(
        select(Employee).where(Employee.user_id == user.id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(
            status_code=400,
            detail="No employee profile is linked to your user account.",
        )
    return emp


@router.get("/my-status", response_model=None)
async def my_attendance_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's attendance status for today."""
    emp = await _get_employee_for_user(db, current_user)
    today = date.today()

    result = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == emp.id,
            Attendance.date == today,
        ).order_by(Attendance.check_in.desc())
    )
    records = result.scalars().all()

    active_record = next((r for r in records if r.check_out is None), None)
    total_worked = sum((r.worked_hours or 0.0) for r in records if r.worked_hours)

    if not active_record and not records:
        return {
            "status": "not_checked_in",
            "employee_id": emp.id,
            "employee_name": emp.full_name,
            "date": str(today),
            "check_in": None,
            "check_out": None,
            "worked_hours": None,
            "total_worked_hours": 0.0,
        }

    if not active_record:
        # Session is closed for the day (unique constraint prevents multiple per day)
        last_record = records[0]
        return {
            "status": "checked_out",
            "employee_id": emp.id,
            "employee_name": emp.full_name,
            "date": str(today),
            "check_in": last_record.check_in.isoformat() if last_record.check_in else None,
            "check_out": last_record.check_out.isoformat() if last_record.check_out else None,
            "worked_hours": last_record.worked_hours,
            "total_worked_hours": total_worked,
            "attendance_id": last_record.id,
        }

    return {
        "status": "checked_in",
        "employee_id": emp.id,
        "employee_name": emp.full_name,
        "date": str(today),
        "check_in": active_record.check_in.isoformat() if active_record.check_in else None,
        "check_out": None,
        "worked_hours": active_record.worked_hours,
        "total_worked_hours": total_worked,
        "attendance_id": active_record.id,
    }


@router.post("/check-in")
async def self_check_in(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Employee self-service check-in for today."""
    emp = await _get_employee_for_user(db, current_user)
    today = date.today()
    now = dt.now(timezone.utc)

    # Check if already checked in (has an active session)
    existing = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == emp.id,
            Attendance.date == today,
            Attendance.check_out.is_(None)
        )
    )
    existing_record = existing.scalars().first()
    if existing_record:
        raise HTTPException(
            status_code=409,
            detail="You already have an active check-in session.",
        )

    # Determine status (late detection using schedule)
    att_status = AttendanceStatus.PRESENT
    schedule = await _get_employee_schedule(db, emp.id)
    if schedule:
        expected_start, _ = _get_day_schedule(schedule, today.weekday())
        if expected_start:
            from datetime import timedelta
            expected_dt = dt.combine(today, expected_start)
            grace_dt = expected_dt + timedelta(minutes=15)
            # Compare in local time (simplified — using UTC check_in vs schedule time)
            local_now = now  # In production, convert based on schedule timezone
            check_in_time_for_compare = dt.combine(today, now.time())
            if check_in_time_for_compare > grace_dt:
                att_status = AttendanceStatus.LATE

    attendance = Attendance(
        employee_id=emp.id,
        date=today,
        check_in=now,
        status=att_status,
    )
    db.add(attendance)
    await db.flush()
    await db.refresh(attendance)

    return {
        "message": f"Checked in successfully at {now.strftime('%H:%M:%S UTC')}.",
        "attendance_id": attendance.id,
        "check_in": attendance.check_in.isoformat(),
        "status": attendance.status.value,
    }


@router.post("/check-out")
async def self_check_out(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Employee self-service check-out for today."""
    emp = await _get_employee_for_user(db, current_user)
    today = date.today()
    now = dt.now(timezone.utc)

    result = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == emp.id,
            Attendance.date == today,
            Attendance.check_out.is_(None)
        )
    )
    attendance = result.scalar_one_or_none()
    if not attendance:
        raise HTTPException(
            status_code=400,
            detail="You don't have an active session to check out from.",
        )

    attendance.check_out = now
    attendance.worked_hours = attendance.compute_worked_hours()
    
    # Calculate and persist overtime
    schedule = await _get_employee_schedule(db, emp.id)
    attendance.overtime_hours = _calc_overtime(attendance.worked_hours, schedule, today.weekday())

    await db.flush()
    await db.refresh(attendance)

    return {
        "message": f"Checked out successfully. Worked {attendance.worked_hours:.2f} hours.",
        "attendance_id": attendance.id,
        "check_in": attendance.check_in.isoformat(),
        "check_out": attendance.check_out.isoformat(),
        "worked_hours": attendance.worked_hours,
    }


# ── Get Single Attendance ──

@router.get("/{attendance_id}", response_model=AttendanceResponse)
async def get_attendance(
    attendance_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single attendance record by ID with full enrichment."""
    result = await db.execute(
        select(Attendance)
        .options(
            selectinload(Attendance.employee).selectinload(Employee.department)
        )
        .where(Attendance.id == attendance_id)
    )
    attendance = result.scalar_one_or_none()
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    # RBAC: employees can only see their own
    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1):
        emp_result = await db.execute(
            select(Employee).where(Employee.user_id == current_user.id)
        )
        emp = emp_result.scalar_one_or_none()
        if not emp or attendance.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="You can only view your own attendance.")

    resp = await _enrich_response(attendance, db)

    # Add manager name from department or contract context
    if attendance.employee and attendance.employee.department:
        # Try to find department manager (first employee with a manager-like title)
        # Simple approach: just return department name for now
        pass

    return resp


# ── Create Attendance ──

@router.post("", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
async def create_attendance(
    data: AttendanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    """Record attendance for an employee."""
    # Validate employee exists
    emp_result = await db.execute(
        select(Employee).options(selectinload(Employee.department)).where(Employee.id == data.employee_id)
    )
    emp = emp_result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=400, detail="Employee not found.")

    # Check for active session if we are trying to check in without a checkout
    if not data.check_out:
        existing = await db.execute(
            select(Attendance).where(
                Attendance.employee_id == data.employee_id,
                Attendance.date == data.date,
                Attendance.check_out.is_(None)
            )
        )
        if existing.scalars().first():
            raise HTTPException(
                status_code=409,
                detail=f"An active attendance session already exists for this employee on {data.date}.",
            )

    attendance = Attendance(**data.model_dump())
    # Auto-calculate worked hours
    attendance.worked_hours = attendance.compute_worked_hours()

    # Calculate overtime if checking out
    if attendance.worked_hours:
        schedule = await _get_employee_schedule(db, data.employee_id)
        attendance.overtime_hours = _calc_overtime(attendance.worked_hours, schedule, data.date.weekday())

    # Auto-detect late status using schedule
    if data.status == AttendanceStatus.PRESENT:
        schedule = await _get_employee_schedule(db, data.employee_id)
        if schedule:
            expected_start, _ = _get_day_schedule(schedule, data.date.weekday())
            if expected_start and data.check_in:
                from datetime import datetime as datetime_cls
                check_in_time = data.check_in.time()
                # Late if check-in is more than 15 minutes after expected start
                from datetime import timedelta
                expected_dt = datetime_cls.combine(data.date, expected_start)
                grace_dt = expected_dt + timedelta(minutes=15)
                check_in_dt = datetime_cls.combine(data.date, check_in_time)
                if check_in_dt > grace_dt:
                    attendance.status = AttendanceStatus.LATE

    db.add(attendance)
    await db.flush()
    await db.refresh(attendance, attribute_names=["employee"])
    # Reload with department
    result = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.employee).selectinload(Employee.department))
        .where(Attendance.id == attendance.id)
    )
    attendance = result.scalar_one()
    return await _enrich_response(attendance, db)


# ── Update Attendance ──

@router.put("/{attendance_id}", response_model=AttendanceResponse)
async def update_attendance(
    attendance_id: int,
    data: AttendanceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    """Update attendance (e.g., correct check-in/check-out time)."""
    result = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.employee).selectinload(Employee.department))
        .where(Attendance.id == attendance_id)
    )
    attendance = result.scalar_one_or_none()
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    update_data = data.model_dump(exclude_unset=True)

    # Track if this is a manual correction
    correction_note = ""
    if "check_in" in update_data or "check_out" in update_data:
        correction_note = f"Manually corrected by {current_user.full_name} on {dt.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"

    for field, value in update_data.items():
        setattr(attendance, field, value)

    # Recalculate worked hours and overtime
    attendance.worked_hours = attendance.compute_worked_hours()
    if attendance.worked_hours:
        schedule = await _get_employee_schedule(db, attendance.employee_id)
        attendance.overtime_hours = _calc_overtime(attendance.worked_hours, schedule, attendance.date.weekday())

    # Append correction note if applicable
    if correction_note:
        existing_notes = attendance.notes or ""
        if existing_notes:
            attendance.notes = f"{existing_notes}\n{correction_note}"
        else:
            attendance.notes = correction_note

    await db.flush()
    await db.refresh(attendance)
    # Reload with relationships
    result = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.employee).selectinload(Employee.department))
        .where(Attendance.id == attendance.id)
    )
    attendance = result.scalar_one()
    return await _enrich_response(attendance, db)


# ── Delete Attendance ──

@router.delete("/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attendance(
    attendance_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    """Delete an attendance record (HR Manager+ only)."""
    result = await db.execute(select(Attendance).where(Attendance.id == attendance_id))
    attendance = result.scalar_one_or_none()
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found.")
    await db.delete(attendance)


