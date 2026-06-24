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
    from app.db import engine
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
from app.api.v1.auth import router as auth_router
from app.api.v1.routes_dashboard import router as dashboard_router
from app.api.v1.routes_admin import router as admin_router
from app.api.v1.routes_assets import router as assets_router
from app.api.v1.routes_transfers import router as transfers_router
from app.middleware.auth_middleware import AuthMiddleware

app.include_router(auth_router, prefix="/api/v1")
app.include_router(dashboard_router)
app.include_router(admin_router)
app.include_router(assets_router)
app.include_router(transfers_router)
app.add_middleware(AuthMiddleware)


# ── Health endpoints ─────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "URSB Asset Management API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
