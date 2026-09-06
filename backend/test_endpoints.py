import asyncio
from httpx import AsyncClient
from app.database import engine
from sqlalchemy import text

async def test_endpoints():
    # 1. Get an active user
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT email, hashed_password FROM users LIMIT 1"))
        user = res.fetchone()
        
    print(f"Testing with user: {user.email}")
    
    # 2. Login
    async with AsyncClient(base_url="http://localhost:8000") as client:
        # I don't know the plain password, wait. I can't login easily.
        # Let's bypass login and just print what the backend is throwing.
        pass

if __name__ == "__main__":
    asyncio.run(test_endpoints())
