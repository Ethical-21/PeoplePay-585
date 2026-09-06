"""
PeoplePay585 — Authentication Dependencies
FastAPI dependencies for extracting current user and enforcing role-based access.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.auth.jwt import verify_token
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Role hierarchy: higher roles include permissions of lower roles
ROLE_HIERARCHY = {
    UserRole.ADMIN: 5,
    UserRole.HR_PAYROLL_MANAGER: 4,
    UserRole.HR_PAYROLL_USER: 3,
    UserRole.HR_MANAGER: 2,
    UserRole.EMPLOYEE: 1,
}


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from the JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = verify_token(token)
    if payload is None:
        raise credentials_exception

    user_id: int | None = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User).options(selectinload(User.employee)).where(User.id == int(user_id))
    )
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


def require_roles(*allowed_roles: UserRole):
    """
    FastAPI dependency factory that restricts access to users with specific roles.
    
    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(user: User = Depends(require_roles(UserRole.ADMIN))):
            ...
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if not any(r in allowed_roles for r in current_user.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(r.value for r in allowed_roles)}. Your roles: {', '.join(current_user.roles)}.",
            )
        return current_user
    return role_checker


def require_min_role(min_role: UserRole):
    """
    FastAPI dependency factory that restricts access to users at or above a role level.
    Uses the ROLE_HIERARCHY to determine if the user's role is sufficient.
    
    Usage:
        @router.get("/hr-and-above")
        async def hr_endpoint(user: User = Depends(require_min_role(UserRole.HR_MANAGER))):
            ...
    """
    min_level = ROLE_HIERARCHY.get(min_role, 0)

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        has_min_role = any(ROLE_HIERARCHY.get(r, 0) >= min_level for r in current_user.roles)
        if not has_min_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Minimum required role: {min_role.value}. Your roles: {', '.join(current_user.roles)}.",
            )
        return current_user
    return role_checker
