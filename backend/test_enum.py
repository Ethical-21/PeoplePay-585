import enum

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"

ROLE_HIERARCHY = {
    UserRole.ADMIN: 5,
    UserRole.EMPLOYEE: 1,
}

r = "admin"
print("In allowed_roles?:", r in [UserRole.ADMIN])
print("Dict get:", ROLE_HIERARCHY.get(r, 0))
