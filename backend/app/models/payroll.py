"""
Payroll models — Payrun, PayrunEmployee, Payslip, PayslipLine.

Payrun lifecycle: draft → computed → validated → paid
Payslip is generated per-employee during payrun computation.
PayslipLine records each salary rule result for auditability.
"""

import enum
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    String, Integer, Date, DateTime, Numeric, Text, Boolean, Enum, ForeignKey,
    UniqueConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PayrunStatus(str, enum.Enum):
    DRAFT = "draft"
    COMPUTED = "computed"
    VALIDATED = "validated"
    PAID = "paid"
    CANCELLED = "cancelled"


class Payrun(Base):
    __tablename__ = "payruns"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    salary_structure_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("salary_structures.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[PayrunStatus] = mapped_column(
        Enum(PayrunStatus, name="payrun_status_enum", create_constraint=True),
        nullable=False,
        default=PayrunStatus.DRAFT,
    )
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    computed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    salary_structure: Mapped["SalaryStructure"] = relationship("SalaryStructure")
    employees: Mapped[list["PayrunEmployee"]] = relationship(
        "PayrunEmployee", back_populates="payrun", cascade="all, delete-orphan"
    )
    payslips: Mapped[list["Payslip"]] = relationship(
        "Payslip", back_populates="payrun", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Payrun {self.name} ({self.status.value})>"


class PayrunEmployee(Base):
    __tablename__ = "payrun_employees"
    __table_args__ = (
        UniqueConstraint("payrun_id", "employee_id", name="uq_payrun_employee"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    payrun_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("payruns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    is_excluded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    exclusion_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    payrun: Mapped["Payrun"] = relationship("Payrun", back_populates="employees")
    employee: Mapped["Employee"] = relationship("Employee")

    def __repr__(self) -> str:
        status = "excluded" if self.is_excluded else "included"
        return f"<PayrunEmployee Employee#{self.employee_id} ({status})>"


class PayslipStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    PAID = "paid"
    CANCELLED = "cancelled"


class Payslip(Base):
    __tablename__ = "payslips"
    __table_args__ = (
        UniqueConstraint(
            "employee_id", "period_start", "period_end",
            name="uq_payslip_employee_period"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    payrun_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("payruns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contract_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("contracts.id", ondelete="RESTRICT"), nullable=False
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    gross_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_deductions: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    net_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    
    # Hours Context
    expected_hours: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    worked_hours: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    short_hours: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    overtime_hours: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    status: Mapped[PayslipStatus] = mapped_column(
        Enum(PayslipStatus, name="payslip_status_enum", create_constraint=True),
        nullable=False,
        default=PayslipStatus.DRAFT,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    payrun: Mapped["Payrun"] = relationship("Payrun", back_populates="payslips")
    employee: Mapped["Employee"] = relationship("Employee", back_populates="payslips")
    contract: Mapped["Contract"] = relationship("Contract", back_populates="payslips")
    lines: Mapped[list["PayslipLine"]] = relationship(
        "PayslipLine",
        back_populates="payslip",
        cascade="all, delete-orphan",
        order_by="PayslipLine.sequence",
    )

    def __repr__(self) -> str:
        return f"<Payslip Employee#{self.employee_id} {self.period_start}-{self.period_end} Net={self.net_salary}>"


class PayslipLine(Base):
    __tablename__ = "payslip_lines"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    payslip_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("payslips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    salary_rule_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("salary_rules.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # Relationships
    payslip: Mapped["Payslip"] = relationship("Payslip", back_populates="lines")

    def __repr__(self) -> str:
        return f"<PayslipLine {self.code}: {self.amount}>"
