"""Admin routes: user management, role changes, and audit logs."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.api.v1.auth import get_current_user, require_roles, hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Schemas ──────────────────────────────────────────────────────────────────────
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


class RoleUpdateRequest(BaseModel):
    role: str


class CreateUserRequest(BaseModel):
    full_name: str
    email: str
    password: str
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


class RoleChangeResponse(BaseModel):
    message: str
    user_id: str
    new_role: str


# ── Helpers ──────────────────────────────────────────────────────────────────────
def _user_to_out(u: User) -> UserOut:
    return UserOut(
        id=u.user_id,
        name=u.full_name,
        email=u.email,
        role=u.role.value,
        isActive=u.is_active,
        department=u.department,
        created_at=u.created_at.isoformat() if u.created_at else "",
    )


def _log_to_out(log: AuditLog, db: Session) -> AuditLogOut:
    user = db.query(User).filter(User.user_id == log.user_id).first()
    # Extract target user name from details or record_id
    target_user = ""
    if log.record_id:
        target = db.query(User).filter(User.user_id == log.record_id).first()
        if target:
            target_user = target.full_name
        else:
            target_user = log.record_id

    return AuditLogOut(
        id=str(log.log_id),
        timestamp=log.timestamp.isoformat() if log.timestamp else "",
        performedBy=user.full_name if user else "Unknown",
        targetUser=target_user,
        action=f"{log.action} — {log.details[:120]}",
        ipAddress=None,
    )


# ── Endpoints ────────────────────────────────────────────────────────────────────
@router.post("/users", response_model=UserOut)
def create_user(
    body: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator")),
):
    """Create a new user account. Admin only."""
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists.")

    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    try:
        role = UserRole(body.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")

    new_user = User(
        full_name=body.full_name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=role,
        department=body.department,
        is_active=True,
    )
    db.add(new_user)
    db.flush()  # Get the auto-generated user_id before commit

    audit = AuditLog(
        user_id=current_user.user_id,
        action="USER_CREATED",
        table_affected="users",
        record_id=new_user.user_id,
        details=f"Created user '{new_user.full_name}' ({new_user.email}) with role '{role.value}' in department '{body.department}'.",
    )
    db.add(audit)
    db.commit()
    db.refresh(new_user)
    return _user_to_out(new_user)


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

    audit = AuditLog(
        user_id=current_user.user_id,
        action="USER_DEACTIVATED",
        table_affected="users",
        record_id=target.user_id,
        details=f"Deactivated user '{target.full_name}' ({target.email}).",
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
        action="USER_REACTIVATED",
        table_affected="users",
        record_id=target.user_id,
        details=f"Reactivated user '{target.full_name}' ({target.email}).",
    )
    db.add(audit)
    db.commit()
    db.refresh(target)
    return _user_to_out(target)


@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("System Administrator", "Asset Manager")
    ),
):
    """List all users. Only accessible by System Admin and Asset Manager."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_user_to_out(u) for u in users]


@router.put("/users/{user_id}/role", response_model=RoleChangeResponse)
def update_user_role(
    user_id: str,
    body: RoleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("System Administrator")
    ),
):
    """Change a user's role. Only System Administrators can do this."""
    target = db.query(User).filter(User.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate role
    try:
        new_role = UserRole(body.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")

    old_role = target.role.value
    target.role = new_role

    # Create audit log
    audit_entry = AuditLog(
        user_id=current_user.user_id,
        action="ROLE_CHANGE",
        table_affected="users",
        record_id=target.user_id,
        details=f"Role changed from '{old_role}' to '{new_role.value}' for {target.full_name}.",
    )
    db.add(audit_entry)
    db.commit()

    return RoleChangeResponse(
        message=f"Role updated from '{old_role}' to '{new_role.value}'",
        user_id=target.user_id,
        new_role=new_role.value,
    )


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
