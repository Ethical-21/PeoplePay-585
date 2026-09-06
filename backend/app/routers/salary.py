"""
Salary Structures & Rules router — CRUD for payroll configuration.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, String
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.salary import SalaryStructure, SalaryRule
from app.auth.dependencies import require_min_role
from app.schemas.salary import (
    SalaryStructureCreate, SalaryStructureUpdate, SalaryStructureResponse,
    SalaryRuleCreate, SalaryRuleUpdate, SalaryRuleResponse,
)

router = APIRouter(prefix="/salary", tags=["Salary Configuration"])


# ── Structures ──

@router.get("/structures", response_model=list[SalaryStructureResponse])
async def list_structures(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_USER)),
):
    from app.models.payroll import Payrun, PayrunEmployee
    from sqlalchemy import func as sqf

    result = await db.execute(
        select(SalaryStructure).options(selectinload(SalaryStructure.rules)).order_by(SalaryStructure.name)
    )
    structures = result.scalars().all()

    # Count distinct employees per structure (via payruns)
    emp_counts: dict[int, int] = {}
    if structures:
        struct_ids = [s.id for s in structures]
        count_q = await db.execute(
            select(
                Payrun.salary_structure_id,
                sqf.count(sqf.distinct(PayrunEmployee.employee_id)),
            )
            .join(PayrunEmployee, PayrunEmployee.payrun_id == Payrun.id)
            .where(
                Payrun.salary_structure_id.in_(struct_ids),
                PayrunEmployee.is_excluded == False,
            )
            .group_by(Payrun.salary_structure_id)
        )
        for row in count_q.all():
            emp_counts[row[0]] = row[1]

    responses = []
    for s in structures:
        resp = SalaryStructureResponse.model_validate(s)
        resp.employee_count = emp_counts.get(s.id, 0)
        responses.append(resp)
    return responses


@router.get("/structures/{structure_id}", response_model=SalaryStructureResponse)
async def get_structure(
    structure_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_USER)),
):
    result = await db.execute(
        select(SalaryStructure).options(selectinload(SalaryStructure.rules)).where(SalaryStructure.id == structure_id)
    )
    structure = result.scalar_one_or_none()
    if not structure:
        raise HTTPException(status_code=404, detail="Salary structure not found.")
    return SalaryStructureResponse.model_validate(structure)


@router.post("/structures", response_model=SalaryStructureResponse, status_code=status.HTTP_201_CREATED)
async def create_structure(
    data: SalaryStructureCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_MANAGER)),
):
    existing = await db.execute(select(SalaryStructure).where(SalaryStructure.code == data.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A salary structure with this code already exists.")

    structure = SalaryStructure(**data.model_dump())
    db.add(structure)
    await db.flush()
    await db.refresh(structure)
    
    # Initialize empty rules list to avoid MissingGreenlet error during validation
    from sqlalchemy.orm.attributes import set_committed_value
    set_committed_value(structure, 'rules', [])
    
    return SalaryStructureResponse.model_validate(structure)


@router.put("/structures/{structure_id}", response_model=SalaryStructureResponse)
async def update_structure(
    structure_id: int,
    data: SalaryStructureUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_MANAGER)),
):
    result = await db.execute(
        select(SalaryStructure).options(selectinload(SalaryStructure.rules)).where(SalaryStructure.id == structure_id)
    )
    structure = result.scalar_one_or_none()
    if not structure:
        raise HTTPException(status_code=404, detail="Salary structure not found.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(structure, field, value)

    await db.flush()
    await db.refresh(structure)
    return SalaryStructureResponse.model_validate(structure)


# ── Rules ──

@router.get("/rules", response_model=list[SalaryRuleResponse])
async def list_rules(
    structure_id: int | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_USER)),
):
    query = select(SalaryRule).options(selectinload(SalaryRule.structure))
    if structure_id:
        query = query.where(SalaryRule.structure_id == structure_id)
    if search:
        term = f"%{search}%"
        query = query.where(
            (SalaryRule.name.ilike(term)) |
            (SalaryRule.code.ilike(term)) |
            (SalaryRule.category.cast(String).ilike(term))
        )
    query = query.order_by(SalaryRule.structure_id, SalaryRule.sequence)
    result = await db.execute(query)
    rules = result.scalars().all()
    out = []
    for r in rules:
        resp = SalaryRuleResponse.model_validate(r)
        resp.structure_name = r.structure.name if r.structure else ""
        out.append(resp)
    return out


@router.get("/rules/{rule_id}", response_model=SalaryRuleResponse)
async def get_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_USER)),
):
    result = await db.execute(
        select(SalaryRule).options(selectinload(SalaryRule.structure)).where(SalaryRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Salary rule not found.")
    resp = SalaryRuleResponse.model_validate(rule)
    resp.structure_name = rule.structure.name if rule.structure else ""
    return resp


@router.post("/rules", response_model=SalaryRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(
    data: SalaryRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_MANAGER)),
):
    # Validate structure exists
    struct_result = await db.execute(
        select(SalaryStructure).where(SalaryStructure.id == data.structure_id)
    )
    if not struct_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Salary structure not found.")

    # Check for duplicate code in the same structure
    existing = await db.execute(
        select(SalaryRule).where(
            SalaryRule.structure_id == data.structure_id,
            SalaryRule.code == data.code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"A salary rule with code '{data.code}' already exists in this structure.",
        )

    rule = SalaryRule(**data.model_dump())
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return SalaryRuleResponse.model_validate(rule)


@router.put("/rules/{rule_id}", response_model=SalaryRuleResponse)
async def update_rule(
    rule_id: int,
    data: SalaryRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_MANAGER)),
):
    result = await db.execute(select(SalaryRule).where(SalaryRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Salary rule not found.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    await db.flush()
    await db.refresh(rule)
    return SalaryRuleResponse.model_validate(rule)


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role(UserRole.HR_PAYROLL_MANAGER)),
):
    result = await db.execute(select(SalaryRule).where(SalaryRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Salary rule not found.")
    await db.delete(rule)
