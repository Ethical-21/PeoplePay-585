"""
Dashboard router — Live KPIs, charts data, and warning alerts.
All values are dynamically queried from the database.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, case, and_, or_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.employee import Employee, EmployeeStatus
from app.models.department import Department
from app.models.contract import Contract, ContractStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.models.payroll import Payslip, Payrun, PayslipStatus, PayrunStatus
from app.models.timeoff import TimeOffRequest, TimeOffStatus
from app.models.payroll import Payrun, Payslip, PayrunStatus
from app.auth.dependencies import require_min_role, get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get live dashboard KPI statistics."""
    today = date.today()
    is_hr = UserRole.HR_MANAGER in current_user.roles or UserRole.ADMIN in current_user.roles

    try:
        if not is_hr:
            # Get employee ID
            emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
            emp = emp_result.scalar_one_or_none()
            emp_id = emp.id if emp else -1

            # Latest payslip stats
            latest_payslip = await db.execute(
                select(Payslip).where(Payslip.employee_id == emp_id).order_by(Payslip.created_at.desc()).limit(1)
            )
            payslip = latest_payslip.scalar_one_or_none()
            
            # Pending leave requests
            pending_leaves = await db.execute(
                select(func.count()).where(TimeOffRequest.status == TimeOffStatus.PENDING, TimeOffRequest.employee_id == emp_id)
            )
            
            month_start = today.replace(day=1)
            approved_leaves = await db.execute(
                select(func.count()).where(
                    TimeOffRequest.status == TimeOffStatus.APPROVED,
                    TimeOffRequest.start_date >= month_start,
                    TimeOffRequest.employee_id == emp_id
                )
            )
            
            today_attendance = await db.execute(
                select(func.count()).where(Attendance.date == today, Attendance.employee_id == emp_id)
            )

            return {
                "total_employees": 1,
                "total_net_salary": float(payslip.net_salary) if payslip else 0.0,
                "total_payslips": 1 if payslip else 0,
                "average_salary": float(payslip.net_salary) if payslip else 0.0,
                "pending_leave_requests": pending_leaves.scalar() or 0,
                "approved_leaves_this_month": approved_leaves.scalar() or 0,
                "today_attendance": today_attendance.scalar() or 0,
                "latest_payrun": {
                    "id": payslip.payrun_id if payslip else None,
                    "name": f"PR-{payslip.payrun_id}" if payslip else None,
                    "status": payslip.status.value if payslip else None,
                },
            }
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=traceback.format_exc())

    # Total active employees
    emp_count = await db.execute(
        select(func.count()).where(Employee.status == EmployeeStatus.ACTIVE)
    )
    total_employees = emp_count.scalar() or 0

    # Latest payrun stats
    latest_payrun = await db.execute(
        select(Payrun)
        .where(
            Payrun.status.in_([PayrunStatus.COMPUTED, PayrunStatus.VALIDATED, PayrunStatus.PAID]),
            select(func.count()).where(Payslip.payrun_id == Payrun.id).scalar_subquery() > 0
        )
        .order_by(Payrun.created_at.desc())
        .limit(1)
    )
    latest = latest_payrun.scalar_one_or_none()

    total_net_salary = Decimal("0.00")
    total_payslips = 0
    avg_salary = Decimal("0.00")

    if latest:
        payslip_stats = await db.execute(
            select(
                func.count(Payslip.id),
                func.coalesce(func.sum(Payslip.net_salary), 0),
                func.coalesce(func.avg(Payslip.net_salary), 0),
            ).where(Payslip.payrun_id == latest.id)
        )
        row = payslip_stats.one()
        total_payslips = row[0] or 0
        total_net_salary = Decimal(str(row[1]))
        avg_salary = Decimal(str(row[2])).quantize(Decimal("0.01"))

    # Pending leave requests
    pending_leaves = await db.execute(
        select(func.count()).where(TimeOffRequest.status == TimeOffStatus.PENDING)
    )
    pending_leave_count = pending_leaves.scalar() or 0

    # Approved leaves this month
    month_start = today.replace(day=1)
    approved_leaves = await db.execute(
        select(func.count()).where(
            TimeOffRequest.status == TimeOffStatus.APPROVED,
            TimeOffRequest.start_date >= month_start,
        )
    )
    approved_leave_count = approved_leaves.scalar() or 0

    # Today's attendance
    today_attendance = await db.execute(
        select(func.count()).where(Attendance.date == today)
    )
    today_present = today_attendance.scalar() or 0

    return {
        "total_employees": total_employees,
        "total_net_salary": float(total_net_salary),
        "total_payslips": total_payslips,
        "average_salary": float(avg_salary),
        "pending_leave_requests": pending_leave_count,
        "approved_leaves_this_month": approved_leave_count,
        "today_attendance": today_present,
        "latest_payrun": {
            "id": latest.id if latest else None,
            "name": latest.name if latest else None,
            "status": latest.status.value if latest else None,
        },
    }


@router.get("/charts/department-salary")
async def get_department_salary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get total salary by department (from latest payrun)."""
    is_hr = UserRole.HR_MANAGER in current_user.roles or UserRole.ADMIN in current_user.roles
    if not is_hr:
        return []

    latest_payrun = await db.execute(
        select(Payrun)
        .where(
            Payrun.status.in_([PayrunStatus.COMPUTED, PayrunStatus.VALIDATED, PayrunStatus.PAID]),
            select(func.count()).where(Payslip.payrun_id == Payrun.id).scalar_subquery() > 0
        )
        .order_by(Payrun.created_at.desc())
        .limit(1)
    )
    latest = latest_payrun.scalar_one_or_none()
    if not latest:
        return []

    result = await db.execute(
        select(
            Department.name,
            func.coalesce(func.sum(Payslip.net_salary), 0).label("total"),
            func.count(Payslip.id).label("count"),
        )
        .join(Employee, Payslip.employee_id == Employee.id)
        .join(Department, Employee.department_id == Department.id)
        .where(Payslip.payrun_id == latest.id)
        .group_by(Department.name)
        .order_by(func.sum(Payslip.net_salary).desc())
    )

    return [
        {"department": row[0], "total_salary": float(row[1]), "employee_count": row[2]}
        for row in result.all()
    ]


@router.get("/charts/employee-distribution")
async def get_employee_distribution(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get employee count by department."""
    is_hr = UserRole.HR_MANAGER in current_user.roles or UserRole.ADMIN in current_user.roles
    if not is_hr:
        return []

    result = await db.execute(
        select(
            Department.name,
            func.count(Employee.id).label("count"),
        )
        .join(Employee, Employee.department_id == Department.id)
        .where(Employee.status == EmployeeStatus.ACTIVE)
        .group_by(Department.name)
        .order_by(func.count(Employee.id).desc())
    )

    return [{"department": row[0], "count": row[1]} for row in result.all()]


@router.get("/charts/attendance-overview")
async def get_attendance_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get attendance status breakdown for the current week."""
    is_hr = UserRole.HR_MANAGER in current_user.roles or UserRole.ADMIN in current_user.roles
    if not is_hr:
        return []

    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    result = await db.execute(
        select(
            Attendance.date,
            Attendance.status,
            func.count(Attendance.id).label("count"),
        )
        .where(Attendance.date >= week_start, Attendance.date <= today)
        .group_by(Attendance.date, Attendance.status)
        .order_by(Attendance.date)
    )

    return [
        {"date": str(row[0]), "status": row[1].value, "count": row[2]}
        for row in result.all()
    ]


@router.get("/warnings")
async def get_dashboard_warnings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get actionable warning alerts for the dashboard."""
    is_hr = UserRole.HR_MANAGER in current_user.roles or UserRole.ADMIN in current_user.roles
    if not is_hr:
        return []

    warnings = []
    today = date.today()

    # 1. Employees without active contracts
    no_contract_result = await db.execute(
        select(Employee)
        .where(Employee.status == EmployeeStatus.ACTIVE)
        .where(
            ~Employee.id.in_(
                select(Contract.employee_id).where(Contract.status == ContractStatus.ACTIVE)
            )
        )
    )
    no_contract = no_contract_result.scalars().all()
    for emp in no_contract:
        warnings.append({
            "type": "missing_contract",
            "severity": "high",
            "message": f"{emp.full_name} ({emp.employee_number}) has no active contract.",
            "entity_type": "employee",
            "entity_id": emp.id,
        })

    # 2. Contracts expiring within 30 days
    expiry_date = today + timedelta(days=30)
    expiring_result = await db.execute(
        select(Contract)
        .where(
            Contract.status == ContractStatus.ACTIVE,
            Contract.end_date.isnot(None),
            Contract.end_date <= expiry_date,
            Contract.end_date >= today,
        )
    )
    for contract in expiring_result.scalars().all():
        days_left = (contract.end_date - today).days
        warnings.append({
            "type": "contract_expiring",
            "severity": "medium",
            "message": f"Contract '{contract.name}' for Employee #{contract.employee_id} expires in {days_left} day(s).",
            "entity_type": "contract",
            "entity_id": contract.id,
        })

    # 3. Pending leave requests older than 3 days
    old_pending = await db.execute(
        select(TimeOffRequest).where(
            TimeOffRequest.status == TimeOffStatus.PENDING,
            TimeOffRequest.created_at <= datetime.now() - timedelta(days=3),
        )
    )
    for req in old_pending.scalars().all():
        warnings.append({
            "type": "pending_leave",
            "severity": "medium",
            "message": f"Leave request #{req.id} for Employee #{req.employee_id} has been pending for over 3 days.",
            "entity_type": "timeoff_request",
            "entity_id": req.id,
        })

    # 4. Employees with missing critical information
    incomplete_result = await db.execute(
        select(Employee).where(
            Employee.status == EmployeeStatus.ACTIVE,
            or_(
                Employee.department_id.is_(None),
                Employee.job_title.is_(None),
                Employee.date_of_birth.is_(None),
            ),
        )
    )
    for emp in incomplete_result.scalars().all():
        missing = []
        if emp.department_id is None:
            missing.append("department")
        if emp.job_title is None:
            missing.append("job title")
        if emp.date_of_birth is None:
            missing.append("date of birth")
        warnings.append({
            "type": "incomplete_profile",
            "severity": "low",
            "message": f"{emp.full_name} ({emp.employee_number}) is missing: {', '.join(missing)}.",
            "entity_type": "employee",
            "entity_id": emp.id,
        })

    # 5. Payslips in Draft Status
    draft_payslips = await db.execute(
        select(Payslip).where(Payslip.status == PayslipStatus.DRAFT)
    )
    draft_count = len(draft_payslips.scalars().all())
    if draft_count > 0:
        warnings.append({
            "type": "payslips_draft",
            "severity": "medium",
            "message": f"{draft_count} payslip(s) are in Draft status waiting for confirmation.",
            "entity_type": "payslip",
            "entity_id": 0,
        })

    # 6. Payruns in Draft Status
    draft_payruns = await db.execute(
        select(Payrun).where(Payrun.status == PayrunStatus.DRAFT)
    )
    draft_payrun_count = len(draft_payruns.scalars().all())
    if draft_payrun_count > 0:
        warnings.append({
            "type": "payruns_draft",
            "severity": "high",
            "message": f"{draft_payrun_count} payrun(s) are in Draft status waiting to be computed.",
            "entity_type": "payrun",
            "entity_id": 0,
        })

    return {
        "total_warnings": len(warnings),
        "warnings": warnings,
    }


@router.get("/extended-stats")
async def get_extended_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extended stats for the enhanced dashboard."""
    today = date.today()
    month_start = today.replace(day=1)
    is_hr = UserRole.HR_MANAGER in current_user.roles or UserRole.ADMIN in current_user.roles

    result = {
        "attendance_health": 0,
        "approved_timeoff_days": 0,
        "payslip_status_split": [],
        "monthly_trend": [],
        "timeoff_overview": [],
        "attendance_overview": [],
        "department_overview": [],
    }

    emp_id_filter = None
    if not is_hr:
        emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        emp = emp_result.scalar_one_or_none()
        if not emp:
            return result
        emp_id_filter = emp.id

    try:
        if emp_id_filter:
            att_total_q = select(func.count(Attendance.id)).where(Attendance.date >= month_start, Attendance.date <= today, Attendance.employee_id == emp_id_filter)
            att_present_q = select(func.count(Attendance.id)).where(Attendance.date >= month_start, Attendance.date <= today, Attendance.status == AttendanceStatus.PRESENT, Attendance.employee_id == emp_id_filter)
        else:
            att_total_q = select(func.count(Attendance.id)).where(Attendance.date >= month_start, Attendance.date <= today)
            att_present_q = select(func.count(Attendance.id)).where(Attendance.date >= month_start, Attendance.date <= today, Attendance.status == AttendanceStatus.PRESENT)
            
        att_total = await db.execute(att_total_q)
        att_present = await db.execute(att_present_q)
        total_att = att_total.scalar() or 0
        present_att = att_present.scalar() or 0
        result["attendance_health"] = round((present_att / total_att * 100) if total_att > 0 else 0, 1)
    except Exception:
        await db.rollback()

    try:
        if emp_id_filter:
            app_timeoff_q = select(func.coalesce(func.sum(TimeOffRequest.days), 0)).where(TimeOffRequest.status == TimeOffStatus.APPROVED, TimeOffRequest.start_date >= month_start, TimeOffRequest.employee_id == emp_id_filter)
        else:
            app_timeoff_q = select(func.coalesce(func.sum(TimeOffRequest.days), 0)).where(TimeOffRequest.status == TimeOffStatus.APPROVED, TimeOffRequest.start_date >= month_start)
            
        approved_timeoff = await db.execute(app_timeoff_q)
        result["approved_timeoff_days"] = float(approved_timeoff.scalar() or 0)
    except Exception:
        await db.rollback()

    try:
        latest_payrun = await db.execute(
            select(Payrun)
            .where(
                Payrun.status.in_([PayrunStatus.COMPUTED, PayrunStatus.VALIDATED, PayrunStatus.PAID]),
                select(func.count()).where(Payslip.payrun_id == Payrun.id).scalar_subquery() > 0
            )
            .order_by(Payrun.created_at.desc())
            .limit(1)
        )
        latest = latest_payrun.scalar_one_or_none()
        if latest:
            status_result = await db.execute(
                select(Payslip.status, func.count(Payslip.id))
                .where(Payslip.payrun_id == latest.id)
                .group_by(Payslip.status)
            )
            for row in status_result.all():
                result["payslip_status_split"].append({
                    "status": row[0].value if hasattr(row[0], 'value') else str(row[0]),
                    "count": row[1],
                })
    except Exception:
        await db.rollback()

    try:
        # Monthly Net Salary Trend — use extract(year/month) to avoid GROUP BY issues
        six_months_ago = today.replace(day=1) - timedelta(days=180)
        m_year = extract('year', Payrun.period_start).label("yr")
        m_month = extract('month', Payrun.period_start).label("mn")
        trend_result = await db.execute(
            select(
                m_year, m_month,
                func.coalesce(func.sum(Payslip.net_salary), 0).label("total"),
            )
            .join(Payslip, Payslip.payrun_id == Payrun.id)
            .where(
                Payrun.status.in_([PayrunStatus.COMPUTED, PayrunStatus.VALIDATED, PayrunStatus.PAID]),
                Payrun.period_start >= six_months_ago,
            )
            .group_by(m_year, m_month)
            .order_by(m_year, m_month)
        )
        month_names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        for row in trend_result.all():
            yr, mn, total = int(row[0]), int(row[1]), float(row[2])
            label = f"{month_names[mn]} {yr}"
            result["monthly_trend"].append({"month": label, "salary": total})
    except Exception:
        await db.rollback()

    try:
        from app.models.timeoff import TimeOffType
        to_result = await db.execute(
            select(
                TimeOffType.name,
                func.sum(case((TimeOffRequest.status == TimeOffStatus.APPROVED, TimeOffRequest.days), else_=0)).label("approved_days"),
                func.count(case((TimeOffRequest.status == TimeOffStatus.PENDING, 1))).label("pending"),
                func.sum(case((TimeOffRequest.status == TimeOffStatus.PENDING, TimeOffRequest.days), else_=0)).label("pending_days"),
            )
            .join(TimeOffRequest, TimeOffRequest.time_off_type_id == TimeOffType.id)
            .group_by(TimeOffType.name)
        )
        for row in to_result.all():
            result["timeoff_overview"].append({
                "type": row[0],
                "approved_days": float(row[1] or 0),
                "pending": int(row[2] or 0),
                "remaining_balance": float(row[3] or 0),
            })
    except Exception:
        await db.rollback()

    try:
        att_overview_result = await db.execute(
            select(Attendance.status, func.count(Attendance.id).label("count"))
            .where(Attendance.date >= month_start, Attendance.date <= today)
            .group_by(Attendance.status)
        )
        for row in att_overview_result.all():
            result["attendance_overview"].append({
                "status": row[0].value if hasattr(row[0], 'value') else str(row[0]),
                "count": row[1],
            })
    except Exception:
        await db.rollback()

    try:
        dept_result = await db.execute(
            select(
                Department.name,
                func.count(func.distinct(Employee.id)).label("headcount"),
                func.coalesce(func.sum(
                    case((Contract.status == ContractStatus.ACTIVE, Contract.wage), else_=0)
                ), 0).label("monthly_salary"),
            )
            .join(Employee, Employee.department_id == Department.id)
            .outerjoin(Contract, Contract.employee_id == Employee.id)
            .where(Employee.status == EmployeeStatus.ACTIVE)
            .group_by(Department.name)
            .order_by(Department.name)
        )
        for row in dept_result.all():
            result["department_overview"].append({
                "department": row[0],
                "headcount": row[1],
                "monthly_salary": float(row[2] or 0),
            })
    except Exception:
        await db.rollback()

    return result


@router.get("/filters/departments")
async def get_department_filter(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get department names for dashboard filter dropdown."""
    result = await db.execute(
        select(Department.id, Department.name).order_by(Department.name)
    )
    return [{"id": row[0], "name": row[1]} for row in result.all()]

