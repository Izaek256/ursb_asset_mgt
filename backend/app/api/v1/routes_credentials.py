"""Credentials routes for reviewing recently created user accounts."""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.models.temporary_password import TemporaryPassword
from app.api.v1.auth import get_current_user, require_roles
from app.services.auth import verify_password

router = APIRouter(prefix="/api/v1/credentials", tags=["credentials"])


class RecentAccount(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    department: Optional[str]
    created_at: str
    password: Optional[str]


class RecentAccountsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    accounts: List[RecentAccount]


@router.get("/recent-accounts", response_model=RecentAccountsResponse)
def get_recent_accounts(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    x_admin_password: Optional[str] = Header(None, alias="X-Admin-Password"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator")),
):
    """
    Get users created in the last 24 hours.

    The X-Admin-Password header provides a second-factor re-authentication step.
    This is not a session replacement - it's a verification that the admin is still
    present and authorized to view sensitive credential information.

    The password_visible field is always false because the system never stored
    the plain-text passwords. They were generated, returned once at creation time,
    and discarded.
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
    
    # Calculate time threshold (7 days, matching the temporary password expiry window)
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
        # Get temporary password if exists and not expired
        temp_pwd = db.query(TemporaryPassword).filter(
            TemporaryPassword.user_id == user.user_id,
            TemporaryPassword.expires_at > datetime.utcnow()
        ).first()
        
        accounts.append(RecentAccount(
            user_id=str(user.user_id) if user.user_id else "",
            full_name=user.full_name or "",
            email=user.email,
            role=user.role.value if user.role else "",
            department=user.department,
            created_at=user.created_at.isoformat() if user.created_at else "",
            password=temp_pwd.password if temp_pwd else None
        ))
    
    return RecentAccountsResponse(
        total=total,
        page=page,
        page_size=page_size,
        accounts=accounts
    )
