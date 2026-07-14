import uuid
from datetime import datetime
from typing import Optional, Tuple, List

from sqlalchemy.orm import Session

from fastapi import HTTPException, status
from app.models.asset import Asset, AssetCondition, AssetStatus, AssetType, SourceType
from app.models.audit_log import AuditLog  
# A mapping of all valid status transitions.
# Standard: Every transition branch is documented with inline comments specifying the triggering workflow.
VALID_TRANSITIONS = {
    AssetStatus.AVAILABLE: {
        AssetStatus.RESERVED,            # Triggered by assignment offer sent (e.g. Employee offered asset)
        AssetStatus.UNDER_MAINTENANCE,   # Triggered by sending available asset to maintenance
        AssetStatus.DISPOSED,            # Triggered by asset disposal from storage - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating an available asset
        AssetStatus.ASSIGNED,            # Triggered by direct assignment from storage (immediate assign)
    },
    AssetStatus.RESERVED: {
        AssetStatus.PENDING_ACCEPTANCE,  # Triggered by employee notification of request approval - see S3-05
        AssetStatus.AVAILABLE,           # Triggered by cancellation/expiration of assignment offer
        AssetStatus.DISPOSED,            # Triggered by disposing a reserved asset - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating a reserved asset
    },
    AssetStatus.PENDING_ACCEPTANCE: {
        AssetStatus.PENDING_PICKUP,      # Triggered by employee accepting the assignment offer - see S3-05
        AssetStatus.AVAILABLE,           # Triggered by employee declining the assignment offer - see S3-05
        AssetStatus.DISPOSED,            # Triggered by disposing an asset awaiting acceptance - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating an asset awaiting acceptance
    },
    AssetStatus.PENDING_PICKUP: {
        AssetStatus.ASSIGNED,            # Triggered by custodian confirming physical handover - see S3-05
        AssetStatus.AVAILABLE,           # Triggered by cancellation/failure of handover (returns to storage)
        AssetStatus.DISPOSED,            # Triggered by disposing an asset pending pickup - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating an asset pending pickup
    },
    AssetStatus.ASSIGNED: {
        AssetStatus.UNDER_TRANSFER,      # Triggered by custodian initiating a transfer to another custodian - see S3-02
        AssetStatus.RETURNED,            # Triggered by employee returning the asset - see S3-06
        AssetStatus.UNDER_MAINTENANCE,   # Triggered by sending assigned asset to maintenance (custodian requests service)
        AssetStatus.DISPOSED,            # Triggered by disposing an assigned asset (must close assignment) - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating an assigned asset
        AssetStatus.AVAILABLE,           # Triggered by returning asset directly to storage (no intermediate custody change)
    },
    AssetStatus.UNDER_TRANSFER: {
        AssetStatus.ASSIGNED,            # Triggered by target custodian acknowledging custody transfer - see S3-02
        AssetStatus.AVAILABLE,           # Triggered by transfer return/cancellation back to storage
        AssetStatus.UNDER_MAINTENANCE,   # Triggered if asset damaged in transit and redirected to repairs
        AssetStatus.DISPOSED,            # Triggered if asset lost/damaged beyond repair in transit - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating an asset under transfer
    },
    AssetStatus.UNDER_MAINTENANCE: {
        AssetStatus.AVAILABLE,           # Triggered by completing maintenance and returning to storage
        AssetStatus.ASSIGNED,            # Triggered by completing maintenance and returning to original custodian
        AssetStatus.DISPOSED,            # Triggered if maintenance finds asset beyond economic repair - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating an asset under maintenance
    },
    AssetStatus.RETURNED: {
        AssetStatus.AVAILABLE,           # Triggered by custodian confirming return to storage - see S3-06
        AssetStatus.UNDER_MAINTENANCE,   # Triggered by custodian redirecting returned asset to repairs - see S3-06
        AssetStatus.DISPOSED,            # Triggered if returned asset is immediately retired/disposed - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating a returned asset
    },
    AssetStatus.DISPOSED: set(),         # Terminal state — no further transitions
    AssetStatus.DEACTIVATED: set(),      # Terminal state — no further transitions
}

def validate_status_transition(current_status: str | AssetStatus, new_status: str | AssetStatus) -> None:
    """Validate if transition between two asset statuses is permitted.
    Valid Transitions:
    - Available -> Reserved, Under Maintenance, Disposed, Deactivated, Assigned
    - Reserved -> Pending Acceptance, Available, Disposed, Deactivated
    - Pending Acceptance -> Pending Pickup, Available, Disposed, Deactivated
    - Pending Pickup -> Assigned, Available, Disposed, Deactivated
    - Assigned -> Under Transfer, Returned, Under Maintenance, Disposed, Deactivated, Available
    - Under Transfer -> Assigned, Available, Under Maintenance, Disposed, Deactivated
    - Under Maintenance -> Available, Assigned, Disposed, Deactivated
    - Returned -> Available, Under Maintenance, Disposed, Deactivated
    - Disposed -> Terminal (No transitions allowed)
    - Deactivated -> Terminal (No transitions allowed)
    Raises:
        HTTPException: HTTP 422 if transition is not permitted.
    """
    # Normalize inputs to raw strings
    curr_str = current_status.value if hasattr(current_status, "value") else str(current_status)
    new_str = new_status.value if hasattr(new_status, "value") else str(new_status)
    # Validate that statuses are known values
    try:
        curr_enum = AssetStatus(curr_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid current asset status: '{curr_str}'"
        )
    try:
        new_enum = AssetStatus(new_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid target asset status: '{new_str}'"
        )
    # Self transition (no-op) is always permitted
    if curr_enum == new_enum:
        return
    # Verify if transition exists in allowed transitions mapping
    allowed = VALID_TRANSITIONS.get(curr_enum, set())
    if new_enum not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid asset status transition from '{curr_str}' to '{new_str}'"
        )

_STATUS_MAP = {
    "Active": AssetStatus.ASSIGNED,
    "Available": AssetStatus.AVAILABLE,
    "In Store": AssetStatus.AVAILABLE,
    "In Storage": AssetStatus.AVAILABLE,
}


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
    Business rules:
        None beyond existence check.
    Audit log:
        Does not write to audit log.
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
    limit: int = 10000,
    offset: int = 0,
) -> Tuple[List[Asset], int]:
    """
    Return a filtered list of assets and total count.
    Parameters:
        db: Database session.
        status: Filter by status string (optional).
        asset_type: Filter by asset type string (optional).
        search: Filter by name or serial number substring (optional).
        department: Filter by department (optional).
        custodian_id: Filter by current custodian ID (optional).
        limit: Max records to return (default 100).
        offset: Records to skip for pagination (default 0).
    Returns:
        Tuple of (list of Asset objects, total matching count).
    Raises:
        HTTPException 400 for invalid status or asset_type values.
    Business rules:
        Available status filter is the sole visibility gate for
        'available to request' views — no separate flag needed.
    Audit log:
        Does not write to audit log.
    """
    from fastapi import HTTPException
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
        All database mutations wrapped in a single transaction.

    Audit log:
        Writes action=ASSET_REGISTRATION on success.
    """
    from fastapi import HTTPException

    if data.status not in _STATUS_MAP:
        raise HTTPException(400, detail=f"Invalid status '{data.status}'. Allowed: Active, Available, In Store.")
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
        HTTPException 422 if status transition is invalid via validate_status_transition().
        HTTPException 400 for invalid condition or status values.
    Business rules:
        Disposed and Deactivated assets cannot be updated — both are terminal.
        Status changes validated via validate_status_transition() imported from S3-03.
        Do not redefine transition rules here.
    Audit log:
        Writes action=ASSET_UPDATE on success.
    """
    asset = get_asset(db, asset_id)

    if asset.status in (AssetStatus.DISPOSED, AssetStatus.DEACTIVATED):
        raise HTTPException(400, detail=f"Cannot update asset in terminal status: {asset.status.value}")

    if data.status is not None:
        validate_status_transition(asset.status, data.status)

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
        CSV string with headers matching S3-11 bulk import column order.
    Raises:
        HTTPException 400 for invalid filter values via list_assets().
    Business rules:
        Applies same filter logic as list_assets().
    Audit log:
        Does not write to audit log.
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

