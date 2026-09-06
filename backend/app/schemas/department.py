"""
Department schemas.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=10)
    description: str | None = None
    manager_id: int | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    code: str | None = Field(None, min_length=1, max_length=10)
    description: str | None = None
    manager_id: int | None = None


class DepartmentResponse(BaseModel):
    id: int
    name: str
    code: str
    description: str | None
    manager_id: int | None = None
    manager_name: str | None = None
    created_at: datetime
    employee_count: int = 0

    model_config = {"from_attributes": True}

