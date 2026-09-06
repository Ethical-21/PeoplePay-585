"""
Contracts router — CRUD with overlap detection and business rules.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from app.database import get_db
from app.models.user import User, UserRole
from app.models.contract import Contract, ContractStatus
from app.models.employee import Employee
from app.auth.dependencies import require_min_role, get_current_user
from app.schemas.contract import ContractCreate, ContractUpdate, ContractResponse

router = APIRouter(prefix="/contracts", tags=["Contracts"])


async def check_contract_overlap(
    db: AsyncSession, employee_id: int, start_date, end_date, exclude_id: int | None = None
):
    """Detect overlapping contracts (active or draft) for the same employee."""
    query = select(Contract).where(
        Contract.employee_id == employee_id,
        Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.DRAFT]),
    )
    if exclude_id:
        query = query.where(Contract.id != exclude_id)

    # Overlap condition: new start < existing end AND new end > existing start
    # Handle open-ended contracts (end_date is NULL)
    if end_date:
        query = query.where(
            Contract.start_date <= end_date,
            or_(Contract.end_date.is_(None), Contract.end_date >= start_date),
        )
    else:
        query = query.where(
            or_(Contract.end_date.is_(None), Contract.end_date >= start_date),
        )

    result = await db.execute(query)
    return result.scalars().all()


@router.get("", response_model=list[ContractResponse])
async def list_contracts(
    search: str | None = Query(None, description="Search by contract name or employee"),
    employee_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List contracts, optionally filtered by employee, status, or search term."""
    query = select(Contract).options(
        selectinload(Contract.employee).selectinload(Employee.department),
        selectinload(Contract.working_schedule),
        selectinload(Contract.salary_structure),
    )
    
    # Employees can only see their own contracts
    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1):
        emp_result = await db.execute(
            select(Employee).where(Employee.user_id == current_user.id)
        )
        emp = emp_result.scalar_one_or_none()
        if emp:
            query = query.where(Contract.employee_id == emp.id)
        else:
            return []
    elif employee_id:
        query = query.where(Contract.employee_id == employee_id)
    if search:
        search_term = f"%{search}%"
        query = query.join(Employee).where(
            or_(
                Contract.name.ilike(search_term),
                Employee.first_name.ilike(search_term),
                Employee.last_name.ilike(search_term),
                Employee.employee_number.ilike(search_term),
            )
        )
    if status_filter:
        query = query.where(Contract.status == status_filter)
    query = query.order_by(Contract.start_date.desc())

    result = await db.execute(query)
    contracts = result.scalars().all()
    
    today = date.today()
    responses = []
    for c in contracts:
        # Auto-compute status: if end_date is past and status is active, mark as expired
        if c.status == ContractStatus.ACTIVE and c.end_date and c.end_date < today:
            c.status = ContractStatus.EXPIRED
            await db.flush()
        resp = ContractResponse.model_validate(c)
        if c.employee:
            resp.employee_name = f"{c.employee.first_name} {c.employee.last_name}"
            resp.employee_number = c.employee.employee_number
            resp.job_role = c.employee.job_title
            if c.employee.department:
                resp.department_name = c.employee.department.name
        if c.working_schedule:
            resp.schedule_name = c.working_schedule.name
        if c.salary_structure:
            resp.salary_structure_name = c.salary_structure.name
        responses.append(resp)
    return responses


@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single contract."""
    result = await db.execute(
        select(Contract).options(
            selectinload(Contract.employee).selectinload(Employee.department),
            selectinload(Contract.working_schedule),
            selectinload(Contract.salary_structure),
        ).where(Contract.id == contract_id)
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
        
    # RBAC: employees can only see their own
    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1):
        emp_result = await db.execute(
            select(Employee).where(Employee.user_id == current_user.id)
        )
        emp = emp_result.scalar_one_or_none()
        if not emp or contract.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="You can only view your own contract.")
    
    # Auto-compute status: if end_date is past and status is active, mark as expired
    today = date.today()
    if contract.status == ContractStatus.ACTIVE and contract.end_date and contract.end_date < today:
        contract.status = ContractStatus.EXPIRED
        await db.flush()
    
    resp = ContractResponse.model_validate(contract)
    if contract.employee:
        resp.employee_name = f"{contract.employee.first_name} {contract.employee.last_name}"
        resp.employee_number = contract.employee.employee_number
        resp.job_role = contract.employee.job_title
        if contract.employee.department:
            resp.department_name = contract.employee.department.name
    if contract.working_schedule:
        resp.schedule_name = contract.working_schedule.name
    if contract.salary_structure:
        resp.salary_structure_name = contract.salary_structure.name
    return resp


@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
async def create_contract(
    data: ContractCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    """Create a new contract with overlap detection."""
    # Validate employee exists
    emp_result = await db.execute(select(Employee).where(Employee.id == data.employee_id))
    if not emp_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Employee not found.")

    # Check for any overlapping contract (active or draft) for this employee
    overlaps = await check_contract_overlap(db, data.employee_id, data.start_date, data.end_date)
    if overlaps:
        overlap_names = ", ".join(
            f"'{c.name}' ({c.start_date} to {c.end_date or 'ongoing'})" for c in overlaps
        )
        raise HTTPException(
            status_code=409,
            detail=f"There is a contract currently activated for this employee. Overlapping contract(s): {overlap_names}.",
        )

    contract = Contract(**data.model_dump())
    db.add(contract)
    await db.flush()
    await db.refresh(contract)
    return ContractResponse.model_validate(contract)


@router.put("/{contract_id}", response_model=ContractResponse)
async def update_contract(
    contract_id: int,
    data: ContractUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    """Update an existing contract."""
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")

    update_data = data.model_dump(exclude_unset=True)

    # If activating, check for overlaps
    new_status = update_data.get("status", contract.status)
    new_start = update_data.get("start_date", contract.start_date)
    new_end = update_data.get("end_date", contract.end_date)

    if new_status == ContractStatus.ACTIVE or (
        contract.status == ContractStatus.ACTIVE and "status" not in update_data
    ):
        overlaps = await check_contract_overlap(db, contract.employee_id, new_start, new_end, exclude_id=contract.id)
        if overlaps:
            overlap_names = ", ".join(f"'{c.name}' ({c.start_date} to {c.end_date or 'open'})" for c in overlaps)
            raise HTTPException(
                status_code=409,
                detail=f"Cannot update contract: this would create an overlap with: {overlap_names}.",
            )

    for field, value in update_data.items():
        setattr(contract, field, value)

    await db.flush()
    await db.refresh(contract)
    return ContractResponse.model_validate(contract)
