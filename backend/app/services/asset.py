import json
import uuid
from datetime import datetime

from sqlalchemy.orm import Session as DbSession

from app.models.asset import Asset
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.asset import AssetCreate


def create_asset(db: DbSession, payload: AssetCreate, current_user: User) -> Asset:
    """Create a new asset and write an audit log entry in a single transaction.

    If either insert fails, both roll back.
    """
    asset = Asset(
        asset_id=f"AST-{uuid.uuid4().hex[:8].upper()}",
        asset_name=payload.asset_name,
        category=payload.category,
        description=payload.description,
        status=payload.status,
        purchase_date=payload.purchase_date,
        purchase_cost=payload.purchase_cost,
        location=payload.location,
        serial_number=payload.serial_number,
        created_by=current_user.id,
    )
    db.add(asset)
    db.flush()  # ensures asset is populated before audit log

    audit_entry = AuditLog(
        user_id=str(current_user.id),
        action="ASSET_REGISTERED",
        table_affected="assets",
        record_id=asset.asset_id,
        details=json.dumps(
            {
                "asset_name": payload.asset_name,
                "category": payload.category,
                "status": payload.status.value,
                "purchase_cost": payload.purchase_cost,
                "purchase_date": payload.purchase_date.isoformat(),
                "location": payload.location,
            }
        ),
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(asset)
    return asset


def get_all_assets(db: DbSession) -> list[Asset]:
    """Return all assets, newest first."""
    return db.query(Asset).order_by(Asset.created_at.desc()).all()
