import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from sqlalchemy import text
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

load_dotenv()


def _utc_iso(obj):
    """Recursively walk a JSON-serialisable object and ensure all naive datetime
    strings are returned with a 'Z' suffix so browsers parse them as UTC."""
    if isinstance(obj, datetime):
        if obj.tzinfo is None:
            return obj.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        return obj.isoformat().replace("+00:00", "Z")
    if isinstance(obj, str):
        # Stamp bare ISO datetime strings (no tz suffix) that came from the DB
        # Pattern: YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM:SS (with optional micros)
        import re
        if re.match(r'^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}', obj) and not obj.endswith('Z') and '+' not in obj and obj.count('-') >= 2:
            # Replace space separator with T and append Z
            return obj.replace(' ', 'T') + 'Z'
        return obj
    if isinstance(obj, dict):
        return {k: _utc_iso(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_utc_iso(i) for i in obj]
    return obj


class UTCJSONResponse(JSONResponse):
    """JSONResponse subclass that stamps all naive datetimes with Z (UTC)."""
    def render(self, content) -> bytes:
        return super().render(_utc_iso(jsonable_encoder(content)))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    from app.db import engine, SessionLocal, Base
    from app.models import User
    from app.models.user import UserRole
    from app.services.auth import create_password_hash

    # Create all tables (users, sessions, assets, etc.) if they don't exist
    Base.metadata.create_all(engine)

    # Ensure any new columns are added to existing tables before querying
    with engine.begin() as connection:
        # Add columns to users table
        existing_columns = {
            row[1] for row in connection.execute(text("PRAGMA table_info(users)")).all()
        }
        additional_columns = {
            "first_name": "first_name TEXT",
            "last_name": "last_name TEXT",
            "phone_number": "phone_number TEXT",
            "department": "department TEXT",
            "username": "username TEXT UNIQUE",
            "role": "role VARCHAR(50)",
            "password_hash": "password_hash VARCHAR(128) NOT NULL DEFAULT ''",
            "password_salt": "password_salt VARCHAR(128) NOT NULL DEFAULT ''",
            "is_active": "is_active BOOLEAN NOT NULL DEFAULT 1",
            "failed_login_attempts": "failed_login_attempts INTEGER NOT NULL DEFAULT 0",
            "locked_until": "locked_until DATETIME",
            "created_at": "created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
        }
        for column_name, definition in additional_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE users ADD COLUMN {definition}"))

        # Add columns to assets table
        existing_asset_columns = {
            row[1] for row in connection.execute(text("PRAGMA table_info(assets)")).all()
        }
        asset_additional_columns = {
            "is_active": "is_active BOOLEAN NOT NULL DEFAULT 1",
        }
        for column_name, definition in asset_additional_columns.items():
            if column_name not in existing_asset_columns:
                connection.execute(text(f"ALTER TABLE assets ADD COLUMN {definition}"))

        # Add columns to assignments table for return workflow
        existing_assignment_columns = {
            row[1] for row in connection.execute(text("PRAGMA table_info(assignments)")).all()
        }
        assignment_additional_columns = {
            "return_requested_by": "return_requested_by VARCHAR(36)",
            "return_requested_at": "return_requested_at DATETIME",
            "return_approved_by": "return_approved_by VARCHAR(36)",
            "return_approved_at": "return_approved_at DATETIME",
            "return_rejection_reason": "return_rejection_reason TEXT",
        }
        for column_name, definition in assignment_additional_columns.items():
            if column_name not in existing_assignment_columns:
                connection.execute(text(f"ALTER TABLE assignments ADD COLUMN {definition}"))

    default_email = os.getenv("AUTH_DEFAULT_EMAIL", "admin@ursb.go.ug").strip().lower()
    default_password = os.getenv("AUTH_DEFAULT_PASSWORD", "Admin@1234")

    with SessionLocal() as db:
        if not db.query(User).filter(User.email == default_email).first():
            salt, password_hash = create_password_hash(default_password)
            db.add(
                User(
                    email=default_email,
                    password_hash=password_hash,
                    password_salt=salt,
                    role=UserRole.SYSTEM_ADMINISTRATOR,
                    department="IT",
                )
            )
            db.commit()
    yield
    engine.dispose()


app = FastAPI(
    title=os.getenv("APP_NAME", "URSB Asset Management"),
    debug=os.getenv("DEBUG", "true").lower() == "true",
    lifespan=lifespan,
    default_response_class=UTCJSONResponse,
)

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register API routers ─────────────────────────────────────────────────────────
from app.api.v1.auth import router as auth_router
from app.api.v1.routes_dashboard import router as dashboard_router
from app.api.v1.routes_admin import router as admin_router
from app.api.v1.routes_assets import router as assets_router
from app.api.v1.routes_transfers import router as transfers_router
from app.api.v1.routes_requests import router as requests_router
from app.api.v1.routes_assignments import router as assignments_router
from app.api.v1.routes_storage import router as storage_router
from app.api.v1.routes_maintenance import router as maintenance_router
from app.api.v1.routes_settings import router as settings_router
from app.api.v1.routes_disposals import router as disposals_router
from app.api.v1.routes_notifications import router as notifications_router
from app.api.v1.routes_inventory import router as inventory_router
from app.api.v1.routes_user_import import router as user_import_router
from app.api.v1.routes_credentials import router as credentials_router
from app.api.v1.routes_import import router as import_router
from app.middleware.auth_middleware import AuthMiddleware

app.include_router(auth_router, prefix="/api/v1")
app.include_router(dashboard_router)   # prefix: /api/v1/dashboard
app.include_router(admin_router)       # prefix: /api/v1/admin
app.include_router(import_router)
app.include_router(assets_router)      # prefix: /api/v1/assets
app.include_router(transfers_router)   # prefix: /api/v1/transfers
app.include_router(requests_router)    # prefix: /api/v1/requests
app.include_router(assignments_router)
app.include_router(storage_router)
app.include_router(maintenance_router)
app.include_router(settings_router)    # prefix: /api/v1/settings
app.include_router(disposals_router)   # prefix: /api/v1/disposals
app.include_router(notifications_router)
app.include_router(inventory_router)   # prefix: /api/v1/inventory
app.include_router(user_import_router)  # prefix: /api/v1/users
app.include_router(credentials_router)  # prefix: /api/v1/credentials
app.add_middleware(AuthMiddleware)


# ── Health endpoints ─────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "URSB Asset Management API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
