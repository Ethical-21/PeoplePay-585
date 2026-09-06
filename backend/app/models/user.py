"""
User model — Authentication & Role-Based Access Control.
"""

import enum
from datetime import datetime
from sqlalchemy import String, Boolean, Enum, DateTime, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class UserRole(str, enum.Enum):
    EMPLOYEE = "employee"
    HR_MANAGER = "hr_manager"
    HR_PAYROLL_USER = "hr_payroll_user"
    HR_PAYROLL_MANAGER = "hr_payroll_manager"
    ADMIN = "admin"


class InvitationStatus(str, enum.Enum):
    NOT_INVITED = "not_invited"
    PENDING = "pending"
    SENT = "sent"
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    roles: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: [UserRole.EMPLOYEE.value],
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Invitation / first-login fields
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    invitation_token: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    invitation_status: Mapped[InvitationStatus] = mapped_column(
        Enum(InvitationStatus, name="invitation_status_enum", create_constraint=True),
        nullable=False,
        default=InvitationStatus.NOT_INVITED,
    )
    invitation_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Password reset
    reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    reset_token_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="user", uselist=False, cascade="all, delete-orphan")

    @property
    def employee_id(self) -> int | None:
        if hasattr(self, 'employee') and self.employee:
            return self.employee.id
        return None

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.roles})>"
