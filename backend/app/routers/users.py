"""
Users router — Admin-only user management CRUD.
Only Admin can create, update, or manage user accounts.
"""

import secrets
from datetime import datetime, timezone, date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole, InvitationStatus
from app.models.employee import Employee
from app.models.department import Department
from app.auth.dependencies import require_roles
from app.auth.router import hash_password
from app.schemas.user import (
    UserAdminCreate, UserAdminUpdate, UserListItem, UserResponse,
)
from app.services.email import send_welcome_email

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("", response_model=list[UserListItem])
async def list_users(
    search: str | None = Query(None),
    role: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """List all users with employee info. Admin only."""
    query = select(User).options(selectinload(User.employee))

    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                User.full_name.ilike(term),
                User.email.ilike(term),
            )
        )
    if role:
        # Check if the role array contains the requested role
        query = query.where(User.roles.contains([role]))

    query = query.order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()

    items = []
    for u in users:
        item = UserListItem(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            roles=u.roles,
            is_active=u.is_active,
            must_change_password=u.must_change_password,
            invitation_status=u.invitation_status,
            employee_id=u.employee.id if u.employee else None,
            employee_name=u.employee.full_name if u.employee else None,
            employee_number=u.employee.employee_number if u.employee else None,
            department=None,
            department_id=u.employee.department_id if u.employee else None,
            created_at=u.created_at,
        )
        # Load department name if employee has one
        if u.employee and u.employee.department_id:
            from app.models.department import Department
            dept_result = await db.execute(
                select(Department).where(Department.id == u.employee.department_id)
            )
            dept = dept_result.scalar_one_or_none()
            if dept:
                item.department = dept.name
        items.append(item)

    return items


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserAdminCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Create a user account, optionally creating an employee inline. Admin only."""
    
    # Check email not already used
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"A user with email '{data.email}' already exists.",
        )

    employee = None
    full_name_str = ""
    if data.employee_id:
        # Validate existing employee
        emp_result = await db.execute(
            select(Employee).where(Employee.id == data.employee_id)
        )
        employee = emp_result.scalar_one_or_none()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found.")
        if employee.user_id is not None:
            raise HTTPException(
                status_code=409,
                detail=f"Employee {employee.full_name} already has a user account.",
            )
        employee.email = data.email
        full_name_str = employee.full_name
    else:
        # Inline Employee Creation
        if not data.first_name or not data.last_name:
            raise HTTPException(
                status_code=400, 
                detail="first_name and last_name are required when creating a new employee."
            )
        
        # Generate an employee number based on department
        if data.department_id:
            dept_res = await db.execute(select(Department).where(Department.id == data.department_id))
            dept = dept_res.scalar_one_or_none()
            if dept:
                # Find max id to avoid unique constraint issues on deleted rows
                max_id_res = await db.execute(select(func.max(Employee.id)))
                max_id = max_id_res.scalar() or 0
                emp_number = f"{dept.code}/{max_id + 1:03d}"
            else:
                max_id_res = await db.execute(select(func.max(Employee.id)))
                max_id = max_id_res.scalar() or 0
                emp_number = f"EMP{max_id + 1:04d}"
        else:
            max_id_res = await db.execute(select(func.max(Employee.id)))
            max_id = max_id_res.scalar() or 0
            emp_number = f"EMP{max_id + 1:04d}"

        employee = Employee(
            employee_number=emp_number,
            first_name=data.first_name,
            last_name=data.last_name,
            email=data.email,
            phone=data.work_phone,
            department_id=data.department_id,
            job_title=data.job_position,
            joining_date=date.today(),
        )
        db.add(employee)
        await db.flush()
        full_name_str = f"{data.first_name} {data.last_name}"

    # Generate a temporary password (hashed, never stored in plaintext)
    temp_password = secrets.token_urlsafe(12)
    invitation_token = secrets.token_urlsafe(32)

    new_user = User(
        email=data.email,
        hashed_password=hash_password(temp_password),
        full_name=full_name_str,
        roles=data.roles,
        is_active=True,
        must_change_password=True,
        invitation_token=invitation_token,
        invitation_status=InvitationStatus.PENDING,
    )
    db.add(new_user)
    await db.flush()

    # Link employee to user
    employee.user_id = new_user.id
    
    # We must not access employee attributes anymore as they will be expired!
    # Let's commit or let the dependency do the commit.
    
    # Send Welcome Email BEFORE returning, using the cached full_name_str
    if data.send_invitation:
        send_welcome_email(
            to_email=data.email,
            full_name=full_name_str,
            temp_password=temp_password
        )

    # Instead of model_validate(new_user), let's construct it manually to avoid lazy loading issues
    user_resp = UserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        roles=new_user.roles,
        is_active=new_user.is_active,
        must_change_password=new_user.must_change_password,
        invitation_status=new_user.invitation_status,
        created_at=new_user.created_at,
        employee_id=employee.id,
    )
    return user_resp


@router.get("/{user_id}", response_model=UserListItem)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Get user details. Admin only."""
    result = await db.execute(
        select(User).options(selectinload(User.employee)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    item = UserListItem(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        roles=user.roles,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        invitation_status=user.invitation_status,
        employee_id=user.employee.id if user.employee else None,
        employee_name=user.employee.full_name if user.employee else None,
        employee_number=user.employee.employee_number if user.employee else None,
        department=None,
        department_id=user.employee.department_id if user.employee else None,
        created_at=user.created_at,
    )
    return item


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserAdminUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Update user role or status. Admin only. Users cannot modify their own role."""
    result = await db.execute(select(User).options(selectinload(User.employee)).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Prevent admin from completely removing their own ADMIN role (security)
    if user.id == current_user.id and data.roles is not None and UserRole.ADMIN not in data.roles:
        raise HTTPException(
            status_code=403,
            detail="You cannot remove your own admin role.",
        )

    if data.roles is not None:
        user.roles = data.roles
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.full_name is not None:
        user.full_name = data.full_name
        # Update associated employee name if one exists
        if user.employee:
            parts = data.full_name.split(' ', 1)
            user.employee.first_name = parts[0]
            if len(parts) > 1:
                user.employee.last_name = parts[1]
            else:
                user.employee.last_name = ""
    if data.email is not None:
        user.email = data.email
        if user.employee:
            user.employee.email = data.email
            
    if data.department_id is not None:
        if user.employee:
            user.employee.department_id = data.department_id

    await db.flush()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.post("/{user_id}/resend-invitation", response_model=UserResponse)
async def resend_invitation(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Resend invitation for a user. Admin only."""
    result = await db.execute(select(User).options(selectinload(User.employee)).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.invitation_status == InvitationStatus.ACCEPTED:
        raise HTTPException(
            status_code=400,
            detail="This user has already accepted their invitation.",
        )

    # Generate new temp password and token
    temp_password = secrets.token_urlsafe(12)
    invitation_token = secrets.token_urlsafe(32)

    user.hashed_password = hash_password(temp_password)
    user.must_change_password = True
    user.invitation_token = invitation_token
    user.invitation_status = InvitationStatus.PENDING

    await db.flush()
    await db.refresh(user)

    print(f"[INVITE-RESEND] Resent invitation for {user.email}")
    print(f"[INVITE-RESEND] New temp password: {temp_password}")

    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Delete a user account. Admin only."""
    result = await db.execute(
        select(User).options(selectinload(User.employee)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.id == current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot delete your own account.",
        )

    # Delete the employee if exists (this will cascade delete attendance, contracts, payslips, leaves, etc.)
    if user.employee:
        await db.delete(user.employee)
        
    await db.delete(user)
    await db.flush()
