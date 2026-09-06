"""
Salary models — SalaryStructure and SalaryRule (the payroll engine's configuration).

SalaryRules execute in sequence order within a structure and support:
  - fixed: result = fixed_amount
  - percentage: result = percentage * value of another rule (percentage_of)
  - formula: result = safe arithmetic expression evaluated with rule context
"""

import enum
from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    String, Integer, Float, DateTime, Numeric, Text, Boolean, Enum, ForeignKey,
    UniqueConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SalaryStructure(Base):
    __tablename__ = "salary_structures"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    rules: Mapped[list["SalaryRule"]] = relationship(
        "SalaryRule",
        back_populates="structure",
        order_by="SalaryRule.sequence",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<SalaryStructure {self.code}: {self.name}>"


class RuleCategory(str, enum.Enum):
    BASIC = "basic"
    ALLOWANCE = "allowance"
    GROSS = "gross"
    DEDUCTION = "deduction"
    NET = "net"


class CalculationType(str, enum.Enum):
    FIXED = "fixed"
    PERCENTAGE = "percentage"
    FORMULA = "formula"


class SalaryRule(Base):
    __tablename__ = "salary_rules"
    __table_args__ = (
        UniqueConstraint("structure_id", "code", name="uq_rule_structure_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    structure_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("salary_structures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[RuleCategory] = mapped_column(
        Enum(RuleCategory, name="rule_category_enum", create_constraint=True),
        nullable=False,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    calculation_type: Mapped[CalculationType] = mapped_column(
        Enum(CalculationType, name="calculation_type_enum", create_constraint=True),
        nullable=False,
    )
    # For fixed type
    fixed_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    # For percentage type
    percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    percentage_of: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # Code of another rule
    # For formula type
    formula: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    appears_on_payslip: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    structure: Mapped["SalaryStructure"] = relationship("SalaryStructure", back_populates="rules")

    def __repr__(self) -> str:
        return f"<SalaryRule {self.code}: {self.name} (seq={self.sequence}, {self.calculation_type.value})>"
