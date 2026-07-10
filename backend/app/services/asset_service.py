"""
Asset business logic service.
Routers call these functions — no business logic lives in route handlers.
"""

import uuid
from datetime import datetime
from typing import Optional, Tuple, List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.asset import Asset, AssetCondition, AssetStatus, AssetType, SourceType
from app.models.audit_log import AuditLog


# Valid status transitions — Disposed is terminal, no further transitions allowed
VALID_STATUS_TRANSITIONS = {
    "Active": ["In Storage", "Under Maintenance", "Disposed"],
    "In Storage": ["Active", "Disposed"],
    "Under Maintenance": ["Active", "Disposed"],
    "Disposed": [],
}

_STATUS_MAP = {
    "Active": AssetStatus.ACTIVE,
    "In Store": AssetStatus.IN_STORAGE,
    "In Storage": AssetStatus.IN_STORAGE,
}


def validate_status_transition(current_status: str, new_status: str) -> None:
    """
    Enforce asset status transition rules.

    Parameters:
        current_status: The asset's current status string.
        new_status: The requested new status string.

    Raises:
        HTTPException 422 if the transition is not permitted.

    Business rules:
        Disposed is a terminal state — no transitions out.
        See VALID_STATUS_TRANSITIONS for the full matrix.
    """
    allowed = VALID_STATUS_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status transition from '{current_status}' to '{new_status}'. Allowed: {', '.join(allowed) or 'none'}",
        )


def get_asset(db: Session, asset_id: str) -> Asset:
    """
    Fetch a single asset by ID.

    Parameters:
        db: Database session.
        asset_id: The asset's unique identifier.

    Returns:
        Asset ORM object.

    Raises:
        HTTPException 404 if asset not found.
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID {asset_id} not found",
        )
    return asset


def list_assets(
    db: Session,
    status: Optional[str] = None,
    asset_type: Optional[str] = None,
    search: Optional[str] = None,
    department: Optional[str] = None,
    custodian_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> Tuple[List[Asset], int]:
    """
    Return a filtered list of assets and total count.

    Parameters:
        db: Database session.
        status: Filter by status string (optional).
        asset_type: Filter by asset type string (optional).
        search: Filter by name or serial number (optional).
        department: Filter by department (optional).
        custodian_id: Filter by current custodian ID (optional).
        limit: Max records to return (default 100).
        offset: Records to skip for pagination (default 0).

    Returns:
        Tuple of (list of Asset objects, total matching count).

    Raises:
        HTTPException 400 for invalid status or asset_type values.
    """
    q = db.query(Asset)

    if status:
        try:
            status_enum = AssetStatus(status)
            q = q.filter(Asset.status == status_enum)
        except ValueError:
            valid = [e.value for e in AssetStatus]
            raise HTTPException(400, detail=f"Invalid status. Valid: {', '.join(valid)}")

    if asset_type:
        try:
            type_enum = AssetType(asset_type)
            q = q.filter(Asset.asset_type == type_enum)
        except ValueError:
            valid = [e.value for e in AssetType]
            raise HTTPException(400, detail=f"Invalid asset_type. Valid: {', '.join(valid)}")

    if search:
        q = q.filter(
            Asset.asset_name.ilike(f"%{search}%") | Asset.serial_number.ilike(f"%{search}%")
        )

    if department:
        q = q.filter(Asset.department == department)

    if custodian_id:
        q = q.filter(Asset.current_custodian_id == custodian_id)

    total = q.count()
    assets = q.order_by(Asset.created_at.desc()).offset(offset).limit(limit).all()
    return assets, total


def create_asset(db: Session, data, created_by_id: int) -> Asset:
    """
    Register a new asset.

    Parameters:
        db: Database session.
        data: AssetCreate schema object with asset fields.
        created_by_id: user_id of the Asset Manager creating the record.

    Returns:
        Newly created Asset ORM object.

    Raises:
        HTTPException 400 for invalid enum values or date format.

    Business rules:
        Auto-generates a unique asset_id in format URSB-XXXXXXXX.
        Writes an ASSET_REGISTRATION audit log entry on success.
        All database mutations wrapped in a single transaction.

    Audit log:
        Writes action=ASSET_REGISTRATION on success.
    """
    if data.status not in _STATUS_MAP:
        raise HTTPException(400, detail=f"Invalid status '{data.status}'. Allowed: Active, In Store.")

    try:
        asset_type_enum = AssetType(data.asset_type)
    except ValueError:
        raise HTTPException(400, detail=f"Invalid asset type '{data.asset_type}'.")

    try:
        condition_enum = AssetCondition(data.condition)
    except ValueError:
        raise HTTPException(400, detail=f"Invalid condition '{data.condition}'.")

    try:
        source_type_enum = SourceType(data.source_type)
    except ValueError:
        raise HTTPException(400, detail=f"Invalid source type '{data.source_type}'.")

    try:
        parsed_date = datetime.strptime(data.acquisition_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, detail=f"Invalid acquisition_date '{data.acquisition_date}'. Expected: YYYY-MM-DD.")

    new_asset_id = f"URSB-{str(uuid.uuid4()).upper()[:8]}"

    asset = Asset(
        asset_id=new_asset_id,
        asset_name=data.name,
        asset_type=asset_type_enum,
        category=data.category,
        serial_number=data.serial_number,
        condition=condition_enum,
        status=_STATUS_MAP[data.status],
        source_type=source_type_enum,
        cost=data.cost,
        acquisition_date=parsed_date,
        supplier=data.supplier,
        department=data.department,
    )
    db.add(asset)

    db.add(AuditLog(
        user_id=created_by_id,
        action="ASSET_REGISTRATION",
        table_affected="assets",
        record_id=new_asset_id,
        details=f"Asset {data.name} registered with ID {new_asset_id}",
    ))
    db.commit()
    db.refresh(asset)
    return asset


def update_asset(db: Session, asset_id: str, data, updated_by_id: int) -> Asset:
    """
    Update asset fields. Only modifies fields that are provided (non-null).

    Parameters:
        db: Database session.
        asset_id: ID of the asset to update.
        data: AssetUpdateRequest schema object.
        updated_by_id: user_id of the user making the update.

    Returns:
        Updated Asset ORM object.

    Raises:
        HTTPException 404 if asset not found.
        HTTPException 400 if asset is disposed or inactive.
        HTTPException 422 if status transition is invalid (via validate_status_transition).
        HTTPException 400 for invalid condition or status values.

    Business rules:
        Disposed assets cannot be updated.
        Inactive assets cannot be updated.
        Status changes are validated via validate_status_transition().

    Audit log:
        Writes action=ASSET_UPDATE on success.
    """
    asset = get_asset(db, asset_id)

    if asset.status == AssetStatus.DISPOSED:
        raise HTTPException(400, detail="Cannot update a disposed asset")
    if not asset.is_active:
        raise HTTPException(400, detail="Cannot update an inactive asset")

    if data.status is not None:
        current_status = asset.status.value if hasattr(asset.status, "value") else str(asset.status)
        validate_status_transition(current_status, data.status)

    if data.asset_name is not None:
        asset.asset_name = data.asset_name
    if data.category is not None:
        asset.category = data.category
    if data.condition is not None:
        try:
            asset.condition = AssetCondition(data.condition)
        except ValueError:
            raise HTTPException(400, detail=f"Invalid condition '{data.condition}'")
    if data.status is not None:
        try:
            asset.status = AssetStatus(data.status)
        except ValueError:
            raise HTTPException(400, detail=f"Invalid status '{data.status}'")
    if data.department is not None:
        asset.department = data.department
    if data.current_custodian_id is not None:
        asset.current_custodian_id = str(data.current_custodian_id)
    if data.supplier is not None:
        asset.supplier = data.supplier
    if data.procurement_ref is not None:
        asset.procurement_ref = data.procurement_ref
    if data.cost is not None:
        asset.cost = data.cost

    db.add(AuditLog(
        user_id=updated_by_id,
        action="ASSET_UPDATE",
        table_affected="assets",
        record_id=asset_id,
        details=f"Asset {asset.asset_name} updated",
    ))
    db.commit()
    db.refresh(asset)
    return asset


def export_assets_csv(db: Session, filters: dict) -> str:
    """
    Return a CSV-formatted string of assets matching the provided filters.

    Parameters:
        db: Database session.
        filters: Dict with optional keys: status, asset_type, search, department.

    Returns:
        CSV string with headers. Column order matches bulk import template.

    Business rules:
        Applies same filter logic as list_assets().
        No audit log written for exports.
    """
    assets, _ = list_assets(
        db,
        status=filters.get("status"),
        asset_type=filters.get("asset_type"),
        search=filters.get("search"),
        department=filters.get("department"),
    )

    lines = ["asset_id,asset_name,asset_type,category,serial_number,condition,status,cost,acquisition_date,supplier,department"]
    for a in assets:
        lines.append(",".join([
            a.asset_id,
            a.asset_name,
            a.asset_type.value if hasattr(a.asset_type, "value") else str(a.asset_type),
            a.category,
            a.serial_number,
            a.condition.value if hasattr(a.condition, "value") else str(a.condition),
            a.status.value if hasattr(a.status, "value") else str(a.status),
            str(float(a.cost)),
            str(a.acquisition_date),
            a.supplier,
            a.department or "",
        ]))
    return "\n".join(lines)