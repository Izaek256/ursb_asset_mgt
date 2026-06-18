import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(
    title=os.getenv("APP_NAME", "URSB Asset Management"),
    debug=os.getenv("DEBUG", "true").lower() == "true",
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
