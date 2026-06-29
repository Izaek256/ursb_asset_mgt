"""
Maintenance routes.

Endpoints:
    POST  /api/v1/maintenance                       — log a maintenance record
    PATCH /api/v1/maintenance/{id}/complete         — mark maintenance complete
    PATCH /api/v1/maintenance/{id}/schedule         — schedule next maintenance
    GET   /api/v1/maintenance/upcoming              — assets due within 30 days
    GET   /api/v1/maintenance                       — list all records
    GET   /api/v1/maintenance/{id}                  — get single record
"""

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.asset import Asset, AssetStatus
from app.models.audit_log import AuditLog
from app.models.maintenance_record import MaintenanceRecord
from app.models.user import User
from app.api.v1.auth import get_current_user, require_roles

router = APIRouter(prefix="/api/v1/maintenance", tags=["maintenance"])


# ── Helpers ───────────────────────────────────────────────────────────────────────
def _user_name(u: Optional[User]) -> str:
    if not u:
        return "Unknown"
    if u.first_name or u.last_name:
        return f"{u.first_name or ''} {u.last_name or ''}".strip()
    return u.email


def _log(db: Session, *, actor: User, action: str, record_id: str, details: str):
    db.add(AuditLog(
        user_id=actor.user_id,
        action=action,
        table_affected="maintenance_records",
        record_id=record_id,
        details=details,
    ))


def _serialize(m: MaintenanceRecord, db: Session) -> dict:
    asset = db.query(Asset).filter(Asset.asset_id == m.asset_id).first()
    recorder = db.query(User).filter(User.id == m.recorded_by).first()
    return {
        "maintenance_id": m.maintenance_id,
        "asset_id": m.asset_id,
        "asset_name": asset.asset_name if asset else None,
        "asset_status": asset.status.value if asset else None,
        "service_date": str(m.service_date),
        "service_provider": m.service_provider,
        "description": m.description,
        "cost": float(m.cost) if m.cost else None,
        "next_service_date": str(m.next_service_date) if m.next_service_date else None,
        "recorded_by": m.recorded_by,
        "recorded_by_name": _user_name(recorder),
    }


def _get_record_or_404(db: Session, maintenance_id: int) -> MaintenanceRecord:
    record = db.query(MaintenanceRecord).filter(
        MaintenanceRecord.maintenance_id == maintenance_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found.")
    return record


# ── Schemas ───────────────────────────────────────────────────────────────────────
class MaintenanceCreateRequest(BaseModel):
    asset_id: str
    service_date: date
    service_provider: str
    description: str
    cost: Optional[float] = None
    next_service_date: Optional[date] = None
    maintenance_type: Optional[str] = None


class ScheduleRequest(BaseModel):
    next_service_date: date


# ── Endpoints ─────────────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
def log_maintenance(
    body: MaintenanceCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("System Administrator", "Asset Manager")
    ),
):
    """Log a maintenance record and transition asset to Under Maintenance."""
    asset = db.query(Asset).filter(Asset.asset_id == body.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
    if asset.status == AssetStatus.DISPOSED:
        raise HTTPException(
            status_code=400, detail="Cannot log maintenance for a disposed asset."
        )
    if body.service_date > date.today():
        raise HTTPException(
            status_code=400, detail="Service date cannot be in the future."
        )
    if body.cost is not None and body.cost <= 0:
        raise HTTPException(
            status_code=400, detail="Cost must be a positive value."
        )

    record = MaintenanceRecord(
        asset_id=body.asset_id,
        service_date=body.service_date,
        service_provider=body.service_provider,
        description=body.description,
        cost=body.cost or 0,
        next_service_date=body.next_service_date,
        recorded_by=current_user.id,
    )
    db.add(record)
    db.flush()

    # Transition Active asset to Under Maintenance
    if asset.status == AssetStatus.ACTIVE:
        asset.status = AssetStatus.UNDER_MAINTENANCE

    _log(db, actor=current_user, action="RECORD_MAINTENANCE",
         record_id=str(record.maintenance_id),
         details=f"Maintenance logged for asset {body.asset_id} by {_user_name(current_user)}. "
                 f"Provider: {body.service_provider}. "
                 f"Cost: UGX {body.cost:,.0f}." if body.cost else
                 f"Maintenance logged for asset {body.asset_id} by {_user_name(current_user)}. "
                 f"Provider: {body.service_provider}.")
    db.commit()
    db.refresh(record)
    return _serialize(record, db)


@router.patch("/{maintenance_id}/complete")
def complete_maintenance(
    maintenance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("System Administrator", "Asset Manager")
    ),
):
    """Mark maintenance as complete and return asset to Active."""
    record = _get_record_or_404(db, maintenance_id)

    asset = db.query(Asset).filter(Asset.asset_id == record.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
    if asset.status != AssetStatus.UNDER_MAINTENANCE:
        raise HTTPException(
            status_code=400,
            detail=f"Asset must be Under Maintenance. Current: {asset.status.value}",
        )

    asset.status = AssetStatus.ACTIVE

    _log(db, actor=current_user, action="COMPLETE_MAINTENANCE",
         record_id=str(record.maintenance_id),
         details=f"Maintenance #{maintenance_id} for asset {record.asset_id} marked complete "
                 f"by {_user_name(current_user)}. Asset returned to Active.")
    db.commit()
    db.refresh(record)
    return _serialize(record, db)


@router.patch("/{maintenance_id}/schedule")
def schedule_maintenance(
    maintenance_id: int,
    body: ScheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("System Administrator", "Asset Manager")
    ),
):
    """Schedule the next maintenance date."""
    record = _get_record_or_404(db, maintenance_id)

    if body.next_service_date <= date.today():
        raise HTTPException(
            status_code=400,
            detail="Next service date must be in the future.",
        )

    record.next_service_date = body.next_service_date

    _log(db, actor=current_user, action="SCHEDULE_MAINTENANCE",
         record_id=str(record.maintenance_id),
         details=f"Next maintenance for asset {record.asset_id} scheduled for "
                 f"{body.next_service_date} by {_user_name(current_user)}.")
    db.commit()
    db.refresh(record)
    return _serialize(record, db)


# NOTE: /upcoming must be defined BEFORE /{maintenance_id} to avoid routing conflict
@router.get("/upcoming")
def upcoming_maintenance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return maintenance records due within the next 30 days."""
    today = date.today()
    cutoff = today + timedelta(days=30)

    records = (
        db.query(MaintenanceRecord)
        .filter(
            MaintenanceRecord.next_service_date >= today,
            MaintenanceRecord.next_service_date <= cutoff,
        )
        .order_by(MaintenanceRecord.next_service_date.asc())
        .all()
    )
    return {
        "records": [_serialize(r, db) for r in records],
        "total": len(records),
    }


@router.get("")
def list_maintenance(
    asset_id: Optional[str] = None,
    recorded_by: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all maintenance records."""
    q = db.query(MaintenanceRecord)
    if asset_id:
        q = q.filter(MaintenanceRecord.asset_id == asset_id)
    if recorded_by:
        q = q.filter(MaintenanceRecord.recorded_by == recorded_by)
    records = q.order_by(MaintenanceRecord.service_date.desc()).all()
    return {
        "records": [_serialize(r, db) for r in records],
        "total": len(records),
    }


@router.get("/{maintenance_id}")
def get_maintenance(
    maintenance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single maintenance record."""
    record = _get_record_or_404(db, maintenance_id)
    return _serialize(record, db)