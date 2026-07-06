import os
from contextlib import asynccontextmanager

from sqlalchemy import text
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()


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

    default_email = os.getenv("AUTH_DEFAULT_EMAIL", "admin@ursb.local").strip().lower()
    default_password = os.getenv("AUTH_DEFAULT_PASSWORD", "Admin123!")

    with SessionLocal() as db:
        if db.query(User).count() == 0:
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
)

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173",
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
from app.middleware.auth_middleware import AuthMiddleware

app.include_router(auth_router, prefix="/api/v1")
app.include_router(dashboard_router)   # prefix: /api/v1/dashboard
app.include_router(admin_router)       # prefix: /api/v1/admin
app.include_router(assets_router)      # prefix: /api/v1/assets
app.include_router(transfers_router)   # prefix: /api/v1/transfers
app.add_middleware(AuthMiddleware)


# ── Health endpoints ─────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "URSB Asset Management API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
