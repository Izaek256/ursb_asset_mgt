"""Admin routes: user management and audit logs."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.api.v1.auth import get_current_user, require_roles, pwd_context

import uuid
import secrets

router = APIRouter(prefix="/api/admin", tags=["admin"])


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


class AuditLogOut(BaseModel):
    id: str
    timestamp: str
    performedBy: str
    targetUser: str
    action: str
    ipAddress: Optional[str] = None

    class Config:
        from_attributes = True


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
        id=u.user_id,
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


# ── Endpoints ─────────────────────────────────────────────────────────────────────

# LIST USERS
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


# CREATE USER
@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator")),
):
    """Create a new user. Only System Administrators can do this."""
    # Validate unique email
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A user with email '{body.email}' already exists.",
        )

    # Validate role
    try:
        role = UserRole(body.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {body.role}",
        )

    salt = secrets.token_hex(16)
    hashed = pwd_context.hash(body.password)

    new_user = User(
        user_id=str(uuid.uuid4()),
        email=body.email,
        first_name=body.first_name,
        last_name=body.last_name,
        username=body.username or f"{body.first_name.lower()}.{body.last_name.lower()}",
        phone_number=body.phone_number,
        password_hash=hashed,
        password_salt=salt,
        role=role,
        department=body.department,
        is_active=True,
        failed_login_attempts=0,
    )
    db.add(new_user)
    db.flush()

    _log(
        db,
        actor=current_user,
        action="CREATE",
        table="users",
        record_id=new_user.user_id,
        details=(
            f"New user '{body.email}' created with role '{role.value}' "
            f"in department '{body.department}' by {_full_name(current_user)}."
        ),
    )
    db.commit()
    db.refresh(new_user)
    return _user_to_out(new_user)


# EDIT USER DETAILS
@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    body: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator")),
):
    """Edit user details (name, department, phone, username).
    Does not allow changing email, role, or password through this endpoint."""
    target = db.query(User).filter(User.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    changes = []
    if body.first_name is not None and body.first_name != target.first_name:
        changes.append(f"first_name: '{target.first_name}' → '{body.first_name}'")
        target.first_name = body.first_name
    if body.last_name is not None and body.last_name != target.last_name:
        changes.append(f"last_name: '{target.last_name}' → '{body.last_name}'")
        target.last_name = body.last_name
    if body.department is not None and body.department != target.department:
        changes.append(f"department: '{target.department}' → '{body.department}'")
        target.department = body.department
    if body.phone_number is not None and body.phone_number != target.phone_number:
        changes.append("phone_number updated")
        target.phone_number = body.phone_number
    if body.username is not None and body.username != target.username:
        changes.append(f"username: '{target.username}' → '{body.username}'")
        target.username = body.username

    if not changes:
        return _user_to_out(target)

    _log(
        db,
        actor=current_user,
        action="UPDATE",
        table="users",
        record_id=target.user_id,
        details=(
            f"User '{_full_name(target)}' details updated by {_full_name(current_user)}: "
            + "; ".join(changes)
        ),
    )
    db.commit()
    db.refresh(target)
    return _user_to_out(target)


# CHANGE ROLE
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
            message="Role unchanged", user_id=target.user_id, new_role=new_role.value
        )

    target.role = new_role

    # Create audit log
    audit_entry = AuditLog(
        user_id=current_user.user_id,
        action="ROLE_CHANGE",
        table_affected="users",
        record_id=target.user_id,
        details=(
            f"Role changed from '{old_role}' to '{new_role.value}' "
            f"for {_full_name(target)} by {_full_name(current_user)}."
        ),
    )
    db.commit()

    return RoleChangeResponse(
        message=f"Role updated from '{old_role}' to '{new_role.value}'",
        user_id=target.user_id,
        new_role=new_role.value,
    )


# DEACTIVATE USER
@router.patch("/users/{user_id}/deactivate", response_model=StatusChangeResponse)
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator")),
):
    """Deactivate a user account. The record is kept for audit integrity."""
    target = db.query(User).filter(User.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-deactivation
    if target.user_id == current_user.user_id:
        raise HTTPException(
            status_code=400, detail="You cannot deactivate your own account."
        )

    if not target.is_active:
        raise HTTPException(
            status_code=400,
            detail=f"User '{_full_name(target)}' is already inactive.",
        )

    target.is_active = False

    _log(
        db,
        actor=current_user,
        action="DEACTIVATE",
        table="users",
        record_id=target.user_id,
        details=(
            f"User '{_full_name(target)}' ({target.email}) deactivated "
            f"by {_full_name(current_user)}. Account access revoked."
        ),
    )
    db.commit()

    return StatusChangeResponse(
        message=f"User '{_full_name(target)}' has been deactivated.",
        user_id=target.user_id,
        is_active=False,
    )


# REACTIVATE USER
@router.patch("/users/{user_id}/reactivate", response_model=StatusChangeResponse)
def reactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator")),
):
    """Reactivate a previously deactivated user account."""
    target = db.query(User).filter(User.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.is_active:
        raise HTTPException(
            status_code=400,
            detail=f"User '{_full_name(target)}' is already active.",
        )

    target.is_active = True
    target.failed_login_attempts = 0  # reset any login lock on reactivation
    if hasattr(target, "locked_until"):
        target.locked_until = None

    _log(
        db,
        actor=current_user,
        action="REACTIVATE",
        table="users",
        record_id=target.user_id,
        details=(
            f"User '{_full_name(target)}' ({target.email}) reactivated "
            f"by {_full_name(current_user)}. Account access restored."
        ),
    )
    db.commit()

    return StatusChangeResponse(
        message=f"User '{_full_name(target)}' has been reactivated.",
        user_id=target.user_id,
        is_active=True,
    )


# LIST AUDIT LOGS
@router.get("/audit-logs", response_model=List[AuditLogOut])
def list_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("System Administrator", "Asset Manager")
    ),
):
    """Return recent audit log entries."""
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [_log_to_out(l, db) for l in logs]