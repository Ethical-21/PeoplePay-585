from fastapi.testclient import TestClient
from app.main import app
from app.auth.dependencies import require_min_role, get_current_user
from app.models.user import User, UserRole

client = TestClient(app)

def override_require_min_role(role):
    def _override():
        return User(id=1, email="admin@test.com", roles=[UserRole.ADMIN])
    return _override

def override_get_current_user():
    return User(id=1, email="admin@test.com", roles=[UserRole.ADMIN])

app.dependency_overrides[require_min_role] = override_require_min_role
app.dependency_overrides[get_current_user] = override_get_current_user
# Specifically override the one used in the route
for k in list(app.dependency_overrides.keys()):
    pass

# Mock require_min_role for HR_PAYROLL_MANAGER
from app.routers import salary
app.dependency_overrides[salary.require_min_role(UserRole.HR_PAYROLL_MANAGER)] = override_get_current_user

payload = {
    "name": "Test Structure 5",
    "code": "TST_STR5",
    "description": "Test Description"
}

response = client.post("/api/v1/salary/structures", json=payload)
print(response.status_code)
print(response.text)
