import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # Import engine so it is initialized when the app starts
    from app.db import engine
    yield
    # Dispose of the connection pool on shutdown
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


@app.get("/")
async def root():
    return {"message": "URSB Asset Management API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
