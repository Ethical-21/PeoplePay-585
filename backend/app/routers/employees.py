"""
Employees router — CRUD + list with search/filter.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.department import Department
from app.models.contract import Contract
from app.models.attendance import Attendance
from app.models.timeoff import TimeOffRequest
from app.models.payroll import Payslip
from app.auth.dependencies import get_current_user, require_min_role
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse, EmployeeListResponse, EmployeeStatsResponse
)

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("", response_model=EmployeeListResponse)
async def list_employees(
    search: str | None = Query(None, description="Search by name, email, or employee number"),
    department_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    """List all employees with optional search and filters."""
    query = select(Employee).options(selectinload(Employee.department), selectinload(Employee.user))

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Employee.first_name.ilike(search_term),
                Employee.last_name.ilike(search_term),
                Employee.email.ilike(search_term),
                Employee.employee_number.ilike(search_term),
            )
        )

    if department_id:
        query = query.where(Employee.department_id == department_id)

    if status_filter:
        query = query.where(Employee.status == status_filter)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch page
    query = query.order_by(Employee.employee_number).offset(skip).limit(limit)
    result = await db.execute(query)
    employees = result.scalars().all()

    return EmployeeListResponse(
        employees=[EmployeeResponse.model_validate(e) for e in employees],
        total=total,
    )


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get employee details. Employees can view their own profile."""
    query = select(Employee).options(selectinload(Employee.department), selectinload(Employee.user)).where(Employee.id == employee_id)
    result = await db.execute(query)
    employee = result.scalar_one_or_none()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")

    # Employees can only view their own profile
    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1) and employee.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only view your own profile.")

    return EmployeeResponse.model_validate(employee)


@router.get("/{employee_id}/stats", response_model=EmployeeStatsResponse)
async def get_employee_stats(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get counts of related records for an employee."""
    # Base permission check: employee exists and user is allowed
    emp_result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = emp_result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
        
    if (UserRole.EMPLOYEE in current_user.roles and len(current_user.roles) == 1) and employee.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only view your own profile.")

    # Execute all counts concurrently
    import asyncio
    async def get_count(model):
        res = await db.execute(select(func.count()).select_from(model).where(model.employee_id == employee_id))
        return res.scalar() or 0
        
    c_count, a_count, t_count, p_count = await asyncio.gather(
        get_count(Contract),
        get_count(Attendance),
        get_count(TimeOffRequest),
        get_count(Payslip)
    )

    return EmployeeStatsResponse(
        contracts_count=c_count,
        attendance_count=a_count,
        timeoff_count=t_count,
        payslips_count=p_count
    )


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    data: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.ADMIN)),
):
    """Create a new employee."""
    # Validate department exists if provided
    dept = None
    if data.department_id:
        dept_res = await db.execute(select(Department).where(Department.id == data.department_id))
        dept = dept_res.scalar_one_or_none()
        if not dept:
            raise HTTPException(status_code=400, detail="Selected department does not exist.")

    if not data.employee_number:
        if dept:
            count_res = await db.execute(select(func.count(Employee.id)).where(Employee.department_id == dept.id))
            emp_count = count_res.scalar() or 0
            data.employee_number = f"{dept.code}/{emp_count + 1:03d}"
        else:
            count_res = await db.execute(select(func.count(Employee.id)))
            emp_count = count_res.scalar() or 0
            data.employee_number = f"EMP{emp_count + 1:04d}"

    # Check for duplicate employee number
    existing = await db.execute(
        select(Employee).where(Employee.employee_number == data.employee_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"An employee with number '{data.employee_number}' already exists.",
        )

    employee = Employee(**data.model_dump())
    db.add(employee)
    await db.flush()
    await db.refresh(employee, attribute_names=["department"])
    return EmployeeResponse.model_validate(employee)


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    """Update an existing employee."""
    result = await db.execute(
        select(Employee).options(selectinload(Employee.department)).where(Employee.id == employee_id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(employee, field, value)

    await db.flush()
    await db.refresh(employee, attribute_names=["department"])
    return EmployeeResponse.model_validate(employee)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.ADMIN)),
):
    """Delete an employee (admin only)."""
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")

    await db.delete(employee)
