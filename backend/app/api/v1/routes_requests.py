"""Asset request workflow endpoints."""

from datetime import datetime, date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.v1.auth import get_current_user, require_roles
from app.models.asset import Asset, AssetStatus
from app.models.assignment import Assignment, AssignmentStatus
from app.models.audit_log import AuditLog
from app.models.asset_request import AssetRequest, RequestPriority, RequestStatus
from app.models.user import User, UserRole

router = APIRouter(prefix="/api/v1/requests", tags=["requests"])


class AssetRequestCreate(BaseModel):
    asset_id: Optional[str] = None
    asset_type: Optional[str] = None
    reason: str
    priority: Optional[str] = None
    required_by_date: Optional[date] = None


class AssetRequestApprove(BaseModel):
    assigned_asset_id: Optional[str] = None


class AssetRequestReject(BaseModel):
    notes: str


class AssetRequestAssign(BaseModel):
    asset_id: Optional[str] = None
    custodian_id: Optional[int] = None


class AssetRequestResponse(BaseModel):
    request_id: int
    asset_id: Optional[str] = None
    asset_type: Optional[str] = None
    requested_by: Optional[int] = None
    reviewed_by: Optional[int] = None
    assigned_to: Optional[int] = None
    status: str
    priority: str
    reason: str
    notes: Optional[str] = None
    requested_date: date
    required_by_date: Optional[date] = None
    reviewed_at: Optional[datetime] = None
    assigned_at: Optional[datetime] = None
    pickup_confirmed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AssetRequestListResponse(BaseModel):
    requests: List[AssetRequestResponse]
    total: int


def _serialize_request(request: AssetRequest) -> AssetRequestResponse:
    return AssetRequestResponse(
        request_id=request.request_id,
        asset_id=request.asset_id,
        asset_type=request.asset_type.value if hasattr(request.asset_type, "value") else request.asset_type,
        requested_by=request.requested_by,
        reviewed_by=request.reviewed_by,
        assigned_to=request.assigned_to,
        status=request.status.value if hasattr(request.status, "value") else str(request.status),
        priority=request.priority.value if hasattr(request.priority, "value") else str(request.priority),
        reason=request.reason,
        notes=request.notes,
        requested_date=request.requested_date,
        required_by_date=request.required_by_date,
        reviewed_at=request.reviewed_at,
        assigned_at=request.assigned_at,
        pickup_confirmed_at=request.pickup_confirmed_at,
        created_at=request.created_at,
        updated_at=request.updated_at,
    )


def _log(db: Session, *, actor: User, action: str, record_id: str, details: str) -> None:
    db.add(
        AuditLog(
            user_id=actor.user_id,
            action=action,
            table_affected="asset_requests",
            record_id=str(record_id),
            details=details,
        )
    )


def _can_transition(current: RequestStatus, target: RequestStatus) -> bool:
    allowed = {
        RequestStatus.PENDING: {RequestStatus.APPROVED, RequestStatus.REJECTED, RequestStatus.CANCELLED},
        RequestStatus.APPROVED: {RequestStatus.ASSIGNED, RequestStatus.CANCELLED},
        RequestStatus.ASSIGNED: {RequestStatus.PICKED_UP},
        RequestStatus.PICKED_UP: {RequestStatus.COMPLETED},
    }
    return target in allowed.get(current, set())


@router.post("", response_model=AssetRequestResponse, status_code=status.HTTP_201_CREATED)
def create_request(
    body: AssetRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.asset_id and not body.asset_type:
        raise HTTPException(400, detail="Provide either a specific asset ID or an asset type")

    if body.asset_id:
        asset = db.query(Asset).filter(Asset.asset_id == body.asset_id).first()
        if not asset:
            raise HTTPException(404, detail="Asset not found")
        if asset.status != AssetStatus.ACTIVE:
            raise HTTPException(400, detail=f"Only Active assets can be requested. Current: {asset.status.value}")
        if not getattr(asset, "is_active", True):
            raise HTTPException(400, detail="Asset is inactive")
        existing = (
            db.query(AssetRequest)
            .filter(
                AssetRequest.asset_id == body.asset_id,
                AssetRequest.status.in_([RequestStatus.PENDING, RequestStatus.APPROVED]),
            )
            .first()
        )
        if existing:
            raise HTTPException(400, detail="Asset already has a pending or approved request")

    priority = RequestPriority(body.priority) if body.priority else RequestPriority.NORMAL
    asset_type = None
    if body.asset_type:
        asset_type = body.asset_type

    request = AssetRequest(
        asset_id=body.asset_id,
        asset_type=asset_type,
        requested_by=current_user.id,
        status=RequestStatus.PENDING,
        priority=priority,
        reason=body.reason,
        required_by_date=body.required_by_date,
    )
    db.add(request)
    db.flush()
    _log(db, actor=current_user, action="SUBMIT_REQUEST", record_id=str(request.request_id), details="Submitted asset request")
    # S3-08: Notify Asset Managers of New Request
    from app.services.notification_service import create_notification
    create_notification(
        db=db,
        user_id="Asset Manager",
        title="New Asset Request Submitted",
        message=f"A new asset request has been submitted by user {current_user.email} (Request ID: {request.request_id}).",
        notification_type="REQUEST_SUBMITTED",
        related_asset_id=request.asset_id,
    )
    db.commit()
    db.refresh(request)
    return _serialize_request(request)


@router.get("", response_model=AssetRequestListResponse)
def list_requests(
    status: Optional[str] = None,
    requested_by: Optional[int] = None,
    asset_id: Optional[str] = None,
    asset_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(AssetRequest)
    if status:
        try:
            query = query.filter(AssetRequest.status == RequestStatus(status))
        except ValueError:
            raise HTTPException(400, detail="Invalid status")
    if requested_by is not None:
        query = query.filter(AssetRequest.requested_by == requested_by)
    if asset_id:
        query = query.filter(AssetRequest.asset_id == asset_id)
    if asset_type:
        query = query.filter(AssetRequest.asset_type == asset_type)

    if current_user.role == UserRole.EMPLOYEE:
        query = query.filter(AssetRequest.requested_by == current_user.id)
    elif current_user.role == UserRole.ASSET_CUSTODIAN:
        query = query.filter(AssetRequest.assigned_to == current_user.id)

    requests = query.order_by(AssetRequest.created_at.desc()).all()
    return AssetRequestListResponse(requests=[_serialize_request(r) for r in requests], total=len(requests))


@router.get("/{request_id}", response_model=AssetRequestResponse)
def get_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = db.query(AssetRequest).filter(AssetRequest.request_id == request_id).first()
    if not request:
        raise HTTPException(404, detail="Request not found")

    if current_user.role in {UserRole.SYSTEM_ADMINISTRATOR, UserRole.ASSET_MANAGER}:
        return _serialize_request(request)
    if current_user.role == UserRole.ASSET_CUSTODIAN and request.assigned_to == current_user.id:
        return _serialize_request(request)
    if request.requested_by != current_user.id:
        raise HTTPException(403, detail="Not authorized to view this request")
    return _serialize_request(request)


@router.put("/{request_id}/approve", response_model=AssetRequestResponse)
def approve_request(
    request_id: int,
    body: AssetRequestApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator", "Asset Manager")),
):
    request = db.query(AssetRequest).filter(AssetRequest.request_id == request_id).first()
    if not request:
        raise HTTPException(404, detail="Request not found")
    if request.status != RequestStatus.PENDING:
        raise HTTPException(400, detail="Invalid status transition")

    if request.asset_id:
        asset = db.query(Asset).filter(Asset.asset_id == request.asset_id).first()
        if not asset:
            raise HTTPException(404, detail="Asset not found")
        if asset.status != AssetStatus.ACTIVE or not getattr(asset, "is_active", True):
            raise HTTPException(400, detail="Asset is no longer available")
    elif body.assigned_asset_id:
        asset = db.query(Asset).filter(Asset.asset_id == body.assigned_asset_id).first()
        if not asset:
            raise HTTPException(404, detail="Asset not found")
        if asset.status != AssetStatus.ACTIVE or not getattr(asset, "is_active", True):
            raise HTTPException(400, detail="Asset is no longer available")
        request.asset_id = asset.asset_id

    request.status = RequestStatus.APPROVED
    request.reviewed_by = current_user.id
    request.reviewed_at = datetime.utcnow()
    _log(db, actor=current_user, action="APPROVE_REQUEST", record_id=str(request.request_id), details="Approved asset request")
    # S3-08: Notify Employee of Request Approval
    from app.services.notification_service import create_notification
    create_notification(
        db=db,
        user_id=str(request.requested_by),
        title="Asset Request Approved",
        message=f"Your request for asset/type '{request.asset_type or request.asset_id}' has been approved.",
        notification_type="REQUEST_APPROVED",
        related_asset_id=request.asset_id,
    )
    db.commit()
    db.refresh(request)
    return _serialize_request(request)


@router.put("/{request_id}/reject", response_model=AssetRequestResponse)
def reject_request(
    request_id: int,
    body: AssetRequestReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator", "Asset Manager")),
):
    request = db.query(AssetRequest).filter(AssetRequest.request_id == request_id).first()
    if not request:
        raise HTTPException(404, detail="Request not found")
    if request.status != RequestStatus.PENDING:
        raise HTTPException(400, detail="Invalid status transition")
    if not body.notes or not body.notes.strip():
        raise HTTPException(400, detail="Notes are required")

    request.status = RequestStatus.REJECTED
    request.notes = body.notes
    request.reviewed_by = current_user.id
    request.reviewed_at = datetime.utcnow()
    _log(db, actor=current_user, action="REJECT_REQUEST", record_id=str(request.request_id), details="Rejected asset request")
    db.commit()
    db.refresh(request)
    return _serialize_request(request)


@router.put("/{request_id}/assign", response_model=AssetRequestResponse)
def assign_request(
    request_id: int,
    body: AssetRequestAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator", "Asset Manager")),
):
    request = db.query(AssetRequest).filter(AssetRequest.request_id == request_id).first()
    if not request:
        raise HTTPException(404, detail="Request not found")
    if request.status != RequestStatus.APPROVED:
        raise HTTPException(400, detail="Invalid status transition")

    asset_id = body.asset_id or request.asset_id
    if not asset_id:
        raise HTTPException(400, detail="Asset ID is required")

    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(404, detail="Asset not found")
    if asset.status != AssetStatus.ACTIVE or not getattr(asset, "is_active", True):
        raise HTTPException(400, detail="Asset is not available for assignment")

    existing_assignment = (
        db.query(Assignment)
        .filter(Assignment.asset_id == asset.asset_id, Assignment.status == AssignmentStatus.ACTIVE)
        .first()
    )
    if existing_assignment:
        raise HTTPException(400, detail="Asset already assigned. Return first.")

    custodian_id = body.custodian_id or current_user.id
    custodian = db.query(User).filter(User.id == custodian_id).first()
    if not custodian or not custodian.is_active:
        raise HTTPException(400, detail="Assigned custodian is invalid")

    request.status = RequestStatus.ASSIGNED
    request.assigned_to = custodian_id
    request.assigned_at = datetime.utcnow()
    db.add(
        Assignment(
            asset_id=asset.asset_id,
            assigned_to=str(custodian_id),
            assigned_by=str(current_user.id),
            assignment_date=date.today(),
            status=AssignmentStatus.ACTIVE,
            notes="Assigned from asset request",
        )
    )
    asset.current_custodian_id = str(custodian_id)
    _log(db, actor=current_user, action="ASSIGN_FROM_REQUEST", record_id=str(request.request_id), details="Assigned request to asset")
    db.commit()
    db.refresh(request)
    return _serialize_request(request)


@router.put("/{request_id}/pickup", response_model=AssetRequestResponse)
def pickup_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = db.query(AssetRequest).filter(AssetRequest.request_id == request_id).first()
    if not request:
        raise HTTPException(404, detail="Request not found")
    if request.requested_by != current_user.id:
        raise HTTPException(403, detail="Not authorized")
    if request.status != RequestStatus.ASSIGNED:
        raise HTTPException(400, detail="Invalid status transition")

    request.status = RequestStatus.PICKED_UP
    request.pickup_confirmed_at = datetime.utcnow()
    _log(db, actor=current_user, action="PICKUP_CONFIRMED", record_id=str(request.request_id), details="Pickup confirmed")
    db.commit()
    db.refresh(request)
    return _serialize_request(request)


@router.put("/{request_id}/complete", response_model=AssetRequestResponse)
def complete_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator", "Asset Manager")),
):
    request = db.query(AssetRequest).filter(AssetRequest.request_id == request_id).first()
    if not request:
        raise HTTPException(404, detail="Request not found")
    if request.status != RequestStatus.PICKED_UP:
        raise HTTPException(400, detail="Invalid status transition")

    request.status = RequestStatus.COMPLETED
    _log(db, actor=current_user, action="COMPLETE_REQUEST", record_id=str(request.request_id), details="Completed asset request")
    db.commit()
    db.refresh(request)
    return _serialize_request(request)


@router.put("/{request_id}/cancel", response_model=AssetRequestResponse)
def cancel_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = db.query(AssetRequest).filter(AssetRequest.request_id == request_id).first()
    if not request:
        raise HTTPException(404, detail="Request not found")
    if request.status not in {RequestStatus.PENDING, RequestStatus.APPROVED}:
        raise HTTPException(400, detail="Invalid status transition")

    if current_user.role in {UserRole.SYSTEM_ADMINISTRATOR, UserRole.ASSET_MANAGER}:
        allowed = True
    elif current_user.role == UserRole.EMPLOYEE and request.status == RequestStatus.PENDING and request.requested_by == current_user.id:
        allowed = True
    else:
        allowed = False

    if not allowed:
        raise HTTPException(403, detail="Not authorized")

    request.status = RequestStatus.CANCELLED
    _log(db, actor=current_user, action="CANCEL_REQUEST", record_id=str(request.request_id), details="Cancelled asset request")
    db.commit()
    db.refresh(request)
    return _serialize_request(request)


__all__ = ["router", "AssetRequest", "RequestPriority", "RequestStatus"]
