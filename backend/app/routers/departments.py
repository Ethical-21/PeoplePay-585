"""
Departments router — CRUD.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.department import Department
from app.models.employee import Employee
from app.auth.dependencies import require_min_role, get_current_user
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentResponse

router = APIRouter(prefix="/departments", tags=["Departments"])


async def _enrich_dept(dept: Department, db: AsyncSession) -> DepartmentResponse:
    """Build a DepartmentResponse with employee_count and manager_name."""
    count_result = await db.execute(
        select(func.count()).where(Employee.department_id == dept.id)
    )
    count = count_result.scalar() or 0

    mgr_name = None
    if dept.manager_id:
        mgr_result = await db.execute(select(Employee).where(Employee.id == dept.manager_id))
        mgr = mgr_result.scalar_one_or_none()
        if mgr:
            mgr_name = f"{mgr.first_name} {mgr.last_name}"

    resp = DepartmentResponse.model_validate(dept).model_dump()
    resp["employee_count"] = count
    resp["manager_name"] = mgr_name
    return DepartmentResponse(**resp)


@router.get("", response_model=list[DepartmentResponse])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all departments with employee counts."""
    result = await db.execute(select(Department).order_by(Department.name))
    departments = result.scalars().all()
    return [await _enrich_dept(d, db) for d in departments]


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    data: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    """Create a new department."""
    existing = await db.execute(
        select(Department).where(
            (Department.name == data.name) | (Department.code == data.code)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A department with this name or code already exists.")

    dept = Department(**data.model_dump())
    db.add(dept)
    await db.flush()
    await db.refresh(dept)
    return await _enrich_dept(dept, db)


@router.put("/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: int,
    data: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_MANAGER)),
):
    """Update a department."""
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(dept, field, value)

    await db.flush()
    await db.refresh(dept)
    return await _enrich_dept(dept, db)

