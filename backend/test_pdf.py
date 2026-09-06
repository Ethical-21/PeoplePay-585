import asyncio
import traceback
from app.database import AsyncSessionLocal
from app.routers.payroll import download_payslip_pdf
from app.models.user import User

async def test_pdf():
    async with AsyncSessionLocal() as db:
        # Mock user
        mock_user = User(id=1, role="hr_manager")
        try:
            res = await download_payslip_pdf(payslip_id=1, db=db, current_user=mock_user)
            print("Success")
        except Exception as e:
            print("ERROR!")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_pdf())
