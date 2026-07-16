"""Settings router: user and system settings endpoints."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.models.user_settings import UserSettings
from app.models.system_settings import SystemSettings
from app.models.audit_log import AuditLog
from app.models.user import UserRole
from app.api.v1.auth import get_current_user, require_role

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


class UserSettingsResponse(BaseModel):
    notifications_email: bool
    notifications_in_app: bool
    notifications_maintenance_alerts: bool
    notifications_transfer_alerts: bool
    notifications_request_updates: bool
    theme: str
    language: str


class UserSettingsUpdateRequest(BaseModel):
    notifications_email: Optional[bool] = None
    notifications_in_app: Optional[bool] = None
    notifications_maintenance_alerts: Optional[bool] = None
    notifications_transfer_alerts: Optional[bool] = None
    notifications_request_updates: Optional[bool] = None
    theme: Optional[str] = None
    language: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None


class SystemSettingsResponse(BaseModel):
    org_name: str
    asset_id_prefix: str
    session_timeout_hours: int
    max_failed_logins: int
    updated_by: Optional[int]
    updated_at: Optional[datetime]


class SystemSettingsUpdateRequest(BaseModel):
    org_name: Optional[str] = None
    asset_id_prefix: Optional[str] = None
    session_timeout_hours: Optional[int] = None
    max_failed_logins: Optional[int] = None


@router.get("", response_model=UserSettingsResponse)
def get_user_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch or create user settings for current user (fetch-or-create pattern)."""
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return UserSettingsResponse(
        notifications_email=settings.notifications_email,
        notifications_in_app=settings.notifications_in_app,
        notifications_maintenance_alerts=settings.notifications_maintenance_alerts,
        notifications_transfer_alerts=settings.notifications_transfer_alerts,
        notifications_request_updates=settings.notifications_request_updates,
        theme=settings.theme,
        language=settings.language,
    )


@router.put("", response_model=UserSettingsResponse)
def update_user_settings(
    body: UserSettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)

    if body.theme is not None and body.theme not in ("light", "dark"):
        raise HTTPException(status_code=400, detail="Invalid theme")
    if body.language is not None and body.language not in ("en", "fr"):
        raise HTTPException(status_code=400, detail="Invalid language")

    for field, value in body.__dict__.items():
        if value is not None:
            # Handle profile fields (first_name, last_name, phone_number) on User model
            if field in ("first_name", "last_name", "phone_number"):
                setattr(current_user, field, value)
            else:
                setattr(settings, field, value)

    settings.updated_at = datetime.utcnow()
    db.add(settings)
    db.add(current_user)
    db.commit()
    db.refresh(settings)
    db.refresh(current_user)

    return UserSettingsResponse(
        notifications_email=settings.notifications_email,
        notifications_in_app=settings.notifications_in_app,
        notifications_maintenance_alerts=settings.notifications_maintenance_alerts,
        notifications_transfer_alerts=settings.notifications_transfer_alerts,
        notifications_request_updates=settings.notifications_request_updates,
        theme=settings.theme,
        language=settings.language,
    )


@router.get("/system", response_model=SystemSettingsResponse)
def get_system_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SYSTEM_ADMINISTRATOR, UserRole.ASSET_MANAGER)),
):
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return SystemSettingsResponse(
        org_name=settings.org_name,
        asset_id_prefix=settings.asset_id_prefix,
        session_timeout_hours=settings.session_timeout_hours,
        max_failed_logins=settings.max_failed_logins,
        updated_by=settings.updated_by,
        updated_at=settings.updated_at,
    )


@router.put("/system", response_model=SystemSettingsResponse)
def update_system_settings(
    body: SystemSettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SYSTEM_ADMINISTRATOR)),
):
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(id=1)
        db.add(settings)

    if body.session_timeout_hours is not None and not (1 <= body.session_timeout_hours <= 168):
        raise HTTPException(status_code=400, detail="session_timeout_hours must be between 1 and 168")
    if body.max_failed_logins is not None and not (1 <= body.max_failed_logins <= 10):
        raise HTTPException(status_code=400, detail="max_failed_logins must be between 1 and 10")

    for field, value in body.__dict__.items():
        if value is not None:
            setattr(settings, field, value)

    settings.updated_by = current_user.id
    settings.updated_at = datetime.utcnow()
    db.add(settings)
    db.commit()

    # Audit
    audit = AuditLog(
        user_id=current_user.id,
        action="UPDATE_SYSTEM_SETTINGS",
        table_affected="system_settings",
        record_id=str(settings.id),
        details=f"System settings updated by user {current_user.id}",
    )
    db.add(audit)
    db.commit()

    return SystemSettingsResponse(
        org_name=settings.org_name,
        asset_id_prefix=settings.asset_id_prefix,
        session_timeout_hours=settings.session_timeout_hours,
        max_failed_logins=settings.max_failed_logins,
        updated_by=settings.updated_by,
        updated_at=settings.updated_at,
    )
