import os
import re

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.session import Session as UserSession
from app.models.user import User
from app.schemas import AuthStatusResponse, LoginRequest, LoginResponse, SignupRequest
from app.services.auth import (
    SESSION_COOKIE_NAME,
    create_password_hash,
    create_session,
    create_user,
    delete_session,
    get_session,
    get_user_by_email,
    get_user_by_username,
    is_account_locked,
    register_failed_login_attempt,
    reset_failed_login_attempts,
    validate_ursb_email,
    verify_password,
)

router = APIRouter()


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_new_password: str


def _cookie_settings(request: Request) -> dict:
    secure = os.getenv("DEBUG", "true").lower() != "true"
    return {
        "httponly": True,
        "secure": secure,
        "samesite": "lax",
        "path": "/",
        "max_age": int(24 * 60 * 60),
    }


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate the current user from request state (set by AuthMiddleware)."""
    user = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    db_user = db.query(User).filter(User.user_id == user.user_id).first()
    if db_user is None or not db_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return db_user


def require_roles(*allowed_roles: str):
    """Return a dependency that checks if the current user has one of the allowed roles."""
    def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role.value}' is not authorized for this action",
            )
        return current_user

    return _checker


@router.post("/signup", response_model=LoginResponse)
def signup(
    payload: SignupRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    print(f"[DEBUG SIGNUP] payload: {payload}")
    validate_ursb_email(payload.email)

    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    if get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered",
        )

    if payload.username and get_user_by_username(db, payload.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken",
        )

    create_user(
        db,
        email=payload.email,
        password=payload.password,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone_number=payload.phone_number,
        department=payload.department,
        username=payload.username,
    )
    return {"message": "Account created successfully. Please sign in."}


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    print(f"[DEBUG LOGIN] email: {payload.email}, password: {payload.password}")
    user = get_user_by_email(db, payload.email)
    if user and is_account_locked(user):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=(
                f"Account locked until {user.locked_until.strftime('%Y-%m-%d %H:%M UTC')} "
                "after too many failed login attempts."
            ),
        )

    if not user or not verify_password(payload.password, user.password_salt, user.password_hash):
        if user:
            register_failed_login_attempt(db, user)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    reset_failed_login_attempts(db, user)
    session = create_session(db, user)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session.session_token,
        **_cookie_settings(request),
    )
    return {"message": "Login successful"}


@router.post("/logout", response_model=LoginResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if session_token:
        delete_session(db, session_token)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"message": "Logout successful"}


@router.get("/auth/check", response_model=AuthStatusResponse)
def auth_check(request: Request) -> dict[str, object]:
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return {
        "authenticated": True,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "phone_number": user.phone_number,
        "department": user.department,
        "user_id": str(user.user_id) if user.user_id is not None else None,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "full_name": user.full_name or f"{user.first_name or ''} {user.last_name or ''}".strip(),
    }


@router.get("/protected")
def protected_route(request: Request) -> dict[str, str]:
    user = getattr(request.state, "user", None)
    return {
        "message": "Protected route accessed",
        "email": getattr(user, "email", "unknown"),
    }


@router.put("/password")
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Change the current user's password. Requires authentication (all roles)."""

    # Validate current password
    if not verify_password(payload.current_password, current_user.password_salt, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Validate new passwords match
    if payload.new_password != payload.confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match"
        )

    # Validate password complexity: min 8 chars, at least one uppercase, one digit, one special character
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password does not meet requirements: minimum 8 characters"
        )
    if not re.search(r'[A-Z]', payload.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password does not meet requirements: at least one uppercase letter"
        )
    if not re.search(r'\d', payload.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password does not meet requirements: at least one digit"
        )
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', payload.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password does not meet requirements: at least one special character"
        )

    # Hash new password
    salt, password_hash = create_password_hash(payload.new_password)
    current_user.password_hash = password_hash
    current_user.password_salt = salt

    # Invalidate all sessions for this user
    from app.models.session import Session
    db.query(Session).filter(Session.user_id == current_user.user_id).delete()

    # Write audit log for password change
    from app.models.audit_log import AuditLog
    from datetime import datetime
    audit = AuditLog(
        user_id=current_user.user_id,
        action="CHANGE_PASSWORD",
        table_affected="users",
        record_id=current_user.user_id,
        details=f"Password changed for user {current_user.email}",
        timestamp=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()

    # Clear session cookie
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")

    return {"message": "Password changed successfully. Please log in again."}
