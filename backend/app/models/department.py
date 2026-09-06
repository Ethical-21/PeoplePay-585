"""
Department model — Organizational unit for employees.
"""

from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    manager_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    employees: Mapped[list["Employee"]] = relationship(
        "Employee", back_populates="department", foreign_keys="Employee.department_id"
    )
    manager: Mapped["Employee | None"] = relationship(
        "Employee", foreign_keys=[manager_id]
    )

    @property
    def manager_name(self) -> str | None:
        if self.manager:
            return f"{self.manager.first_name} {self.manager.last_name}"
        return None

    def __repr__(self) -> str:
        return f"<Department {self.code}: {self.name}>"
