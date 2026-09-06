"""
PeoplePay585 — FastAPI Application Entry Point

Mounts all routers, configures CORS, initializes database on startup.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db, dispose_db

# Import all models so they're registered with Base.metadata
import app.models  # noqa: F401

# Import routers
from app.auth.router import router as auth_router
from app.routers.employees import router as employees_router
from app.routers.departments import router as departments_router
from app.routers.contracts import router as contracts_router
from app.routers.schedules import router as schedules_router
from app.routers.attendance import router as attendance_router
from app.routers.timeoff import router as timeoff_router
from app.routers.salary import router as salary_router
from app.routers.payroll import router as payroll_router
from app.routers.dashboard import router as dashboard_router
from app.routers.users import router as users_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle — create tables on startup, clean up on shutdown."""
    print(f"[START] Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"[DB] Database: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")
    await init_db()
    print("[OK] Database tables created/verified.")
    yield
    await dispose_db()
    print("[STOP] Shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    description="HR & Payroll Management Platform — Odoo Hackathon 2026",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",    # Vite default
        "http://localhost:5174",    # Vite fallback
        "http://localhost:3000",    # Alternative
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API routers under /api/v1
API_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)
app.include_router(employees_router, prefix=API_PREFIX)
app.include_router(departments_router, prefix=API_PREFIX)
app.include_router(contracts_router, prefix=API_PREFIX)
app.include_router(schedules_router, prefix=API_PREFIX)
app.include_router(attendance_router, prefix=API_PREFIX)
app.include_router(timeoff_router, prefix=API_PREFIX)
app.include_router(salary_router, prefix=API_PREFIX)
app.include_router(payroll_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)


@app.get("/", tags=["Health"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/api/docs",
    }


@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    """Health check endpoint — verifies database connectivity."""
    from sqlalchemy import text
    from app.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT 1"))
            result.scalar()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": f"error: {str(e)}"}
