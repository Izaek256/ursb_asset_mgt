import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
<<<<<<< HEAD
    from app.db import engine
=======
    from app.db import engine, SessionLocal
    from app.models import Base, User
    from app.services.auth import create_password_hash

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
                )
            )
            db.commit()

>>>>>>> 29efb62ac62474fabe4e7de1e590a7ca9738837f
    yield
    engine.dispose()


app = FastAPI(
    title=os.getenv("APP_NAME", "URSB Asset Management"),
    debug=os.getenv("DEBUG", "true").lower() == "true",
    lifespan=lifespan,
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
from app.api.v1.routes_auth import router as auth_router
from app.api.v1.routes_dashboard import router as dashboard_router
from app.api.v1.routes_admin import router as admin_router
from app.api.v1.routes_assets import router as assets_router
from app.api.v1.routes_transfers import router as transfers_router

app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(admin_router)
app.include_router(assets_router)
app.include_router(transfers_router)


# ── Health endpoints ─────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "URSB Asset Management API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
