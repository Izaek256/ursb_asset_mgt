"""Asset routes: list, filter, and search assets."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.asset import Asset
from app.api.v1.auth import get_current_user

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
