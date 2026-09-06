"""
Time Off router — Types, Allocations, Requests with approval workflow.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, or_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.timeoff import (
    TimeOffType, TimeOffAllocation, TimeOffRequest, TimeOffStatus, TimeOffUnit,
)
from app.auth.dependencies import require_min_role, get_current_user
from app.schemas.timeoff import (
    TimeOffTypeCreate, TimeOffTypeUpdate, TimeOffTypeResponse,
    TimeOffAllocationCreate, TimeOffAllocationUpdate, TimeOffAllocationResponse,
    TimeOffRequestCreate, TimeOffRequestUpdate, TimeOffRequestResponse,
)

router = APIRouter(prefix="/timeoff", tags=["Time Off"])


# ── Time Off Types ──

@router.get("/types", response_model=list[TimeOffTypeResponse])
async def list_types(
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(TimeOffType)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                TimeOffType.name.ilike(search_pattern),
                TimeOffType.code.ilike(search_pattern)
            )
        )
    result = await db.execute(query.order_by(TimeOffType.name))
    return [TimeOffTypeResponse.model_validate(t) for t in result.scalars().all()]


@router.get("/types/{type_id}", response_model=TimeOffTypeResponse)
async def get_type(
    type_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(TimeOffType).where(TimeOffType.id == type_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Time off type not found.")
    return TimeOffTypeResponse.model_validate(t)


@router.post("/types", response_model=TimeOffTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_type(
    data: TimeOffTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.ADMIN)),
):
    existing = await db.execute(select(TimeOffType).where(TimeOffType.code == data.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A time off type with this code already exists.")

    dump = data.model_dump()
    # Convert unit string to TimeOffUnit enum
    unit_val = dump.pop("unit", "DAYS").upper()
    dump["unit"] = TimeOffUnit(unit_val)
    
    tt = TimeOffType(**dump)
    db.add(tt)
    await db.flush()
    await db.refresh(tt)
    return TimeOffTypeResponse.model_validate(tt)


@router.put("/types/{type_id}", response_model=TimeOffTypeResponse)
async def update_type(
    type_id: int,
    data: TimeOffTypeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.ADMIN)),
):
    result = await db.execute(select(TimeOffType).where(TimeOffType.id == type_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Time off type not found.")

    update_data = data.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != t.code:
        existing = await db.execute(select(TimeOffType).where(TimeOffType.code == update_data["code"]))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="A time off type with this code already exists.")

    # Convert unit string to TimeOffUnit enum if present
    if "unit" in update_data and update_data["unit"] is not None:
        update_data["unit"] = TimeOffUnit(update_data["unit"].upper())

    for field, value in update_data.items():
        setattr(t, field, value)

    await db.flush()
    await db.refresh(t)
    return TimeOffTypeResponse.model_validate(t)


@router.delete("/types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_type(
    type_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.ADMIN)),
):
    result = await db.execute(select(TimeOffType).where(TimeOffType.id == type_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Time off type not found.")
    await db.delete(t)
    await db.flush()


# ── Allocations ──

def enrich_allocation(alloc: TimeOffAllocation) -> TimeOffAllocationResponse:
    obj = TimeOffAllocationResponse.model_validate(alloc)
    if alloc.employee:
        obj.employee_name = f"{alloc.employee.first_name} {alloc.employee.last_name}"
    if alloc.time_off_type:
        obj.type_name = alloc.time_off_type.name
    if alloc.approver:
        obj.approver_name = f"{alloc.approver.first_name} {alloc.approver.last_name}"
    return obj


@router.get("/allocations", response_model=list[TimeOffAllocationResponse])
async def list_allocations(
    search: str | None = Query(None),
    employee_id: int | None = Query(None),
    year: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(TimeOffAllocation).options(
        joinedload(TimeOffAllocation.employee),
        joinedload(TimeOffAllocation.time_off_type),
        joinedload(TimeOffAllocation.approver)
    )

    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1):
        emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        emp = emp_result.scalar_one_or_none()
        if emp:
            query = query.where(TimeOffAllocation.employee_id == emp.id)
        else:
            return []
    elif employee_id:
        query = query.where(TimeOffAllocation.employee_id == employee_id)

    if year:
        query = query.where(TimeOffAllocation.year == year)

    if search:
        search_pattern = f"%{search}%"
        query = query.join(TimeOffAllocation.employee).join(TimeOffAllocation.time_off_type).where(
            or_(
                Employee.first_name.ilike(search_pattern),
                Employee.last_name.ilike(search_pattern),
                TimeOffType.name.ilike(search_pattern),
                cast(TimeOffAllocation.status, String).ilike(search_pattern)
            )
        )

    result = await db.execute(query.order_by(TimeOffAllocation.created_at.desc()))
    return [enrich_allocation(a) for a in result.scalars().all()]


@router.get("/allocations/{allocation_id}", response_model=TimeOffAllocationResponse)
async def get_allocation(
    allocation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(TimeOffAllocation).options(
        joinedload(TimeOffAllocation.employee),
        joinedload(TimeOffAllocation.time_off_type),
        joinedload(TimeOffAllocation.approver)
    ).where(TimeOffAllocation.id == allocation_id)
    
    result = await db.execute(query)
    alloc = result.scalar_one_or_none()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found.")
        
    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1):
        emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        emp = emp_result.scalar_one_or_none()
        if not emp or alloc.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this allocation.")

    return enrich_allocation(alloc)


@router.post("/allocations", response_model=TimeOffAllocationResponse, status_code=status.HTTP_201_CREATED)
async def create_allocation(
    data: TimeOffAllocationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    existing = await db.execute(
        select(TimeOffAllocation).where(
            TimeOffAllocation.employee_id == data.employee_id,
            TimeOffAllocation.time_off_type_id == data.time_off_type_id,
            TimeOffAllocation.year == data.year,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="An allocation for this employee, leave type, and year already exists.",
        )

    allocation = TimeOffAllocation(**data.model_dump())
    if not data.status:
        allocation.status = TimeOffStatus.APPROVED
    db.add(allocation)
    await db.flush()
    await db.refresh(allocation)
    
    # Fetch with joins for response
    query = select(TimeOffAllocation).options(
        joinedload(TimeOffAllocation.employee),
        joinedload(TimeOffAllocation.time_off_type),
        joinedload(TimeOffAllocation.approver)
    ).where(TimeOffAllocation.id == allocation.id)
    result = await db.execute(query)
    return enrich_allocation(result.scalar_one())


@router.put("/allocations/{allocation_id}", response_model=TimeOffAllocationResponse)
async def update_allocation(
    allocation_id: int,
    data: TimeOffAllocationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    query = select(TimeOffAllocation).options(
        joinedload(TimeOffAllocation.employee),
        joinedload(TimeOffAllocation.time_off_type),
        joinedload(TimeOffAllocation.approver)
    ).where(TimeOffAllocation.id == allocation_id)
    result = await db.execute(query)
    alloc = result.scalar_one_or_none()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(alloc, field, value)

    await db.flush()
    await db.refresh(alloc)
    return enrich_allocation(alloc)
    
@router.post("/allocations/{allocation_id}/approve", response_model=TimeOffAllocationResponse)
async def approve_allocation(
    allocation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    query = select(TimeOffAllocation).options(
        joinedload(TimeOffAllocation.employee),
        joinedload(TimeOffAllocation.time_off_type),
        joinedload(TimeOffAllocation.approver)
    ).where(TimeOffAllocation.id == allocation_id)
    result = await db.execute(query)
    alloc = result.scalar_one_or_none()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found.")

    # Find the current user's employee record to set as approver
    emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    current_emp = emp_result.scalar_one_or_none()

    alloc.status = TimeOffStatus.APPROVED
    if current_emp:
        alloc.approver_id = current_emp.id
    await db.flush()
    await db.refresh(alloc)
    return enrich_allocation(alloc)

@router.post("/allocations/{allocation_id}/refuse", response_model=TimeOffAllocationResponse)
async def refuse_allocation(
    allocation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    query = select(TimeOffAllocation).options(
        joinedload(TimeOffAllocation.employee),
        joinedload(TimeOffAllocation.time_off_type),
        joinedload(TimeOffAllocation.approver)
    ).where(TimeOffAllocation.id == allocation_id)
    result = await db.execute(query)
    alloc = result.scalar_one_or_none()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found.")

    emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    current_emp = emp_result.scalar_one_or_none()

    alloc.status = TimeOffStatus.REFUSED
    if current_emp:
        alloc.approver_id = current_emp.id
    await db.flush()
    await db.refresh(alloc)
    return enrich_allocation(alloc)

@router.delete("/allocations/{allocation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_allocation(
    allocation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    result = await db.execute(select(TimeOffAllocation).where(TimeOffAllocation.id == allocation_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Allocation not found.")
    await db.delete(a)
    await db.flush()


# ── Requests ──

async def enrich_request(req: TimeOffRequest, db: AsyncSession) -> TimeOffRequestResponse:
    obj = TimeOffRequestResponse.model_validate(req)
    if req.employee:
        obj.employee_name = f"{req.employee.first_name} {req.employee.last_name}"
    if req.time_off_type:
        obj.type_name = req.time_off_type.name
        
    if req.approved_by:
        user_res = await db.execute(select(User).where(User.id == req.approved_by))
        user = user_res.scalar_one_or_none()
        if user:
            obj.approver_name = user.full_name
            
    # Try to find the related allocation
    alloc_res = await db.execute(
        select(TimeOffAllocation).where(
            TimeOffAllocation.employee_id == req.employee_id,
            TimeOffAllocation.time_off_type_id == req.time_off_type_id,
            TimeOffAllocation.year == req.start_date.year,
        )
    )
    alloc = alloc_res.scalar_one_or_none()
    if alloc and alloc.time_off_type:
        obj.allocation_name = f"{alloc.time_off_type.name} {alloc.year}"
        
    return obj


@router.get("/requests", response_model=list[TimeOffRequestResponse])
async def list_requests(
    search: str | None = Query(None),
    employee_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(TimeOffRequest).options(
        joinedload(TimeOffRequest.employee),
        joinedload(TimeOffRequest.time_off_type)
    )

    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1):
        emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        emp = emp_result.scalar_one_or_none()
        if emp:
            query = query.where(TimeOffRequest.employee_id == emp.id)
        else:
            return []
    elif employee_id:
        query = query.where(TimeOffRequest.employee_id == employee_id)

    if status_filter:
        query = query.where(TimeOffRequest.status == status_filter)
        
    if search:
        search_pattern = f"%{search}%"
        query = query.join(TimeOffRequest.employee).join(TimeOffRequest.time_off_type).where(
            or_(
                Employee.first_name.ilike(search_pattern),
                Employee.last_name.ilike(search_pattern),
                TimeOffType.name.ilike(search_pattern),
                cast(TimeOffRequest.status, String).ilike(search_pattern)
            )
        )

    query = query.order_by(TimeOffRequest.created_at.desc())
    result = await db.execute(query)
    requests = result.scalars().all()
    
    # Enrich and return
    res = []
    for r in requests:
        res.append(await enrich_request(r, db))
    return res


@router.get("/requests/{request_id}", response_model=TimeOffRequestResponse)
async def get_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(TimeOffRequest).options(
        joinedload(TimeOffRequest.employee),
        joinedload(TimeOffRequest.time_off_type)
    ).where(TimeOffRequest.id == request_id)
    
    result = await db.execute(query)
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Time off request not found.")
        
    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1):
        emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        emp = emp_result.scalar_one_or_none()
        if not emp or req.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this request.")

    return await enrich_request(req, db)


@router.post("/requests", response_model=TimeOffRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    data: TimeOffRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a time off request."""
    # Calculate days (simple: business days approximation)
    delta = (data.end_date - data.start_date).days + 1
    days = float(delta)

    # Fetch Time Off Type to see if allocation is required
    type_result = await db.execute(select(TimeOffType).where(TimeOffType.id == data.time_off_type_id))
    time_off_type = type_result.scalar_one_or_none()
    if not time_off_type:
        raise HTTPException(status_code=404, detail="Time off type not found.")

    if time_off_type.requires_allocation:
        # Check allocation
        alloc_result = await db.execute(
            select(TimeOffAllocation).where(
                TimeOffAllocation.employee_id == data.employee_id,
                TimeOffAllocation.time_off_type_id == data.time_off_type_id,
                TimeOffAllocation.year == data.start_date.year,
            )
        )
        allocation = alloc_result.scalar_one_or_none()
        if not allocation:
            raise HTTPException(
                status_code=400,
                detail="No leave allocation found for this employee and leave type in the selected year.",
            )

        if allocation.remaining_days < days:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient leave balance. Requested {days} day(s), but only {allocation.remaining_days} day(s) remaining.",
            )


    # Check for overlapping approved/pending requests
    overlap_result = await db.execute(
        select(TimeOffRequest).where(
            TimeOffRequest.employee_id == data.employee_id,
            TimeOffRequest.status.in_([TimeOffStatus.PENDING, TimeOffStatus.APPROVED]),
            TimeOffRequest.start_date <= data.end_date,
            TimeOffRequest.end_date >= data.start_date,
        )
    )
    if overlap_result.scalars().first():
        raise HTTPException(
            status_code=409,
            detail="This leave request overlaps with an existing pending or approved leave request.",
        )

    request = TimeOffRequest(
        **data.model_dump(),
        days=days,
        status=TimeOffStatus.PENDING,
    )
    db.add(request)
    await db.flush()
    await db.refresh(request)
    
    # Fetch with joins
    query = select(TimeOffRequest).options(
        joinedload(TimeOffRequest.employee),
        joinedload(TimeOffRequest.time_off_type)
    ).where(TimeOffRequest.id == request.id)
    res = await db.execute(query)
    return await enrich_request(res.scalar_one(), db)


@router.put("/requests/{request_id}", response_model=TimeOffRequestResponse)
async def update_request(
    request_id: int,
    data: TimeOffRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(TimeOffRequest).options(
        joinedload(TimeOffRequest.employee),
        joinedload(TimeOffRequest.time_off_type)
    ).where(TimeOffRequest.id == request_id)
    result = await db.execute(query)
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="Time off request not found.")
        
    if request.status != TimeOffStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending requests can be modified.")
        
    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1):
        emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        emp = emp_result.scalar_one_or_none()
        if not emp or request.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Not authorized to modify this request.")

    update_data = data.model_dump(exclude_unset=True)
    
    # Recalculate days if dates changed
    new_start = update_data.get("start_date", request.start_date)
    new_end = update_data.get("end_date", request.end_date)
    if "start_date" in update_data or "end_date" in update_data:
        if new_end < new_start:
             raise HTTPException(status_code=400, detail="End date must be on or after start date.")
        delta = (new_end - new_start).days + 1
        request.days = float(delta)
        
        # Check allocation again
        alloc_result = await db.execute(
            select(TimeOffAllocation).where(
                TimeOffAllocation.employee_id == request.employee_id,
                TimeOffAllocation.time_off_type_id == request.time_off_type_id,
                TimeOffAllocation.year == new_start.year,
            )
        )
        allocation = alloc_result.scalar_one_or_none()
        if not allocation or allocation.remaining_days < request.days:
            raise HTTPException(status_code=400, detail=f"Insufficient leave balance for updated dates. Requested {request.days} day(s).")

    for field, value in update_data.items():
        setattr(request, field, value)

    await db.flush()
    await db.refresh(request)
    return await enrich_request(request, db)


@router.delete("/requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(TimeOffRequest).where(TimeOffRequest.id == request_id))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Request not found.")
        
    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1):
        emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        emp = emp_result.scalar_one_or_none()
        if not emp or r.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this request.")
            
    if r.status == TimeOffStatus.APPROVED:
        # Restore allocation before deleting
        alloc_result = await db.execute(
            select(TimeOffAllocation).where(
                TimeOffAllocation.employee_id == r.employee_id,
                TimeOffAllocation.time_off_type_id == r.time_off_type_id,
                TimeOffAllocation.year == r.start_date.year,
            )
        )
        allocation = alloc_result.scalar_one_or_none()
        if allocation:
            allocation.used_days = max(0, allocation.used_days - r.days)
            
    await db.delete(r)
    await db.flush()


@router.post("/requests/{request_id}/approve", response_model=TimeOffRequestResponse)
async def approve_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    """Approve a time off request and update allocation."""
    query = select(TimeOffRequest).options(
        joinedload(TimeOffRequest.employee),
        joinedload(TimeOffRequest.time_off_type)
    ).where(TimeOffRequest.id == request_id)
    result = await db.execute(query)
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Time off request not found.")

    if request.status != TimeOffStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve a request with status '{request.status.value}'. Only pending requests can be approved.",
        )

    allocation = None
    if request.time_off_type.requires_allocation:
        alloc_result = await db.execute(
            select(TimeOffAllocation).where(
                TimeOffAllocation.employee_id == request.employee_id,
                TimeOffAllocation.time_off_type_id == request.time_off_type_id,
                TimeOffAllocation.year == request.start_date.year,
            )
        )
        allocation = alloc_result.scalar_one_or_none()
        
        if not allocation:
            raise HTTPException(
                status_code=400,
                detail="Cannot approve: No leave allocation found for this employee and leave type in the selected year.",
            )
            
        # Check if current user is the designated approver (unless admin)
        if allocation.approver_id and (UserRole.ADMIN not in current_user.roles):
            emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
            current_emp = emp_result.scalar_one_or_none()
            if not current_emp or current_emp.id != allocation.approver_id:
                raise HTTPException(
                    status_code=403,
                    detail="Only the designated approver for this allocation can approve this request.",
                )

        if allocation.remaining_days < request.days:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot approve: only {allocation.remaining_days} day(s) remaining but {request.days} day(s) requested.",
            )
        allocation.used_days += request.days

    request.status = TimeOffStatus.APPROVED
    request.approved_by = current_user.id

    await db.flush()
    await db.refresh(request)
    return await enrich_request(request, db)


@router.post("/requests/{request_id}/refuse", response_model=TimeOffRequestResponse)
async def refuse_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    """Refuse a time off request."""
    query = select(TimeOffRequest).options(
        joinedload(TimeOffRequest.employee),
        joinedload(TimeOffRequest.time_off_type)
    ).where(TimeOffRequest.id == request_id)
    result = await db.execute(query)
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Time off request not found.")

    if request.status != TimeOffStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot refuse a request with status '{request.status.value}'. Only pending requests can be refused.",
        )

    # Check if current user is the designated approver (unless admin)
    alloc_result = await db.execute(
        select(TimeOffAllocation).where(
            TimeOffAllocation.employee_id == request.employee_id,
            TimeOffAllocation.time_off_type_id == request.time_off_type_id,
            TimeOffAllocation.year == request.start_date.year,
        )
    )
    allocation = alloc_result.scalar_one_or_none()
    if allocation and allocation.approver_id and (UserRole.ADMIN not in current_user.roles):
        emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        current_emp = emp_result.scalar_one_or_none()
        if not current_emp or current_emp.id != allocation.approver_id:
            raise HTTPException(
                status_code=403,
                detail="Only the designated approver for this allocation can refuse this request.",
            )

    request.status = TimeOffStatus.REFUSED
    request.approved_by = current_user.id

    await db.flush()
    await db.refresh(request)
    return await enrich_request(request, db)


@router.post("/requests/{request_id}/cancel", response_model=TimeOffRequestResponse)
async def cancel_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a time off request. Restores allocation if it was approved."""
    query = select(TimeOffRequest).options(
        joinedload(TimeOffRequest.employee),
        joinedload(TimeOffRequest.time_off_type)
    ).where(TimeOffRequest.id == request_id)
    result = await db.execute(query)
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Time off request not found.")

    if request.status not in (TimeOffStatus.PENDING, TimeOffStatus.APPROVED):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel a request with status '{request.status.value}'.",
        )

    # Restore allocation if was approved
    if request.status == TimeOffStatus.APPROVED and request.time_off_type.requires_allocation:
        alloc_result = await db.execute(
            select(TimeOffAllocation).where(
                TimeOffAllocation.employee_id == request.employee_id,
                TimeOffAllocation.time_off_type_id == request.time_off_type_id,
                TimeOffAllocation.year == request.start_date.year,
            )
        )
        allocation = alloc_result.scalar_one_or_none()
        if allocation:
            allocation.used_days = max(0, allocation.used_days - request.days)

    request.status = TimeOffStatus.CANCELLED

    await db.flush()
    await db.refresh(request)
    return await enrich_request(request, db)
