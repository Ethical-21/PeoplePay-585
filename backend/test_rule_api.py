from fastapi.testclient import TestClient
from app.main import app
from app.auth.dependencies import require_min_role, get_current_user
from app.models.user import User, UserRole

client = TestClient(app)

def override_get_current_user():
    return User(id=1, email="admin@test.com", roles=[UserRole.ADMIN])

app.dependency_overrides[get_current_user] = override_get_current_user
from app.routers import salary
app.dependency_overrides[salary.require_min_role(UserRole.HR_PAYROLL_MANAGER)] = override_get_current_user

payload = {
    "structure_id": 14,
    "name": "Test Rule UI",
    "code": "TST_RUL_UI",
    "category": "basic",
    "sequence": "10",
    "calculation_type": "fixed",
    "fixed_amount": 1000
}
response = client.post("/api/v1/salary/rules", json=payload)
print(response.status_code)
print(response.text)
