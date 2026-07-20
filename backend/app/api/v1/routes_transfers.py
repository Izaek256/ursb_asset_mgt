"""Transfer routes: create, list, and acknowledge transfers.

Access Control Rules:
- POST /api/transfers — Asset Manager, Super System Administrator
- GET /api/transfers — Asset Manager, Super System Administrator, System Administrator (read-only)
- PUT /api/transfers/{transfer_id}/acknowledge — Receiving user or System Administrator
"""

from typing import List, Optional

from datetime import datetime, date, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, constr
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.transfer import Transfer
from app.models.asset import Asset, AssetStatus
from app.models.assignment import Assignment, AssignmentStatus
from app.models.user import User
from app.models.audit_log import AuditLog
from app.api.v1.auth import get_current_user, require_role, require_roles
from app.models.user import UserRole
from app.services.asset_service import validate_status_transition

router = APIRouter(prefix="/api/v1/transfers", tags=["transfers"])


class TransferResponse(BaseModel):
    transfer_id: int
    asset_id: str
    asset_name: Optional[str]
    asset_serial: Optional[str]
    from_user_id: str
    to_user_id: str
    from_user_name: Optional[str]
    to_user_name: Optional[str]
    authorised_by: str
    authorised_by_name: Optional[str]
    transfer_date: str
    reason: str
    acknowledged_at: Optional[datetime]

    class Config:
        from_attributes = True


class TransferCreateRequest(BaseModel):
    asset_id: constr(strip_whitespace=True)
    to_user_id: int
    transfer_date: date
    reason: constr(strip_whitespace=True, min_length=1)


@router.get("", response_model=List[TransferResponse])
def list_transfers(
    asset_id: Optional[str] = None,
    user_id: Optional[int] = None,
    acknowledged: Optional[bool] = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR, UserRole.SYSTEM_ADMINISTRATOR)),
):
    """List transfers with optional filters. Returns resolved user names and asset info."""
    q = db.query(Transfer)
    if asset_id:
        q = q.filter(Transfer.asset_id == asset_id)
    if user_id:
        q = q.filter((Transfer.from_user_id == user_id) | (Transfer.to_user_id == user_id))
    if acknowledged is not None:
        if acknowledged:
            q = q.filter(Transfer.acknowledged_at.isnot(None))
        else:
            q = q.filter(Transfer.acknowledged_at.is_(None))
    transfers = q.order_by(Transfer.transfer_date.desc()).all()

    results: List[TransferResponse] = []
    for t in transfers:
        asset = db.query(Asset).filter(Asset.asset_id == t.asset_id).first()
        from_u = db.query(User).filter(User.user_id == t.from_user_id).first()
        to_u = db.query(User).filter(User.user_id == t.to_user_id).first()
        auth_u = db.query(User).filter(User.user_id == t.authorised_by).first()

        results.append(
            TransferResponse(
                transfer_id=t.transfer_id,
                asset_id=t.asset_id,
                asset_name=asset.asset_name if asset else None,
                asset_serial=asset.serial_number if asset else None,
                from_user_id=t.from_user_id,
                to_user_id=t.to_user_id,
                from_user_name=from_u.full_name if from_u else None,
                to_user_name=to_u.full_name if to_u else None,
                authorised_by=t.authorised_by,
                authorised_by_name=auth_u.full_name if auth_u else None,
                transfer_date=str(t.transfer_date),
                reason=t.reason,
                acknowledged_at=t.acknowledged_at,
            )
        )
    return results


@router.post("", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
def create_transfer(
    body: TransferCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR)),
):
    """Create a transfer and perform all related state changes atomically."""
    asset = db.query(Asset).filter(Asset.asset_id == body.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Asset must be in Assigned status
    if asset.status != AssetStatus.ASSIGNED:
        raise HTTPException(status_code=400, detail=f"Only Assigned assets can be transferred. Current: {asset.status}")

    # Some deployments may add an `is_active` flag to assets; respect it when present
    if not getattr(asset, "is_active", True):
        raise HTTPException(status_code=400, detail="Asset is inactive and cannot be transferred")

    # Asset must have a current custodian. The `from_user_id` is derived from asset.current_custodian_id — never from the request body.
    if not asset.current_custodian_id:
        raise HTTPException(status_code=400, detail="Asset has no current custodian. Assign the asset first.")
    from_user_id = asset.current_custodian_id

    # Validate target user exists and is active
    to_user = db.query(User).filter(User.user_id == body.to_user_id).first()
    if not to_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    if not to_user.is_active:
        raise HTTPException(status_code=400, detail="Cannot transfer to an inactive user")

    if str(body.to_user_id) == str(from_user_id):
        raise HTTPException(status_code=400, detail="Cannot transfer to the current custodian")
    
    # Prevent self-transfer for accountability
    if str(body.to_user_id) == str(current_user.user_id):
        raise HTTPException(status_code=403, detail="Cannot transfer assets to yourself for accountability reasons. Use assignment workflow instead.")

    # Guard: Do not transfer if there is a pending request for this asset. This prevents orphaning that request.
    pending_exists = False
    try:
        from app.models.asset_request import AssetRequest, RequestStatus  # type: ignore
        pending = db.query(AssetRequest).filter(
            AssetRequest.asset_id == asset.asset_id,
            AssetRequest.status == RequestStatus.PENDING
        ).first()
        pending_exists = pending is not None
    except Exception:
        pending_exists = False

    if pending_exists:
        raise HTTPException(status_code=400, detail="Asset has a pending request. Resolve the request before transferring.")

    # Perform changes
    transfer = Transfer(
        asset_id=asset.asset_id,
        from_user_id=from_user_id,
        to_user_id=body.to_user_id,
        transfer_date=body.transfer_date,
        reason=body.reason,
        authorised_by=current_user.user_id,
        acknowledged_at=None,
    )

    # Close existing active assignment
    active_assignment = (
        db.query(Assignment)
        .filter(Assignment.asset_id == asset.asset_id, Assignment.status == AssignmentStatus.ACTIVE)
        .order_by(Assignment.assignment_date.desc())
        .first()
    )
    if active_assignment:
        active_assignment.status = AssignmentStatus.RETURNED
        active_assignment.return_date = body.transfer_date

    # Create new assignment
    new_assignment = Assignment(
        asset_id=asset.asset_id,
        assigned_to=body.to_user_id,
        assigned_by=current_user.user_id,
        assignment_date=body.transfer_date,
        status=AssignmentStatus.ACTIVE,
    )

    # Update asset custodian and transition status to Under Transfer
    validate_status_transition(asset.status, AssetStatus.UNDER_TRANSFER)
    asset.status = AssetStatus.UNDER_TRANSFER
    asset.current_custodian_id = body.to_user_id
    asset.updated_at = datetime.now(timezone.utc)

    # All four state changes committed atomically to prevent partial custody transfer
    db.add(transfer)
    if active_assignment:
        db.add(active_assignment)
    db.add(new_assignment)
    db.add(asset)
    db.commit()

    # Write audit log with workflow step
    audit = AuditLog(
        user_id=current_user.user_id,
        action="TRANSFER_ASSET",
        table_affected="transfers",
        record_id=str(transfer.transfer_id),
        details=f"[TRANSFER_INITIATION] Asset {asset.asset_id} transferred from user {from_user_id} to user {body.to_user_id}. Reason: {body.reason}",
    )
    db.add(audit)
    db.commit()

    # Return response
    return TransferResponse(
        transfer_id=transfer.transfer_id,
        asset_id=transfer.asset_id,
        asset_name=asset.asset_name,
        asset_serial=asset.serial_number,
        from_user_id=transfer.from_user_id,
        to_user_id=transfer.to_user_id,
        from_user_name=(db.query(User).filter(User.user_id == transfer.from_user_id).first().full_name if db.query(User).filter(User.user_id == transfer.from_user_id).first() else None),
        to_user_name=(to_user.full_name if to_user else None),
        authorised_by=transfer.authorised_by,
        authorised_by_name=(db.query(User).filter(User.user_id == transfer.authorised_by).first().full_name if db.query(User).filter(User.user_id == transfer.authorised_by).first() else None),
        transfer_date=str(transfer.transfer_date),
        reason=transfer.reason,
        acknowledged_at=transfer.acknowledged_at,
    )


@router.put("/{transfer_id}/acknowledge", response_model=TransferResponse)
def acknowledge_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Acknowledge a transfer. Access: receiving user or System Administrator."""
    transfer = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    if transfer.acknowledged_at is not None:
        raise HTTPException(status_code=400, detail="Transfer has already been acknowledged")

    # Dual-access rule: receiver OR System Administrator may acknowledge
    if str(transfer.to_user_id) != str(current_user.user_id) and current_user.role != getattr(current_user.role.__class__, "SYSTEM_ADMINISTRATOR", current_user.role):
        # If current_user is not receiver or System Administrator, deny
        raise HTTPException(status_code=403, detail="Only the receiving user or a System Administrator can acknowledge this transfer")

    transfer.acknowledged_at = datetime.now(timezone.utc)
    db.add(transfer)
    db.commit()
    
    # Notify sender that transfer was acknowledged
    from app.services.notification_service import create_notification
    asset = db.query(Asset).filter(Asset.asset_id == transfer.asset_id).first()
    if asset:
        create_notification(
            db=db,
            user_id=str(transfer.from_user_id),
            title="Transfer Acknowledged",
            message=f"Transfer of asset '{asset.asset_name}' to {transfer.to_user_id} has been acknowledged.",
            notification_type="TRANSFER_ACKNOWLEDGED",
            related_asset_id=asset.asset_id,
        )

    # Transition asset status from Under Transfer to Assigned upon acknowledgment
    asset = db.query(Asset).filter(Asset.asset_id == transfer.asset_id).first()
    if asset:
        validate_status_transition(asset.status, AssetStatus.ASSIGNED)
        asset.status = AssetStatus.ASSIGNED
        db.add(asset)
        db.commit()

    # Audit with workflow step
    audit = AuditLog(
        user_id=current_user.user_id,
        action="ACKNOWLEDGE_TRANSFER",
        table_affected="transfers",
        record_id=str(transfer.transfer_id),
        details=f"[TRANSFER_ACKNOWLEDGMENT] Transfer {transfer.transfer_id} acknowledged by user {current_user.user_id}",
    )
    db.add(audit)
    db.commit()

    asset = db.query(Asset).filter(Asset.asset_id == transfer.asset_id).first()
    auth_u = db.query(User).filter(User.user_id == transfer.authorised_by).first()

    return TransferResponse(
        transfer_id=transfer.transfer_id,
        asset_id=transfer.asset_id,
        asset_name=asset.asset_name if asset else None,
        asset_serial=asset.serial_number if asset else None,
        from_user_id=transfer.from_user_id,
        to_user_id=transfer.to_user_id,
        from_user_name=(db.query(User).filter(User.user_id == transfer.from_user_id).first().full_name if db.query(User).filter(User.user_id == transfer.from_user_id).first() else None),
        to_user_name=(db.query(User).filter(User.user_id == transfer.to_user_id).first().full_name if db.query(User).filter(User.user_id == transfer.to_user_id).first() else None),
        authorised_by=transfer.authorised_by,
        authorised_by_name=auth_u.full_name if auth_u else None,
        transfer_date=str(transfer.transfer_date),
        reason=transfer.reason,
        acknowledged_at=transfer.acknowledged_at,
    )
