"""Credentials routes for reviewing recently created user accounts."""

import secrets
import string
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, status, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.models.user import UserRole
from app.models.temporary_password import TemporaryPassword
from app.api.v1.auth import get_current_user, require_role
from app.services.auth import create_password_hash, verify_password

router = APIRouter(prefix="/api/v1/credentials", tags=["credentials"])


class RecentAccount(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    department: Optional[str]
    created_at: str
    password_revoked: bool


class RecentAccountsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    accounts: List[RecentAccount]


class RegeneratePasswordResponse(BaseModel):
    generated_password: str
    expires_at: str


def _generate_temp_password(length: int = 12) -> str:
    """Generate a secure random temporary password with mixed characters."""
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        # Ensure at least one of each required character class
        if (
            any(c.isupper() for c in pwd)
            and any(c.islower() for c in pwd)
            and any(c.isdigit() for c in pwd)
            and any(c in "!@#$%&*" for c in pwd)
        ):
            return pwd


@router.get("/recent-accounts", response_model=RecentAccountsResponse)
def get_recent_accounts(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    x_admin_password: Optional[str] = Header(None, alias="X-Admin-Password"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPER_SYSTEM_ADMINISTRATOR, UserRole.SYSTEM_ADMINISTRATOR, UserRole.ASSET_MANAGER)),
):
    """
    Get users created in the last 7 days.

    The X-Admin-Password header provides a second-factor re-authentication step.
    The password_revoked field signals that the user has already changed their
    generated password (making it inactive), so the admin UI can show it struck
    through without a copy button.
    """
    # Verify admin password for re-authentication
    if not x_admin_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin password required in X-Admin-Password header"
        )
    
    if not verify_password(x_admin_password, current_user.password_salt, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Incorrect admin password"
        )
    
    # Validate pagination parameters
    if page < 1:
        raise HTTPException(status_code=400, detail="Page must be 1 or greater")
    if page_size < 1 or page_size > 50:
        raise HTTPException(status_code=400, detail="page_size must be between 1 and 50")
    
    # Calculate time threshold (7 days)
    time_threshold = datetime.utcnow() - timedelta(days=7)
    
    # Build base query for users created in last 7 days
    query = db.query(User).filter(User.created_at >= time_threshold)
    
    # Apply search filter if provided
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.full_name.ilike(search_term)) | (User.email.ilike(search_term))
        )
    
    # Get total count
    total = query.count()
    
    # Get paginated results
    users = (
        query
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    
    # Build response
    accounts = []
    for user in users:
        # Get temporary password metadata if exists and not expired
        temp_pwd = db.query(TemporaryPassword).filter(
            TemporaryPassword.user_id == user.user_id,
            TemporaryPassword.expires_at > datetime.utcnow()
        ).order_by(TemporaryPassword.created_at.desc()).first()

        # Determine if password has been revoked (user changed it themselves)
        # password_revoked = True means the user already set their own password,
        # so the temp password is no longer valid.
        password_revoked: bool
        if temp_pwd is None:
            # No active temp password — either expired or user changed it
            password_revoked = True
        elif user.password_changed_at is not None and user.password_changed_at >= temp_pwd.created_at:
            # User changed password after this temp was issued
            password_revoked = True
        else:
            password_revoked = False

        accounts.append(RecentAccount(
            user_id=str(user.user_id) if user.user_id else "",
            full_name=user.full_name or "",
            email=user.email,
            role=user.role.value if user.role else "",
            department=user.department,
            created_at=user.created_at.isoformat() if user.created_at else "",
            password_revoked=password_revoked,
        ))
    
    return RecentAccountsResponse(
        total=total,
        page=page,
        page_size=page_size,
        accounts=accounts
    )


@router.post("/{user_id}/regenerate-password", response_model=RegeneratePasswordResponse)
def regenerate_password(
    user_id: int,
    response: Response,
    x_admin_password: Optional[str] = Header(None, alias="X-Admin-Password"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPER_SYSTEM_ADMINISTRATOR, UserRole.SYSTEM_ADMINISTRATOR, UserRole.ASSET_MANAGER)),
):
    """
    Regenerate a temporary password for a user.

    The admin must re-authenticate with X-Admin-Password.
    A new random 12-character password (valid 7 days) is generated, hashed and
    set on the user account. The plaintext is returned once in the response and
    never stored. password_changed_at is cleared so that the credentials page
    immediately shows the new password as active.
    """
    # Verify admin password for re-authentication
    if not x_admin_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin password required in X-Admin-Password header"
        )

    if not verify_password(x_admin_password, current_user.password_salt, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Incorrect admin password"
        )

    # Fetch target user
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Generate a new random temporary password
    new_password = _generate_temp_password()

    # Hash and set on the user account
    salt, password_hash = create_password_hash(new_password)
    target_user.password_hash = password_hash
    target_user.password_salt = salt

    # Clear password_changed_at so the credentials page shows this as active
    target_user.password_changed_at = None

    # Remove any old temporary password entries for this user
    db.query(TemporaryPassword).filter(TemporaryPassword.user_id == user_id).delete(synchronize_session=False)

    # Store metadata only (no plaintext password)
    expires_at = datetime.utcnow() + timedelta(days=7)
    temp_pwd = TemporaryPassword(
        user_id=user_id,
        created_at=datetime.utcnow(),
        expires_at=expires_at,
    )
    db.add(temp_pwd)

    # Audit log
    from app.models.audit_log import AuditLog
    audit = AuditLog(
        user_id=current_user.user_id,
        action="REGENERATE_PASSWORD",
        table_affected="users",
        record_id=user_id,
        details=f"Admin {current_user.email} regenerated temporary password for user {target_user.email}",
        timestamp=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()

    # Add Cache-Control header to prevent caching of password
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"

    return RegeneratePasswordResponse(
        generated_password=new_password,
        expires_at=expires_at.isoformat(),
    )
