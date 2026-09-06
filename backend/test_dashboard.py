"""Quick diagnostic to test the dashboard extended-stats queries."""
import asyncio
import traceback
from app.database import AsyncSessionLocal
from sqlalchemy import select, func, case
from app.models.timeoff import TimeOffRequest, TimeOffType, TimeOffStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.models.department import Department
from app.models.employee import Employee, EmployeeStatus
from app.models.contract import Contract, ContractStatus
from app.models.payroll import Payrun, Payslip, PayrunStatus
from datetime import date, timedelta


async def test():
    async with AsyncSessionLocal() as db:
        today = date.today()
        month_start = today.replace(day=1)

        # Test monthly trend
        try:
            six_months_ago = today.replace(day=1) - timedelta(days=180)
            trend_result = await db.execute(
                select(
                    func.date_trunc('month', Payrun.period_start).label("month"),
                    func.coalesce(func.sum(Payslip.net_salary), 0).label("total"),
                )
                .join(Payslip, Payslip.payrun_id == Payrun.id)
                .where(
                    Payrun.status.in_([PayrunStatus.COMPUTED, PayrunStatus.VALIDATED, PayrunStatus.PAID]),
                    Payrun.period_start >= six_months_ago,
                )
                .group_by(func.date_trunc('month', Payrun.period_start))
                .order_by(func.date_trunc('month', Payrun.period_start))
            )
            rows = trend_result.all()
            print(f"monthly_trend rows: {len(rows)}")
            for row in rows:
                print(f"  {row}")
        except Exception as e:
            print(f"monthly_trend ERROR: {e}")
            traceback.print_exc()

        # Test timeoff overview
        try:
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
            rows = to_result.all()
            print(f"timeoff_overview rows: {len(rows)}")
            for row in rows:
                print(f"  {row}")
        except Exception as e:
            print(f"timeoff_overview ERROR: {e}")
            traceback.print_exc()

        # Test attendance overview
        try:
            att_overview_result = await db.execute(
                select(Attendance.status, func.count(Attendance.id).label("count"))
                .where(Attendance.date >= month_start, Attendance.date <= today)
                .group_by(Attendance.status)
            )
            rows = att_overview_result.all()
            print(f"attendance_overview rows: {len(rows)}")
            for row in rows:
                print(f"  {row}")
        except Exception as e:
            print(f"attendance_overview ERROR: {e}")
            traceback.print_exc()

        # Test department overview
        try:
            dept_result = await db.execute(
                select(
                    Department.name,
                    func.count(Employee.id).label("headcount"),
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
            rows = dept_result.all()
            print(f"department_overview rows: {len(rows)}")
            for row in rows:
                print(f"  {row}")
        except Exception as e:
            print(f"department_overview ERROR: {e}")
            traceback.print_exc()


asyncio.run(test())
