"""Storage management endpoints."""

from datetime import date
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.v1.auth import get_current_user, require_role
from app.models.asset import Asset, AssetStatus, AssetType
from app.models.assignment import Assignment, AssignmentStatus
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.user import UserRole
from app.services.asset_service import validate_status_transition

router = APIRouter(prefix="/api/v1/storage", tags=["storage"])


class StorageAssignRequest(BaseModel):
    assigned_to: int
    notes: Optional[str] = None


class AssetDetailSummary(BaseModel):
    asset_id: str
    asset_name: str
    asset_type: Optional[str] = None
    status: str
    department: Optional[str] = None
    serial_number: Optional[str] = None
    current_custodian_id: Optional[int] = None

    class Config:
        from_attributes = True


class StorageListResponse(BaseModel):
    assets: List[AssetDetailSummary]
    total: int
    by_department: Dict[str, int]
    by_type: Dict[str, int]


def _log(db: Session, *, actor: User, action: str, record_id: str, details: str) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            table_affected="assets",
            record_id=record_id,
            details=details,
        )
    )


@router.get("", response_model=StorageListResponse)
def list_storage(
    department: Optional[str] = None,
    asset_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Asset).filter(Asset.status == AssetStatus.AVAILABLE)
    if department:
        query = query.filter(Asset.department == department)
    if asset_type:
        try:
            asset_type_enum = AssetType(asset_type)
        except ValueError as exc:
            raise HTTPException(400, detail=f"Invalid asset type: {asset_type}") from exc
        query = query.filter(Asset.asset_type == asset_type_enum)
    if search:
        query = query.filter(
            Asset.asset_name.ilike(f"%{search}%") | Asset.serial_number.ilike(f"%{search}%")
        )

    assets = query.order_by(Asset.created_at.desc()).all()
    by_department: Dict[str, int] = {}
    by_type: Dict[str, int] = {}
    for asset in assets:
        dept = asset.department or "Unassigned"
        by_department[dept] = by_department.get(dept, 0) + 1
        asset_type_name = asset.asset_type.value if hasattr(asset.asset_type, "value") else str(asset.asset_type)
        by_type[asset_type_name] = by_type.get(asset_type_name, 0) + 1

    return StorageListResponse(
        assets=[
            AssetDetailSummary(
                asset_id=asset.asset_id,
                asset_name=asset.asset_name,
                asset_type=asset.asset_type.value if hasattr(asset.asset_type, "value") else str(asset.asset_type),
                status=asset.status.value if hasattr(asset.status, "value") else str(asset.status),
                department=asset.department,
                serial_number=asset.serial_number,
                current_custodian_id=int(asset.current_custodian_id) if asset.current_custodian_id else None,
            )
            for asset in assets
        ],
        total=len(assets),
        by_department=by_department,
        by_type=by_type,
    )


@router.post("/{asset_id}/assign", response_model=AssetDetailSummary)
def assign_from_storage(
    asset_id: str,
    body: StorageAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SYSTEM_ADMINISTRATOR, UserRole.ASSET_MANAGER)),
):
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(404, detail="Asset not found")
    if asset.status != AssetStatus.AVAILABLE:
        raise HTTPException(400, detail="Asset is not in storage (Available)")
    if not getattr(asset, "is_active", True):
        raise HTTPException(400, detail="Asset is inactive")

    target_user = db.query(User).filter(User.id == body.assigned_to).first()
    if not target_user or not target_user.is_active:
        raise HTTPException(400, detail="Assigned user is invalid")

    existing = (
        db.query(Assignment)
        .filter(Assignment.asset_id == asset.asset_id, Assignment.status == AssignmentStatus.ACTIVE)
        .first()
    )
    if existing:
        raise HTTPException(400, detail="Asset already assigned. Return first.")

    db.add(
        Assignment(
            asset_id=asset.asset_id,
            assigned_to=str(body.assigned_to),
            assigned_by=str(current_user.id),
            assignment_date=date.today(),
            status=AssignmentStatus.ACTIVE,
            notes=body.notes,
        )
    )
    validate_status_transition(asset.status, AssetStatus.ASSIGNED)
    asset.status = AssetStatus.ASSIGNED
    asset.current_custodian_id = str(body.assigned_to)
    _log(db, actor=current_user, action="ASSIGN_FROM_STORAGE", record_id=asset.asset_id, details="Assigned asset from storage")
    db.commit()
    db.refresh(asset)
    return AssetDetailSummary(
        asset_id=asset.asset_id,
        asset_name=asset.asset_name,
        asset_type=asset.asset_type.value if hasattr(asset.asset_type, "value") else str(asset.asset_type),
        status=asset.status.value if hasattr(asset.status, "value") else str(asset.status),
        department=asset.department,
        serial_number=asset.serial_number,
        current_custodian_id=int(asset.current_custodian_id) if asset.current_custodian_id else None,
    )


@router.post("/{asset_id}/return", response_model=AssetDetailSummary)
def return_to_storage(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SYSTEM_ADMINISTRATOR, UserRole.ASSET_MANAGER)),
):
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(404, detail="Asset not found")
    if asset.status != AssetStatus.ASSIGNED:
        raise HTTPException(400, detail="Asset is not active (Assigned)")

    assignment = (
        db.query(Assignment)
        .filter(Assignment.asset_id == asset.asset_id, Assignment.status == AssignmentStatus.ACTIVE)
        .first()
    )
    if not assignment:
        raise HTTPException(400, detail="No active assignment found")

    assignment.status = AssignmentStatus.RETURNED
    assignment.return_date = date.today()
    validate_status_transition(asset.status, AssetStatus.AVAILABLE)
    asset.status = AssetStatus.AVAILABLE
    asset.current_custodian_id = None
    _log(db, actor=current_user, action="RETURN_TO_STORAGE", record_id=asset.asset_id, details="Returned asset to storage")
    db.commit()
    db.refresh(asset)
    return AssetDetailSummary(
        asset_id=asset.asset_id,
        asset_name=asset.asset_name,
        asset_type=asset.asset_type.value if hasattr(asset.asset_type, "value") else str(asset.asset_type),
        status=asset.status.value if hasattr(asset.status, "value") else str(asset.status),
        department=asset.department,
        serial_number=asset.serial_number,
        current_custodian_id=int(asset.current_custodian_id) if asset.current_custodian_id else None,
    )


__all__ = ["router"]