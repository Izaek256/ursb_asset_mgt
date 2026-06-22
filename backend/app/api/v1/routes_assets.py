"""Asset routes: list, filter, search, and register assets."""

import uuid
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.asset import Asset, AssetCondition, AssetStatus, AssetType, SourceType
from app.models.audit_log import AuditLog
from app.api.v1.auth import get_current_user, require_roles

router = APIRouter(prefix="/api/assets", tags=["assets"])


class AssetOut(BaseModel):
    asset_id: str
    asset_name: str
    asset_type: str
    category: str
    serial_number: str
    condition: str
    status: str
    cost: float
    acquisition_date: str
    supplier: str
    department: str | None
    created_at: str

    class Config:
        from_attributes = True


class AssetCreate(BaseModel):
    name: str
    asset_type: str
    serial_number: str
    condition: str
    cost: float
    department: Optional[str] = None
    acquisition_date: str
    status: str
    category: str
    supplier: str
    source_type: str


# Map display-friendly status labels → model enum
_STATUS_MAP = {
    "Active": AssetStatus.ACTIVE,
    "In Store": AssetStatus.IN_STORAGE,
    "In Storage": AssetStatus.IN_STORAGE,
}


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(
    body: AssetCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("Asset Manager")),
):
    """Register a new asset. Only Asset Managers may call this endpoint."""

    # ── Validate status ─────────────────────────────────────────────────────────
    if body.status not in _STATUS_MAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{body.status}'. Allowed: Active, In Store.",
        )
    asset_status = _STATUS_MAP[body.status]

    # ── Validate asset_type enum ────────────────────────────────────────────────
    try:
        asset_type_enum = AssetType(body.asset_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid asset type '{body.asset_type}'.",
        )

    # ── Validate condition enum ─────────────────────────────────────────────────
    try:
        condition_enum = AssetCondition(body.condition)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid condition '{body.condition}'.",
        )

    # ── Validate source_type enum ───────────────────────────────────────────────
    try:
        source_type_enum = SourceType(body.source_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid source type '{body.source_type}'.",
        )

    # ── Validate acquisition_date ───────────────────────────────────────────────
    try:
        parsed_acquisition_date = datetime.strptime(body.acquisition_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid acquisition_date '{body.acquisition_date}'. Expected format: YYYY-MM-DD.",
        )

    # ── Generate unique asset ID ────────────────────────────────────────────────
    new_asset_id = f"URSB-{str(uuid.uuid4()).upper()[:8]}"

    # ── Create asset record ─────────────────────────────────────────────────────
    new_asset = Asset(
        asset_id=new_asset_id,
        asset_name=body.name,
        asset_type=asset_type_enum,
        category=body.category,
        serial_number=body.serial_number,
        condition=condition_enum,
        status=asset_status,
        source_type=source_type_enum,
        cost=body.cost,
        acquisition_date=parsed_acquisition_date,
        supplier=body.supplier,
        department=body.department,
    )
    db.add(new_asset)

    # ── Audit log ───────────────────────────────────────────────────────────────
    audit_entry = AuditLog(
        user_id=current_user.user_id,
        action="ASSET_REGISTRATION",
        table_affected="assets",
        record_id=new_asset_id,
        details=f"Asset {body.name} registered with ID {new_asset_id}",
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(new_asset)

    return AssetOut(
        asset_id=new_asset.asset_id,
        asset_name=new_asset.asset_name,
        asset_type=new_asset.asset_type.value if hasattr(new_asset.asset_type, "value") else str(new_asset.asset_type),
        category=new_asset.category,
        serial_number=new_asset.serial_number,
        condition=new_asset.condition.value if hasattr(new_asset.condition, "value") else str(new_asset.condition),
        status=new_asset.status.value if hasattr(new_asset.status, "value") else str(new_asset.status),
        cost=float(new_asset.cost),
        acquisition_date=str(new_asset.acquisition_date),
        supplier=new_asset.supplier,
        department=new_asset.department,
        created_at=str(new_asset.created_at),
    )


@router.get("", response_model=List[AssetOut])
def list_assets(
    status: Optional[str] = Query(None),
    asset_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    q = db.query(Asset)
    if status:
        q = q.filter(Asset.status == status)
    if asset_type:
        q = q.filter(Asset.asset_type == asset_type)
    if search:
        q = q.filter(
            Asset.asset_name.ilike(f"%{search}%")
            | Asset.serial_number.ilike(f"%{search}%")
        )
    assets = q.order_by(Asset.created_at.desc()).all()
    return [
        AssetOut(
            asset_id=a.asset_id,
            asset_name=a.asset_name,
            asset_type=a.asset_type.value if hasattr(a.asset_type, "value") else str(a.asset_type),
            category=a.category,
            serial_number=a.serial_number,
            condition=a.condition.value if hasattr(a.condition, "value") else str(a.condition),
            status=a.status.value if hasattr(a.status, "value") else str(a.status),
            cost=float(a.cost),
            acquisition_date=str(a.acquisition_date),
            supplier=a.supplier,
            department=a.department,
            created_at=str(a.created_at),
        )
        for a in assets
    ]
