"""Admin routes: user management and audit logs."""

import secrets
import string
from datetime import datetime, date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.models.session import Session
from app.models.temporary_password import TemporaryPassword
from app.api.v1.auth import get_current_user, require_roles
from app.services.auth import create_password_hash, validate_ursb_email

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def generate_secure_password() -> str:
    """
    Generate a cryptographically random secure password.

    Requirements:
    - Minimum 12 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one digit (0-9)
    - At least one special character from !@#$%^&*

    Uses Python's secrets module for cryptographic randomness.
    The generated value is returned once and never stored.
    """
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    special = "!@#$%^&*"

    # Ensure at least one character from each required set
    password = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(special),
    ]

    # Fill the rest with random characters from all sets
    all_chars = uppercase + lowercase + digits + special
    for _ in range(8):  # 8 more characters to reach minimum 12
        password.append(secrets.choice(all_chars))

    # Shuffle to avoid predictable pattern
    secrets.SystemRandom().shuffle(password)

    return ''.join(password)


# ── Helpers ───────────────────────────────────────────────────────────────────────
def _full_name(u: User) -> str:
    """Safely build full name whether model uses full_name or first/last."""
    if hasattr(u, "full_name") and u.full_name:
        return u.full_name
    parts = []
    if hasattr(u, "first_name") and u.first_name:
        parts.append(u.first_name)
    if hasattr(u, "last_name") and u.last_name:
        parts.append(u.last_name)
    return " ".join(parts) if parts else u.email


def _log(db: Session, *, actor: User, action: str, table: str,
         record_id: str, details: str):
    """Write a single audit log entry."""
    db.add(AuditLog(
        user_id=actor.user_id,
        action=action,
        table_affected=table,
        record_id=record_id,
        details=details,
        timestamp=datetime.utcnow(),
    ))


# ── Schemas ───────────────────────────────────────────────────────────────────────
class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    isActive: bool
    department: str
    created_at: str

    class Config:
        from_attributes = True


class UserCreateRequest(BaseModel):
    email: str
    first_name: str
    last_name: str
    role: str
    department: str
    password: str
    username: Optional[str] = None
    phone_number: Optional[str] = None


class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department: Optional[str] = None
    phone_number: Optional[str] = None
    username: Optional[str] = None


class RoleUpdateRequest(BaseModel):
    role: str


class CreateUserRequest(BaseModel):
    full_name: str
    email: str
    role: str
    department: str


class UserCreateAutoRequest(BaseModel):
    """Request schema for user creation with auto-generated password."""
    full_name: str
    email: str
    role: str
    department: str


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None


class AuditLogOut(BaseModel):
    id: str
    timestamp: str
    performedBy: str
    targetUser: str
    action: str
    ipAddress: Optional[str] = None

    class Config:
        from_attributes = True

class AuditLogResponse(BaseModel):
    log_id: str
    timestamp:str
    user_id: Optional[int] = None
    user_name: str
    action: str
    table_affected: str
    record_id: str
    details:str

    class Config:
        from_attributes = True   

class AuditLogListResponse(BaseModel):
    logs: List[AuditLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    


class RoleChangeResponse(BaseModel):
    message: str
    user_id: str
    new_role: str


class StatusChangeResponse(BaseModel):
    message: str
    user_id: str
    is_active: bool


# ── Serialisers ───────────────────────────────────────────────────────────────────
def _user_to_out(u: User) -> UserOut:
    return UserOut(
        id=str(u.user_id) if u.user_id is not None else "",
        name=_full_name(u),
        email=u.email,
        role=u.role.value if u.role else "",
        isActive=u.is_active,
        department=u.department or "",
        created_at=u.created_at.isoformat() if u.created_at else "",
    )


def _log_to_out(log: AuditLog, db: Session) -> AuditLogOut:
    actor = db.query(User).filter(User.user_id == log.user_id).first()
    target_user = ""
    if log.record_id:
        target = db.query(User).filter(User.user_id == log.record_id).first()
        target_user = _full_name(target) if target else log.record_id

    return AuditLogOut(
        id=str(log.log_id),
        timestamp=log.timestamp.isoformat() if log.timestamp else "",
        performedBy=_full_name(actor) if actor else "Unknown",
        targetUser=target_user,
        action=f"{log.action} — {log.details[:120]}",
        ipAddress=None,
    )


# ── Endpoints ────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("System Administrator", "Asset Manager")
    ),
):
    """List all users. Accessible by System Administrator and Asset Manager."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_user_to_out(u) for u in users]


@router.post("/users")
def create_user(
    body: UserCreateAutoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator")),
):
    """Create a new user account with auto-generated password. Admin only."""
    # Validate email domain - only @ursb.go.ug addresses are permitted
    validate_ursb_email(body.email)

    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists.")

    try:
        role = UserRole(body.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")

    # Auto-generate secure password
    generated_password = generate_secure_password()
    print(f"DEBUG: Generated password for {body.email}: {generated_password}")
    salt, p_hash = create_password_hash(generated_password)
    print(f"DEBUG: Salt: {salt[:20]}... Hash: {p_hash[:20]}...")

    new_user = User(
        full_name=body.full_name,
        email=body.email.strip().lower(),
        password_hash=p_hash,
        password_salt=salt,
        role=role,
        department=body.department,
        is_active=True,
    )
    db.add(new_user)
    db.flush()  # Get the auto-generated user_id before commit
    print(f"DEBUG: User created with ID: {new_user.user_id}, email: {new_user.email}")

    audit = AuditLog(
        user_id=current_user.user_id,
        action="USER_CREATED",
        table_affected="users",
        record_id=new_user.user_id,
        details=f"User {new_user.email} created by admin {current_user.email}",
        timestamp=datetime.utcnow(),
    )
    db.add(audit)

    # Store temporary password for admin viewing (expires in 7 days)
    temp_password = TemporaryPassword(
        user_id=new_user.user_id,
        password=generated_password,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(temp_password)
    print(f"DEBUG: Saving TemporaryPassword for user_id={new_user.user_id}")
    db.commit()
    db.refresh(new_user)

    return {
        **_user_to_out(new_user).model_dump(),
        "generated_password": generated_password
    }


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    body: UpdateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator")),
):
    """Update user details. Admin only."""
    target = db.query(User).filter(User.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    changes = []

    if body.email and body.email != target.email:
        # Validate email domain - only @ursb.go.ug addresses are permitted
        validate_ursb_email(body.email)
        dup = db.query(User).filter(User.email == body.email, User.user_id != user_id).first()
        if dup:
            raise HTTPException(status_code=409, detail="Another user already has this email.")
        changes.append(f"email '{target.email}' → '{body.email}'")
        target.email = body.email

    if body.full_name and body.full_name != target.full_name:
        changes.append(f"name '{target.full_name}' → '{body.full_name}'")
        target.full_name = body.full_name

    if body.role:
        try:
            new_role = UserRole(body.role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")
        if new_role != target.role:
            changes.append(f"role '{target.role.value}' → '{new_role.value}'")
            target.role = new_role

    if body.department and body.department != target.department:
        changes.append(f"department '{target.department}' → '{body.department}'")
        target.department = body.department

    if not changes:
        raise HTTPException(status_code=400, detail="No changes provided.")

    audit = AuditLog(
        user_id=current_user.user_id,
        action="USER_UPDATED",
        table_affected="users",
        record_id=target.user_id,
        details=f"Updated user '{target.full_name}': {'; '.join(changes)}.",
    )
    db.add(audit)
    db.commit()
    db.refresh(target)
    return _user_to_out(target)


@router.put("/users/{user_id}/role", response_model=RoleChangeResponse)
def update_user_role(
    user_id: str,
    body: RoleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator")),
):
    """Change a user's role. Only System Administrators can do this."""
    target = db.query(User).filter(User.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        new_role = UserRole(body.role)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid role: {body.role}"
        )

    old_role = target.role.value
    if old_role == new_role.value:
        return RoleChangeResponse(
            message="Role unchanged", user_id=str(target.user_id), new_role=new_role.value
        )

    target.role = new_role

    # Create audit log
    audit_entry = AuditLog(
        user_id=current_user.user_id,
        action="CHANGE_ROLE",
        table_affected="users",
        record_id=target.user_id,
        details=f"User {target.email} role changed from {old_role} to {new_role.value} by {current_user.email}",
        timestamp=datetime.utcnow(),
    )
    # Bug fix — audit_entry was constructed but never staged for commit
    db.add(audit_entry)
    db.commit()

    return RoleChangeResponse(
        message=f"Role updated from '{old_role}' to '{new_role.value}'",
        user_id=str(target.user_id),
        new_role=new_role.value,
    )


@router.put("/users/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator")),
):
    """Deactivate a user without deleting them. Admin only."""
    target = db.query(User).filter(User.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")
    if not target.is_active:
        raise HTTPException(status_code=400, detail="User is already deactivated.")

    target.is_active = False

    # Invalidate all active sessions on deactivation — user cannot continue using the system
    db.query(Session).filter(Session.user_id == target.user_id).delete()

    audit = AuditLog(
        user_id=current_user.user_id,
        action="DEACTIVATE_USER",
        table_affected="users",
        record_id=target.user_id,
        details=f"User {target.email} deactivated by {current_user.email}. All sessions invalidated.",
    )
    db.add(audit)
    db.commit()
    db.refresh(target)
    return _user_to_out(target)


@router.put("/users/{user_id}/reactivate", response_model=UserOut)
def reactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator")),
):
    """Reactivate a previously deactivated user. Admin only."""
    target = db.query(User).filter(User.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.is_active:
        raise HTTPException(status_code=400, detail="User is already active.")

    target.is_active = True

    audit = AuditLog(
        user_id=current_user.user_id,
        action="REACTIVATE_USER",
        table_affected="users",
        record_id=target.user_id,
        details=f"User {target.email} reactivated by {current_user.email}",
    )
    db.add(audit)
    db.commit()
    db.refresh(target)
    return _user_to_out(target)


@router.get("/audit-logs", response_model=AuditLogListResponse)
def list_audit_logs(
    page: int = 1,
    page_size: int = 20,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    table_affected: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("System Administrator", "Asset Manager")
    ),
):
    
    if page < 1:
        raise HTTPException(status_code=400, detail="Page must be 1 or greater")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="page_size must be between 1 and 100")

    # Validate date range
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=400, detail="from_date cannot be after to_date")

    # Build base query
    filtered_query = db.query(AuditLog)

    # Apply filters — only if provided
    if user_id is not None:
        filtered_query = filtered_query.filter(AuditLog.user_id == user_id)
    if action is not None:
        # ilike enables partial matching — "ASSET" returns all asset-related actions
        filtered_query = filtered_query.filter(AuditLog.action.ilike(f"%{action}%"))
    if table_affected is not None:
        filtered_query = filtered_query.filter(AuditLog.table_affected == table_affected)
    if from_date is not None:
        # inclusive lower bound
        filtered_query = filtered_query.filter(AuditLog.timestamp >= from_date)
    if to_date is not None:
        # +1 day includes the full to_date day (upper bound is exclusive)
        filtered_query = filtered_query.filter(
            AuditLog.timestamp < to_date + timedelta(days=1)
        )

    total = filtered_query.count()

    logs = (
        filtered_query
        .order_by(AuditLog.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    log_responses = []
    for log in logs:
        user = db.query(User).filter(User.user_id == log.user_id).first()
        user_name = _full_name(user) if user else "Unknown User"
        log_responses.append(AuditLogResponse(
            log_id=str(log.log_id),
            timestamp=log.timestamp.isoformat() if log.timestamp else "",
            user_id=log.user_id,
            user_name=user_name,
            action=log.action,
            table_affected=log.table_affected or "",
            record_id=str(log.record_id) if log.record_id else "",
            details=log.details or "",
        ))

    import math
    # math.ceil ensures a partial last page still counts as a full page
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return AuditLogListResponse(
        logs=log_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )