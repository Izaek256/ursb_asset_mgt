import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    from app.db import engine, SessionLocal
    from app.models import Base, User, UserRole
    from app.services.auth import create_password_hash

    Base.metadata.create_all(engine)

    # Ensure all expected columns exist (handles upgrades from older schemas)
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
            "failed_login_attempts": "failed_login_attempts INTEGER NOT NULL DEFAULT 0",
            "locked_until": "locked_until DATETIME",
            "role": "role VARCHAR(50)",
            "is_active": "is_active INTEGER NOT NULL DEFAULT 1",
            "password_salt": "password_salt TEXT NOT NULL DEFAULT ''",
        }
        for column_name, definition in additional_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE users ADD COLUMN {definition}"))

    # Add missing columns to assets table
    with engine.begin() as connection:
        asset_columns = {
            row[1] for row in connection.execute(text("PRAGMA table_info(assets)")).all()
        }
        asset_new_columns = {
            "description": "description TEXT",
            "purchase_cost": "purchase_cost DECIMAL(15,2)",
            "purchase_date": "purchase_date DATE",
            "location": "location VARCHAR(255)",
            "created_by": "created_by INTEGER",
        }
        for column_name, definition in asset_new_columns.items():
            if column_name not in asset_columns:
                connection.execute(text(f"ALTER TABLE assets ADD COLUMN {definition}"))

    default_email = os.getenv("AUTH_DEFAULT_EMAIL", "admin@ursb.go.ug").strip().lower()
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

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.v1.auth import router as auth_router
from app.api.v1.assets import router as assets_router
from app.middleware.auth_middleware import AuthMiddleware

app.include_router(auth_router, prefix="/api/v1")
app.include_router(assets_router, prefix="/api/v1")
app.add_middleware(AuthMiddleware)


@app.get("/")
async def root():
    return {"message": "URSB Asset Management API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
