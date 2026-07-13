"""Disposal routes: create and list asset disposals."""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.asset import Asset, AssetStatus
from app.models.disposal_record import DisposalRecord, DisposalMethod
from app.models.assignment import Assignment, AssignmentStatus
from app.models.audit_log import AuditLog
from app.api.v1.auth import get_current_user, require_roles
from app.services.asset_service import validate_status_transition

router = APIRouter(prefix="/api/v1/disposals", tags=["disposals"])


# ── Response Schemas ────────────────────────────────────────────────────────────────

class DisposalResponse(BaseModel):
    """Response for disposal record."""
    disposal_id: int
    asset_id: str
    disposal_date: str
    disposal_method: str
    reason: str
    authorised_by: str
    authorised_by_name: str

    class Config:
        from_attributes = True


class DisposalListResponse(BaseModel):
    """Response for GET /disposals."""
    disposals: List[DisposalResponse]
    total: int


class DisposalCreateRequest(BaseModel):
    """Request body for POST /disposals."""
    asset_id: str
    disposal_method: str
    reason: str


@router.post("", response_model=DisposalResponse, status_code=status.HTTP_201_CREATED)
def create_disposal(
    body: DisposalCreateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("Asset Manager", "System Administrator")),
):
    """
    Create a disposal record for an asset.
    Atomically: creates record, sets asset status to Disposed, clears custodian.
    Requires: asset not Disposed, asset active, no active assignment.
    """
    # Validate disposal method
    try:
        disposal_method_enum = DisposalMethod(body.disposal_method)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid disposal method '{body.disposal_method}'. Allowed: Sale, Write-off, Donation, Destruction"
        )

    # Fetch asset
    asset = db.query(Asset).filter(Asset.asset_id == body.asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID {body.asset_id} not found"
        )

    # Check if already disposed or deactivated
    if asset.status in {AssetStatus.DISPOSED, AssetStatus.DEACTIVATED}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Asset is in terminal state ({asset.status.value}) and cannot be disposed"
        )

    # Check if asset is inactive
    if not asset.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot dispose an inactive asset"
        )

    # Check for active assignment
    active_assignment = db.query(Assignment).filter(
        Assignment.asset_id == body.asset_id,
        Assignment.status == AssignmentStatus.ACTIVE
    ).first()
    if active_assignment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot dispose asset with active assignment"
        )

    # Create disposal record
    disposal = DisposalRecord(
        asset_id=body.asset_id,
        disposal_date=date.today(),
        disposal_method=disposal_method_enum,
        reason=body.reason,
        authorised_by=str(current_user.user_id),
    )
    db.add(disposal)

    # Update asset status and clear custodian
    validate_status_transition(asset.status, AssetStatus.DISPOSED)
    asset.status = AssetStatus.DISPOSED
    asset.current_custodian_id = None

    # Audit log
    audit_entry = AuditLog(
        user_id=current_user.user_id,
        action="ASSET_DISPOSAL",
        table_affected="assets",
        record_id=body.asset_id,
        details=f"Asset {asset.asset_name} disposed via {body.disposal_method}",
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(disposal)

    return DisposalResponse(
        disposal_id=disposal.disposal_id,
        asset_id=disposal.asset_id,
        disposal_date=str(disposal.disposal_date),
        disposal_method=disposal.disposal_method.value if hasattr(disposal.disposal_method, "value") else str(disposal.disposal_method),
        reason=disposal.reason,
        authorised_by=str(disposal.authorised_by),
        authorised_by_name=current_user.full_name,
    )


@router.get("", response_model=DisposalListResponse)
def list_disposals(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """
    List all disposal records with pagination.
    Access: All authenticated roles.
    """
    from app.models.user import User

    query = db.query(DisposalRecord)
    total = query.count()
    disposals = query.order_by(DisposalRecord.disposal_date.desc()).offset(skip).limit(limit).all()

    disposal_responses = []
    for disposal in disposals:
        # Get authorised by user name
        authorised_user = db.query(User).filter(User.id == int(disposal.authorised_by)).first()
        authorised_name = authorised_user.full_name if authorised_user else "Unknown"

        disposal_responses.append(DisposalResponse(
            disposal_id=disposal.disposal_id,
            asset_id=disposal.asset_id,
            disposal_date=str(disposal.disposal_date),
            disposal_method=disposal.disposal_method.value if hasattr(disposal.disposal_method, "value") else str(disposal.disposal_method),
            reason=disposal.reason,
            authorised_by=str(disposal.authorised_by),
            authorised_by_name=authorised_name,
        ))

    return DisposalListResponse(
        disposals=disposal_responses,
        total=total,
    )
