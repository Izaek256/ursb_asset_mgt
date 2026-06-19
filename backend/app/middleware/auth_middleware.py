from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from fastapi import Request, status

from app.db import SessionLocal
from app.services.auth import get_session, SESSION_COOKIE_NAME


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        exempt_paths: tuple[str, ...] = (
            "/login",
            "/logout",
            "/signup",
            "/health",
            "/",
            "/openapi.json",
            "/docs",
            "/redoc",
            "/api/v1/login",
            "/api/v1/signup",
            "/api/v1/logout",
        ),
    ):
        super().__init__(app)
        self.exempt_paths = exempt_paths

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method == "OPTIONS" or any(path == exempt for exempt in self.exempt_paths):
            return await call_next(request)

        session_token = request.cookies.get(SESSION_COOKIE_NAME)
        with SessionLocal() as db:
            session = get_session(db, session_token)
            if not session:
                return JSONResponse(
                    {"detail": "Authentication required"},
                    status_code=status.HTTP_401_UNAUTHORIZED,
                )
            request.state.user = session.user

        return await call_next(request)
