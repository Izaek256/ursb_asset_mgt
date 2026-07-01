from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from fastapi import Request, status

from app.db import SessionLocal
from app.services.auth import get_session, SESSION_COOKIE_NAME

# Public routes are endpoints that do not require authentication.
# These include health checks, login/signup pages, and API documentation.
# To add a new public route, add it to this tuple.
PUBLIC_ROUTES = (
    "/login",  # Login page
    "/logout",  # Logout page
    "/signup",  # Signup page
    "/health",  # Health check endpoint
    "/",  # Root endpoint
    "/openapi.json",  # OpenAPI schema
    "/docs",  # Swagger UI documentation
    "/redoc",  # ReDoc documentation
    "/api/v1/login",  # Login API endpoint
    "/api/v1/signup",  # Signup API endpoint
    "/api/v1/logout",  # Logout API endpoint
    "/api/v1/protected",  # Protected route test endpoint
)


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        exempt_paths: tuple[str, ...] = PUBLIC_ROUTES,
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
            # Check if user is active - prevent deactivated users from continuing to use the system
            if not session.user.is_active:
                return JSONResponse(
                    {"detail": "Account is deactivated. Contact your administrator."},
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            request.state.user = session.user

        return await call_next(request)
