import asyncio
from sqlalchemy import select
from app.database import engine
from app.models.user import User

async def test_db():
    try:
        async with engine.begin() as conn:
            print("Successfully connected to the database engine.")
            result = await conn.execute(select(User).limit(5))
            users = result.all()
            print(f"Successfully retrieved {len(users)} users. Type of first: {type(users[0])}")
            for row in users:
                print(f"Row: {row}")
    except Exception as e:
        print(f"Error connecting or retrieving data: {e}")

if __name__ == "__main__":
    asyncio.run(test_db())
