import os
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import AuthStatusResponse, LoginRequest, LoginResponse, SignupRequest
from app.services.auth import (
    SESSION_COOKIE_NAME,
    authenticate_user,
    create_session,
    create_user,
    delete_session,
    get_session,
    get_user_by_email,
    get_user_by_username,
    is_account_locked,
    register_failed_login_attempt,
    reset_failed_login_attempts,
    verify_password,
)

router = APIRouter()


def _cookie_settings(request: Request) -> dict:
    secure = os.getenv("DEBUG", "true").lower() != "true"
    return {
        "httponly": True,
        "secure": secure,
        "samesite": "none",
        "path": "/",
        "max_age": int(24 * 60 * 60),
    }


@router.post("/signup", response_model=LoginResponse)
def signup(
    payload: SignupRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
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
def auth_check(request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    session = get_session(db, session_token)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return {
        "authenticated": True,
        "email": session.user.email,
        "first_name": session.user.first_name,
        "last_name": session.user.last_name,
        "username": session.user.username,
        "phone_number": session.user.phone_number,
        "department": session.user.department,
        "role": session.user.role.value if session.user.role else None,
    }


@router.get("/protected")
def protected_route(request: Request) -> dict[str, str]:
    user = getattr(request.state, "user", None)
    return {
        "message": "Protected route accessed",
        "email": getattr(user, "email", "unknown"),
    }
