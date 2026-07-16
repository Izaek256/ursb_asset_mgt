import os
import re

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.session import Session as UserSession
from app.models.user import User, UserRole
from app.schemas import AuthStatusResponse, LoginRequest, LoginResponse, MessageResponse, PasswordChangeRequest, SignupRequest
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


def require_role(*allowed_roles: UserRole):
    """
    Return a FastAPI dependency that checks if the current user has one of the allowed roles.
    
    This function can be used both as a route-level dependency (blocking access entirely) 
    and as a parameter dependency (providing the current user to the handler).
    
    Args:
        *allowed_roles: One or more UserRole enum values that are permitted to access the route.
    
    Returns:
        A FastAPI dependency function that validates the user's role and returns the authenticated user.
    
    Raises:
        HTTPException 401: If no valid session exists.
        HTTPException 403: If the user's role is not in the allowed list.
    
    Example:
        # As a route-level dependency (blocks access entirely):
        @router.post("/assets")
        def create_asset(
            body: AssetCreate,
            db: Session = Depends(get_db),
            current_user=Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR))
        ):
            # Handler code here - current_user is the authenticated User object
            ...
        
        # As a parameter dependency (provides current_user to handler):
        @router.post("/assets")
        def create_asset(
            body: AssetCreate,
            db: Session = Depends(get_db),
            current_user: User = Depends(require_role(UserRole.ASSET_MANAGER))
        ):
            # Handler code here - current_user is the authenticated User object
            ...
    """
    def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role.value}' is not authorized for this action",
            )
        return current_user

    return _checker


def require_not_self_approval(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """
    Guard that prevents a user from approving their own asset request.
    
    This enforces the business rule that an Asset Manager cannot approve their own
    requests to prevent conflicts of interest. This applies regardless of the user's role.
    
    Extracts request_id from the path parameters of the current request.
    
    Raises:
        HTTPException 403: If the logged-in user is the same person who submitted the request.
    
    Example:
        @router.put("/{request_id}/approve")
        def approve_request(
            request_id: int,
            body: AssetRequestApprove,
            db: Session = Depends(get_db),
            current_user: User = Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR)),
            _guard: None = Depends(require_not_self_approval)
        ):
            # Handler code here - self-approval is guaranteed to be blocked
            ...
    """
    from app.models.asset_request import AssetRequest
    
    request_id = request.path_params.get("request_id")
    if request_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="request_id path parameter is required"
        )
    
    request_obj = db.query(AssetRequest).filter(AssetRequest.request_id == int(request_id)).first()
    if not request_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found"
        )
    
    if request_obj.requested_by == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot approve your own request. Conflict of interest restriction."
        )


# Backward compatibility alias for existing code using require_roles
require_roles = require_role


@router.post("/signup", response_model=MessageResponse)
def signup(
    payload: SignupRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
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
    return MessageResponse(message="Account created successfully. Please sign in.")


@router.post("/login", response_model=MessageResponse)
def login(
    payload: LoginRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
) -> MessageResponse:
    print(f"DEBUG: Login attempt for email: {payload.email}")
    print(f"DEBUG: Received password: '{payload.password}'")
    user = get_user_by_email(db, payload.email)
    print(f"DEBUG: User found: {user is not None}")
    if user:
        print(f"DEBUG: User ID: {user.user_id}, Email: {user.email}, Is active: {user.is_active}")
        print(f"DEBUG: Password salt: {user.password_salt[:20]}... Hash: {user.password_hash[:20]}...")
    if user and is_account_locked(user):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=(
                f"Account locked until {user.locked_until.strftime('%Y-%m-%d %H:%M UTC')} "
                "after too many failed login attempts."
            ),
        )

    if not user or not verify_password(payload.password, user.password_salt, user.password_hash):
        print(f"DEBUG: Password verification failed. User exists: {user is not None}")
        if user:
            register_failed_login_attempt(db, user)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    print(f"DEBUG: Password verification successful")
    reset_failed_login_attempts(db, user)
    session = create_session(db, user)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session.session_token,
        **_cookie_settings(request),
    )
    return MessageResponse(message="Login successful")


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> MessageResponse:
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if session_token:
        delete_session(db, session_token)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return MessageResponse(message="Logout successful")


@router.get("/auth/check", response_model=AuthStatusResponse)
def auth_check(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> AuthStatusResponse:
    return AuthStatusResponse(
        authenticated=True,
    )


@router.get("/protected", response_model=MessageResponse)
def protected_route(request: Request) -> MessageResponse:
    user = getattr(request.state, "user", None)
    return MessageResponse(message=f"Protected route accessed: {getattr(user, 'email', 'unknown')}")


@router.put("/password", response_model=MessageResponse)
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
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
    # Stamp when user last changed their own password (used by credentials page)
    from datetime import datetime as _dt
    current_user.password_changed_at = _dt.utcnow()

    # Invalidate all sessions for this user
    from app.models.session import Session
    db.query(Session).filter(Session.user_id == current_user.user_id).delete()

    # Clear any stored temporary passwords so they no longer show on credentials page
    from app.models.temporary_password import TemporaryPassword
    db.query(TemporaryPassword).filter(TemporaryPassword.user_id == current_user.user_id).delete()

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

    return MessageResponse(message="Password changed successfully. Please log in again.")


@router.post("/change-password", response_model=MessageResponse)
def change_password_no_session_invalidate(
    payload: PasswordChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    """Change the current user's password without invalidating sessions. Requires authentication (all roles)."""

    # Validate current password
    if not verify_password(payload.current_password, current_user.password_salt, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Validate new password differs from current
    if payload.new_password == payload.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password"
        )

    # Validate password complexity: min 8 chars
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password does not meet requirements: minimum 8 characters"
        )

    # Hash new password
    salt, password_hash = create_password_hash(payload.new_password)
    current_user.password_hash = password_hash
    current_user.password_salt = salt
    # Stamp when user last changed their own password (used by credentials page)
    from datetime import datetime as _dt
    current_user.password_changed_at = _dt.utcnow()

    # Clear any stored temporary passwords so they no longer show on credentials page
    from app.models.temporary_password import TemporaryPassword
    db.query(TemporaryPassword).filter(TemporaryPassword.user_id == current_user.user_id).delete()

    # Write audit log for password change
    from app.models.audit_log import AuditLog
    from datetime import datetime
    audit = AuditLog(
        user_id=current_user.user_id,
        action="PASSWORD_CHANGED",
        table_affected="users",
        record_id=current_user.user_id,
        details=f"Password changed for user {current_user.email}",
        timestamp=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()

    return MessageResponse(message="Password changed successfully")

