"""
User schemas — Request/response models for authentication and admin user management.
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from app.models.user import UserRole, InvitationStatus


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)
    roles: list[UserRole] | None = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    roles: list[UserRole]
    is_active: bool
    must_change_password: bool = False
    invitation_status: InvitationStatus = InvitationStatus.NOT_INVITED
    created_at: datetime
    employee_id: int | None = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Admin User Management ──

class UserAdminCreate(BaseModel):
    """Admin creates a user account, optionally linking to an existing employee or creating a new one inline."""
    employee_id: int | None = None
    email: EmailStr
    roles: list[UserRole] = [UserRole.EMPLOYEE]
    send_invitation: bool = True
    
    # Inline Employee Creation Fields (required if employee_id is None)
    first_name: str | None = None
    last_name: str | None = None
    department_id: int | None = None
    job_position: str | None = None
    work_phone: str | None = None


class UserAdminUpdate(BaseModel):
    """Admin updates user role or status."""
    roles: list[UserRole] | None = None
    is_active: bool | None = None
    full_name: str | None = None
    email: EmailStr | None = None
    department_id: int | None = None


class UserListItem(BaseModel):
    """User list item with employee info."""
    id: int
    email: str
    full_name: str
    roles: list[UserRole]
    is_active: bool
    must_change_password: bool
    invitation_status: InvitationStatus
    employee_id: int | None = None
    employee_name: str | None = None
    employee_number: str | None = None
    department: str | None = None
    department_id: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Password Management ──

class PasswordChangeRequest(BaseModel):
    """For first-login password change or voluntary change."""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, max_length=128)
