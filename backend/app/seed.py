"""
PeoplePay585 — Database Seed Script

Creates the admin user and sample demo data for the hackathon demo.
Run with: python -m app.seed
"""

import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal, init_db
from app.models.user import User, UserRole
from app.auth.router import hash_password

# Import all models to register metadata
import app.models  # noqa: F401


async def seed():
    """Seed the database with demo data."""
    print("[SEED] Initializing database...")
    await init_db()

    async with AsyncSessionLocal() as db:
        # ── 1. Create admin user ──
        existing = await db.execute(select(User).where(User.email == "admin@peoplepay585.com"))
        if not existing.scalar_one_or_none():
            admin = User(
                email="admin@peoplepay585.com",
                hashed_password=hash_password("admin123"),
                full_name="System Admin",
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin)
            print("[SEED] Created admin user: admin@peoplepay585.com / admin123")
        else:
            print("[SEED] Admin user already exists.")

        # ── 2. Create demo users for each role ──
        demo_users = [
            ("hr@peoplepay585.com", "hr123", "HR Manager", UserRole.HR_MANAGER),
            ("payroll@peoplepay585.com", "payroll123", "Payroll Manager", UserRole.HR_PAYROLL_MANAGER),
            ("user@peoplepay585.com", "user123", "Payroll User", UserRole.HR_PAYROLL_USER),
            ("employee@peoplepay585.com", "employee123", "John Employee", UserRole.EMPLOYEE),
        ]

        for email, password, name, role in demo_users:
            existing = await db.execute(select(User).where(User.email == email))
            if not existing.scalar_one_or_none():
                user = User(
                    email=email,
                    hashed_password=hash_password(password),
                    full_name=name,
                    role=role,
                    is_active=True,
                )
                db.add(user)
                print(f"[SEED] Created user: {email} / {password} ({role.value})")

        # ── 3. Create sample departments ──
        from app.models.department import Department
        
        depts_data = [
            ("Engineering", "ENG", "Builds the product"),
            ("Human Resources", "HR", "People & culture"),
            ("Finance", "FIN", "Financial operations"),
            ("Marketing", "MKT", "Brand and outreach"),
            ("Operations", "OPS", "Day-to-day business operations"),
        ]
        
        dept_objects = {}
        for name, code, desc in depts_data:
            existing = await db.execute(select(Department).where(Department.code == code))
            dept = existing.scalar_one_or_none()
            if not dept:
                dept = Department(name=name, code=code, description=desc)
                db.add(dept)
                await db.flush()
                print(f"[SEED] Created department: {name}")
            dept_objects[code] = dept

        # ── 4. Create sample employees ──
        from app.models.employee import Employee, EmployeeStatus, Gender
        from datetime import date

        employees_data = [
            ("EMP001", "Aarav", "Sharma", "aarav@peoplepay585.com", "Engineering Lead", "ENG", date(1990, 5, 15)),
            ("EMP002", "Priya", "Patel", "priya@peoplepay585.com", "HR Specialist", "HR", date(1992, 8, 20)),
            ("EMP003", "Rahul", "Kumar", "rahul@peoplepay585.com", "Finance Analyst", "FIN", date(1988, 3, 10)),
            ("EMP004", "Neha", "Singh", "neha@peoplepay585.com", "Marketing Manager", "MKT", date(1991, 12, 5)),
            ("EMP005", "Vikram", "Reddy", "vikram@peoplepay585.com", "Senior Developer", "ENG", date(1993, 7, 22)),
            ("EMP006", "Ananya", "Gupta", "ananya@peoplepay585.com", "Operations Analyst", "OPS", date(1994, 1, 30)),
            ("EMP007", "Arjun", "Nair", "arjun@peoplepay585.com", "Junior Developer", "ENG", date(1996, 9, 12)),
            ("EMP008", "Meera", "Joshi", "meera@peoplepay585.com", "Payroll Specialist", "FIN", date(1989, 6, 18)),
        ]

        emp_objects = {}
        for emp_num, first, last, email, title, dept_code, dob in employees_data:
            existing = await db.execute(select(Employee).where(Employee.employee_number == emp_num))
            emp = existing.scalar_one_or_none()
            if not emp:
                emp = Employee(
                    employee_number=emp_num,
                    first_name=first,
                    last_name=last,
                    email=email,
                    job_title=title,
                    department_id=dept_objects[dept_code].id,
                    date_of_birth=dob,
                    joining_date=date(2024, 1, 15),
                    gender=Gender.MALE if first in ("Aarav", "Rahul", "Vikram", "Arjun") else Gender.FEMALE,
                    status=EmployeeStatus.ACTIVE,
                )
                db.add(emp)
                await db.flush()
                print(f"[SEED] Created employee: {first} {last} ({emp_num})")
            emp_objects[emp_num] = emp

        # ── 4b. Link users to employees ──
        user_employee_links = {
            "admin@peoplepay585.com": "EMP001",
            "hr@peoplepay585.com": "EMP002",
            "payroll@peoplepay585.com": "EMP008",
            "user@peoplepay585.com": "EMP003",
            "employee@peoplepay585.com": "EMP007",
        }
        for user_email, emp_num in user_employee_links.items():
            user_result = await db.execute(select(User).where(User.email == user_email))
            user_obj = user_result.scalar_one_or_none()
            emp_obj = emp_objects.get(emp_num)
            if user_obj and emp_obj and emp_obj.user_id is None:
                emp_obj.user_id = user_obj.id
                print(f"[SEED] Linked {user_email} -> {emp_num}")
        await db.flush()

        # ── 5. Create sample contracts ──
        from app.models.contract import Contract, ContractStatus, WageType

        wages = {
            "EMP001": 85000, "EMP002": 55000, "EMP003": 65000, "EMP004": 70000,
            "EMP005": 75000, "EMP006": 50000, "EMP007": 40000, "EMP008": 60000,
        }

        for emp_num, wage in wages.items():
            emp = emp_objects.get(emp_num)
            if not emp:
                continue
            existing = await db.execute(
                select(Contract).where(Contract.employee_id == emp.id, Contract.status == ContractStatus.ACTIVE)
            )
            if not existing.scalar_one_or_none():
                contract = Contract(
                    name=f"{emp.first_name}'s Employment Contract",
                    employee_id=emp.id,
                    start_date=date(2024, 1, 15),
                    wage=wage,
                    wage_type=WageType.MONTHLY,
                    status=ContractStatus.ACTIVE,
                )
                db.add(contract)
                print(f"[SEED] Created contract for {emp.first_name} (wage: {wage})")

        # ── 6. Create salary structure ──
        from app.models.salary import SalaryStructure, SalaryRule, RuleCategory, CalculationType

        existing = await db.execute(select(SalaryStructure).where(SalaryStructure.code == "STD_MONTHLY"))
        structure = existing.scalar_one_or_none()
        if not structure:
            structure = SalaryStructure(
                name="Standard Monthly Salary",
                code="STD_MONTHLY",
                description="Default salary structure for monthly-paid employees",
                is_active=True,
            )
            db.add(structure)
            await db.flush()
            print("[SEED] Created salary structure: Standard Monthly Salary")

            rules = [
                SalaryRule(
                    structure_id=structure.id, name="Basic Salary", code="BASIC",
                    category=RuleCategory.BASIC, calculation_type=CalculationType.FIXED,
                    sequence=10, appears_on_payslip=True, is_active=True,
                ),
                SalaryRule(
                    structure_id=structure.id, name="House Rent Allowance", code="HRA",
                    category=RuleCategory.ALLOWANCE, calculation_type=CalculationType.PERCENTAGE,
                    sequence=20, percentage=40.0, percentage_of="BASIC",
                    appears_on_payslip=True, is_active=True,
                ),
                SalaryRule(
                    structure_id=structure.id, name="Conveyance Allowance", code="CA",
                    category=RuleCategory.ALLOWANCE, calculation_type=CalculationType.FIXED,
                    sequence=30, fixed_amount=1600,
                    appears_on_payslip=True, is_active=True,
                ),
                SalaryRule(
                    structure_id=structure.id, name="Medical Allowance", code="MA",
                    category=RuleCategory.ALLOWANCE, calculation_type=CalculationType.FIXED,
                    sequence=40, fixed_amount=1250,
                    appears_on_payslip=True, is_active=True,
                ),
                SalaryRule(
                    structure_id=structure.id, name="Gross Salary", code="GROSS",
                    category=RuleCategory.GROSS, calculation_type=CalculationType.FORMULA,
                    sequence=100, formula="BASIC + HRA + CA + MA",
                    appears_on_payslip=True, is_active=True,
                ),
                SalaryRule(
                    structure_id=structure.id, name="Provident Fund", code="PF",
                    category=RuleCategory.DEDUCTION, calculation_type=CalculationType.PERCENTAGE,
                    sequence=200, percentage=12.0, percentage_of="BASIC",
                    appears_on_payslip=True, is_active=True,
                ),
                SalaryRule(
                    structure_id=structure.id, name="Professional Tax", code="PT",
                    category=RuleCategory.DEDUCTION, calculation_type=CalculationType.FIXED,
                    sequence=210, fixed_amount=200,
                    appears_on_payslip=True, is_active=True,
                ),
                SalaryRule(
                    structure_id=structure.id, name="Net Salary", code="NET",
                    category=RuleCategory.NET, calculation_type=CalculationType.FORMULA,
                    sequence=999, formula="GROSS - PF - PT",
                    appears_on_payslip=True, is_active=True,
                ),
            ]
            db.add_all(rules)
            print("[SEED] Created 8 salary rules (BASIC, HRA, CA, MA, GROSS, PF, PT, NET)")
        else:
            print("[SEED] Salary structure already exists.")

        # ── 7. Create time off types ──
        from app.models.timeoff import TimeOffType

        leave_types = [
            ("Casual Leave", "CL", True, "#3b82f6"),
            ("Sick Leave", "SL", True, "#ef4444"),
            ("Earned Leave", "EL", True, "#10b981"),
            ("Maternity Leave", "ML", True, "#8b5cf6"),
        ]

        for name, code, is_paid, color in leave_types:
            existing = await db.execute(select(TimeOffType).where(TimeOffType.code == code))
            if not existing.scalar_one_or_none():
                tt = TimeOffType(
                    name=name, code=code,
                    is_paid=is_paid,
                    color=color,
                )
                db.add(tt)
                print(f"[SEED] Created leave type: {name} ({code})")

        # ── 8. Create working schedules ──
        from app.models.schedule import WorkingSchedule
        from datetime import time as time_type

        schedules_data = [
            {
                "name": "40 Hours / Week",
                "company": "My Company",
                "timezone": "Asia/Kolkata",
                "status": "active",
                "monday_start": time_type(9, 0), "monday_end": time_type(18, 0),
                "tuesday_start": time_type(9, 0), "tuesday_end": time_type(18, 0),
                "wednesday_start": time_type(9, 0), "wednesday_end": time_type(18, 0),
                "thursday_start": time_type(9, 0), "thursday_end": time_type(18, 0),
                "friday_start": time_type(9, 0), "friday_end": time_type(18, 0),
                "break_duration_minutes": 60,
            },
            {
                "name": "Night Shift",
                "company": "My Company",
                "timezone": "Asia/Kolkata",
                "status": "active",
                "monday_start": time_type(22, 0), "monday_end": time_type(23, 59),
                "tuesday_start": time_type(22, 0), "tuesday_end": time_type(23, 59),
                "wednesday_start": time_type(22, 0), "wednesday_end": time_type(23, 59),
                "thursday_start": time_type(22, 0), "thursday_end": time_type(23, 59),
                "friday_start": time_type(22, 0), "friday_end": time_type(23, 59),
                "break_duration_minutes": 30,
            },
            {
                "name": "Retail Weekend",
                "company": "My Company",
                "timezone": "Asia/Kolkata",
                "status": "active",
                "monday_start": time_type(10, 0), "monday_end": time_type(19, 0),
                "tuesday_start": time_type(10, 0), "tuesday_end": time_type(19, 0),
                "wednesday_start": time_type(10, 0), "wednesday_end": time_type(19, 0),
                "thursday_start": time_type(10, 0), "thursday_end": time_type(19, 0),
                "friday_start": time_type(10, 0), "friday_end": time_type(19, 0),
                "saturday_start": time_type(10, 0), "saturday_end": time_type(16, 0),
                "break_duration_minutes": 60,
            },
            {
                "name": "Flexible Hybrid",
                "company": "My Company",
                "timezone": "Asia/Kolkata",
                "status": "active",
                "monday_start": time_type(9, 0), "monday_end": time_type(17, 30),
                "tuesday_start": time_type(9, 0), "tuesday_end": time_type(17, 30),
                "wednesday_start": time_type(9, 0), "wednesday_end": time_type(17, 30),
                "thursday_start": time_type(9, 0), "thursday_end": time_type(17, 30),
                "friday_start": time_type(9, 0), "friday_end": time_type(14, 0),
                "break_duration_minutes": 60,
            },
            {
                "name": "Part-time 20h",
                "company": "My Company",
                "timezone": "Asia/Kolkata",
                "status": "inactive",
                "monday_start": time_type(9, 0), "monday_end": time_type(14, 0),
                "tuesday_start": time_type(9, 0), "tuesday_end": time_type(14, 0),
                "wednesday_start": time_type(9, 0), "wednesday_end": time_type(14, 0),
                "thursday_start": time_type(9, 0), "thursday_end": time_type(14, 0),
                "break_duration_minutes": 60,
            },
        ]

        schedule_objects = {}
        for sched_data in schedules_data:
            sched_name = sched_data["name"]
            existing = await db.execute(select(WorkingSchedule).where(WorkingSchedule.name == sched_name))
            sched = existing.scalar_one_or_none()
            if not sched:
                sched = WorkingSchedule(**sched_data)
                db.add(sched)
                await db.flush()
                print(f"[SEED] Created working schedule: {sched_name}")
            schedule_objects[sched_name] = sched

        # Assign schedules to contracts
        await db.flush()
        all_contracts = await db.execute(select(Contract))
        contracts_list = all_contracts.scalars().all()
        main_schedule = schedule_objects.get("40 Hours / Week")
        if main_schedule:
            for c in contracts_list:
                if c.working_schedule_id is None:
                    c.working_schedule_id = main_schedule.id
            await db.flush()
            print(f"[SEED] Assigned '40 Hours / Week' to {len(contracts_list)} contracts")

        # ── 9. Create attendance records (last 5 working days) ──
        from app.models.attendance import Attendance, AttendanceStatus
        from datetime import timedelta, datetime as dt_cls, timezone

        today = date.today()
        # Get last 5 working days
        work_days = []
        d = today - timedelta(days=1)
        while len(work_days) < 5:
            if d.weekday() < 5:  # Mon-Fri
                work_days.append(d)
            d -= timedelta(days=1)
        work_days.reverse()

        for emp_num, emp in emp_objects.items():
            for wd in work_days:
                existing = await db.execute(
                    select(Attendance).where(
                        Attendance.employee_id == emp.id,
                        Attendance.date == wd
                    )
                )
                if not existing.scalar_one_or_none():
                    # Vary check-in times slightly
                    hour_offset = hash(f"{emp_num}{wd}") % 3  # 0, 1, or 2
                    minute_offset = hash(f"{wd}{emp_num}") % 30
                    check_in_time = dt_cls(wd.year, wd.month, wd.day, 9 + hour_offset, minute_offset, tzinfo=timezone.utc)
                    check_out_time = dt_cls(wd.year, wd.month, wd.day, 17 + hour_offset, (minute_offset + 15) % 60, tzinfo=timezone.utc)
                    worked = round((check_out_time - check_in_time).total_seconds() / 3600.0, 2)

                    status = AttendanceStatus.PRESENT
                    if hour_offset >= 1:
                        status = AttendanceStatus.LATE

                    att = Attendance(
                        employee_id=emp.id,
                        date=wd,
                        check_in=check_in_time,
                        check_out=check_out_time,
                        worked_hours=worked,
                        status=status,
                    )
                    db.add(att)
            print(f"[SEED] Created attendance records for {emp.first_name}")

        # ── 10. Create time off allocations (2026) ──
        from app.models.timeoff import TimeOffAllocation, TimeOffRequest, TimeOffStatus, TimeOffType

        leave_type_results = await db.execute(select(TimeOffType))
        leave_types_objs = {lt.code: lt for lt in leave_type_results.scalars().all()}

        allocation_plan = {
            "CL": 12,  # 12 casual leave days
            "SL": 10,  # 10 sick leave days
            "EL": 15,  # 15 earned leave days
        }

        for emp_num, emp in emp_objects.items():
            for code, days in allocation_plan.items():
                lt = leave_types_objs.get(code)
                if not lt:
                    continue
                existing = await db.execute(
                    select(TimeOffAllocation).where(
                        TimeOffAllocation.employee_id == emp.id,
                        TimeOffAllocation.time_off_type_id == lt.id,
                        TimeOffAllocation.year == 2026,
                    )
                )
                if not existing.scalar_one_or_none():
                    # Some employees have used a few days
                    used = hash(f"{emp_num}{code}") % 4  # 0-3 days used
                    alloc = TimeOffAllocation(
                        employee_id=emp.id,
                        time_off_type_id=lt.id,
                        total_days=days,
                        used_days=float(used),
                        year=2026,
                    )
                    db.add(alloc)
            print(f"[SEED] Created time off allocations for {emp.first_name}")

        # ── 11. Create sample time off requests ──
        # Pending request from EMP005 (Vikram)
        emp5 = emp_objects.get("EMP005")
        cl_type = leave_types_objs.get("CL")
        if emp5 and cl_type:
            existing = await db.execute(
                select(TimeOffRequest).where(
                    TimeOffRequest.employee_id == emp5.id,
                    TimeOffRequest.status == TimeOffStatus.PENDING,
                )
            )
            if not existing.scalar_one_or_none():
                req = TimeOffRequest(
                    employee_id=emp5.id,
                    time_off_type_id=cl_type.id,
                    start_date=today + timedelta(days=7),
                    end_date=today + timedelta(days=9),
                    days=3.0,
                    reason="Family function",
                    status=TimeOffStatus.PENDING,
                )
                db.add(req)
                print("[SEED] Created pending time off request for Vikram")

        # Approved request from EMP004 (Neha)
        emp4 = emp_objects.get("EMP004")
        sl_type = leave_types_objs.get("SL")
        if emp4 and sl_type:
            existing = await db.execute(
                select(TimeOffRequest).where(
                    TimeOffRequest.employee_id == emp4.id,
                    TimeOffRequest.status == TimeOffStatus.APPROVED,
                )
            )
            if not existing.scalar_one_or_none():
                req2 = TimeOffRequest(
                    employee_id=emp4.id,
                    time_off_type_id=sl_type.id,
                    start_date=today - timedelta(days=10),
                    end_date=today - timedelta(days=9),
                    days=2.0,
                    reason="Medical appointment",
                    status=TimeOffStatus.APPROVED,
                )
                db.add(req2)
                print("[SEED] Created approved time off request for Neha")

        await db.flush()

        # ── 12. Create a historical payrun (August 2026) ──
        from app.models.payroll import Payrun, PayrunStatus, PayrunEmployee, Payslip, PayslipStatus, PayslipLine
        from app.models.contract import Contract, ContractStatus
        from decimal import Decimal

        existing_pr = await db.execute(
            select(Payrun).where(Payrun.name == "August 2026 Payroll")
        )
        if not existing_pr.scalar_one_or_none():
            # Find the salary structure
            struct_result = await db.execute(select(SalaryStructure).where(SalaryStructure.code == "STD_MONTHLY"))
            struct = struct_result.scalar_one_or_none()
            if struct:
                payrun = Payrun(
                    name="August 2026 Payroll",
                    period_start=date(2026, 8, 1),
                    period_end=date(2026, 8, 31),
                    salary_structure_id=struct.id,
                    status=PayrunStatus.PAID,
                    computed_at=dt_cls(2026, 8, 28, 10, 0, tzinfo=timezone.utc),
                    validated_at=dt_cls(2026, 8, 29, 14, 0, tzinfo=timezone.utc),
                    paid_at=dt_cls(2026, 8, 31, 9, 0, tzinfo=timezone.utc),
                )
                db.add(payrun)
                await db.flush()

                # Add all employees and create payslips
                for emp_num, emp in emp_objects.items():
                    # Add to payrun employees
                    pre = PayrunEmployee(
                        payrun_id=payrun.id,
                        employee_id=emp.id,
                        is_excluded=False,
                    )
                    db.add(pre)

                    # Find active contract
                    contract_result = await db.execute(
                        select(Contract).where(
                            Contract.employee_id == emp.id,
                            Contract.status == ContractStatus.ACTIVE,
                        )
                    )
                    contract = contract_result.scalar_one_or_none()
                    if not contract:
                        continue

                    wage = float(contract.wage)
                    basic = wage
                    hra = round(basic * 0.4, 2)
                    ca = 1600.0
                    ma = 1250.0
                    gross = basic + hra + ca + ma
                    pf = round(basic * 0.12, 2)
                    pt = 200.0
                    total_ded = pf + pt
                    net = gross - total_ded

                    payslip = Payslip(
                        payrun_id=payrun.id,
                        employee_id=emp.id,
                        contract_id=contract.id,
                        period_start=date(2026, 8, 1),
                        period_end=date(2026, 8, 31),
                        gross_salary=Decimal(str(gross)),
                        total_deductions=Decimal(str(total_ded)),
                        net_salary=Decimal(str(net)),
                        status=PayslipStatus.PAID,
                    )
                    db.add(payslip)
                    await db.flush()

                    # Create payslip lines
                    lines = [
                        PayslipLine(payslip_id=payslip.id, name="Basic Salary", code="BASIC", category="basic", sequence=10, amount=Decimal(str(basic))),
                        PayslipLine(payslip_id=payslip.id, name="House Rent Allowance", code="HRA", category="allowance", sequence=20, amount=Decimal(str(hra))),
                        PayslipLine(payslip_id=payslip.id, name="Conveyance Allowance", code="CA", category="allowance", sequence=30, amount=Decimal(str(ca))),
                        PayslipLine(payslip_id=payslip.id, name="Medical Allowance", code="MA", category="allowance", sequence=40, amount=Decimal(str(ma))),
                        PayslipLine(payslip_id=payslip.id, name="Gross Salary", code="GROSS", category="gross", sequence=100, amount=Decimal(str(gross))),
                        PayslipLine(payslip_id=payslip.id, name="Provident Fund", code="PF", category="deduction", sequence=200, amount=Decimal(str(pf))),
                        PayslipLine(payslip_id=payslip.id, name="Professional Tax", code="PT", category="deduction", sequence=210, amount=Decimal(str(pt))),
                        PayslipLine(payslip_id=payslip.id, name="Net Salary", code="NET", category="net", sequence=999, amount=Decimal(str(net))),
                    ]
                    db.add_all(lines)

                print(f"[SEED] Created historical payrun: August 2026 Payroll ({len(emp_objects)} payslips)")

        await db.commit()
        print("\n[SEED] Database seeded successfully!")
        print("\n--- Login Credentials ---")
        print("Admin:           admin@peoplepay585.com / admin123")
        print("HR Manager:      hr@peoplepay585.com / hr123")
        print("Payroll Manager: payroll@peoplepay585.com / payroll123")
        print("Payroll User:    user@peoplepay585.com / user123")
        print("Employee:        employee@peoplepay585.com / employee123")


if __name__ == "__main__":
    asyncio.run(seed())
