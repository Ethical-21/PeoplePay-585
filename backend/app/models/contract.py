"""
Contract model — Links employee to salary structure, schedule, and wage.
Critical for payroll: payslip generation requires a valid active contract.
"""

import enum
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    String, Integer, Date, DateTime, Numeric, Text, Enum, ForeignKey,
    CheckConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ContractStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    EXPIRED = "expired"
    TERMINATED = "terminated"
    CANCELLED = "cancelled"


class WageType(str, enum.Enum):
    MONTHLY = "monthly"
    HOURLY = "hourly"


class Contract(Base):
    __tablename__ = "contracts"
    __table_args__ = (
        CheckConstraint("wage > 0", name="ck_contract_wage_positive"),
        CheckConstraint(
            "end_date IS NULL OR end_date > start_date",
            name="ck_contract_dates_valid",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    wage: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    wage_type: Mapped[WageType] = mapped_column(
        Enum(WageType, name="wage_type_enum", create_constraint=True),
        nullable=False,
        default=WageType.MONTHLY,
    )
    working_schedule_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("working_schedules.id", ondelete="SET NULL"), nullable=True
    )
    salary_structure_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("salary_structures.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[ContractStatus] = mapped_column(
        Enum(ContractStatus, name="contract_status_enum", create_constraint=True),
        nullable=False,
        default=ContractStatus.DRAFT,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="contracts")
    working_schedule: Mapped["WorkingSchedule"] = relationship(
        "WorkingSchedule", back_populates="contracts"
    )
    salary_structure: Mapped["SalaryStructure"] = relationship("SalaryStructure")
    payslips: Mapped[list["Payslip"]] = relationship("Payslip", back_populates="contract")

    def is_active_for_period(self, period_start: date, period_end: date) -> bool:
        """Check if this contract covers (overlaps with) the given payroll period."""
        if self.status != ContractStatus.ACTIVE:
            return False
        if self.start_date > period_end:
            return False
        if self.end_date is not None and self.end_date < period_start:
            return False
        return True

    def __repr__(self) -> str:
        return f"<Contract {self.name} for Employee#{self.employee_id} ({self.status.value})>"
