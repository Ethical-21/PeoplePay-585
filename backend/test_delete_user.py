from fastapi.testclient import TestClient
from app.main import app
from app.auth.dependencies import require_min_role, get_current_user, require_roles
from app.models.user import User, UserRole
from app.database import AsyncSessionLocal
from sqlalchemy import select
import asyncio

client = TestClient(app)

def override_get_current_user():
    return User(id=1, email="admin@test.com", roles=[UserRole.ADMIN])

app.dependency_overrides[get_current_user] = override_get_current_user
app.dependency_overrides[require_roles(UserRole.ADMIN)] = override_get_current_user

# create a test user first using DB
async def setup_test_user():
    async with AsyncSessionLocal() as db:
        user = User(
            email="test_delete_1@example.com",
            full_name="Test Delete",
            hashed_password="hashed_pw",
            roles=[UserRole.EMPLOYEE],
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user.id

user_id = asyncio.run(setup_test_user())
print(f"Created user with ID: {user_id}")

response = client.delete(f"/api/v1/users/{user_id}")
print("Status code:", response.status_code)
if response.status_code != 204:
    print("Error:", response.text)
