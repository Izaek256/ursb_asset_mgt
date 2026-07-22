"""Asset request workflow endpoints.

Access Control Rules:
- POST /api/requests — Employee, Asset Manager (Asset Managers may submit requests)
- GET /api/requests — All authenticated roles (filtered by role)
- GET /api/requests/{request_id} — All authenticated roles (filtered by role)
- PUT /api/requests/{id}/approve — Asset Manager, Super System Administrator (with self-approval guard)
- PUT /api/requests/{id}/reject — Asset Manager, Super System Administrator (with self-approval guard)
- PUT /api/requests/{id}/assign — Asset Manager, Super System Administrator
- PUT /api/requests/{id}/pickup — All authenticated roles (requester only)
- PUT /api/requests/{id}/complete — Asset Manager, Super System Administrator
- PUT /api/requests/{id}/cancel — Employee (own pending requests), Asset Manager, Super System Administrator
"""

from datetime import datetime, date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.v1.auth import get_current_user, require_role, require_not_self_approval
from app.models.user import UserRole
from app.models.asset import Asset, AssetStatus
from app.models.assignment import Assignment, AssignmentStatus
from app.models.audit_log import AuditLog
from app.models.asset_request import AssetRequest, RequestPriority, RequestStatus
from app.models.user import User, UserRole
from app.services.asset_service import validate_status_transition

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
    asset_name: Optional[str] = None
    requested_by: Optional[int] = None
    requested_by_name: Optional[str] = None
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
    handed_over_at: Optional[datetime] = None
    pickup_confirmed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AssetRequestListResponse(BaseModel):
    requests: List[AssetRequestResponse]
    total: int


def _serialize_request(request: AssetRequest) -> AssetRequestResponse:
    # Get requester name from relationship
    requested_by_name = None
    if request.requester:
        if hasattr(request.requester, 'full_name') and request.requester.full_name:
            requested_by_name = request.requester.full_name
        elif hasattr(request.requester, 'first_name') and hasattr(request.requester, 'last_name'):
            requested_by_name = f"{request.requester.first_name} {request.requester.last_name}".strip()
        elif hasattr(request.requester, 'username'):
            requested_by_name = request.requester.username
    
    # Get asset name from relationship
    asset_name = None
    if request.asset:
        asset_name = request.asset.asset_name
    
    return AssetRequestResponse(
        request_id=request.request_id,
        asset_id=request.asset_id,
        asset_type=request.asset_type.value if hasattr(request.asset_type, "value") else request.asset_type,
        asset_name=asset_name,
        requested_by=request.requested_by,
        requested_by_name=requested_by_name,
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
        handed_over_at=request.handed_over_at,
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
        RequestStatus.ASSIGNED: {RequestStatus.READY_FOR_PICKUP},
        RequestStatus.READY_FOR_PICKUP: {RequestStatus.PICKED_UP},
        RequestStatus.PICKED_UP: {RequestStatus.COMPLETED},
    }
    return target in allowed.get(current, set())


@router.post("", response_model=AssetRequestResponse, status_code=status.HTTP_201_CREATED)
def create_request(
    body: AssetRequestCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.asset_id and not body.asset_type:
        raise HTTPException(400, detail="Provide either a specific asset ID or an asset type")

    if body.asset_id:
        asset = db.query(Asset).filter(Asset.asset_id == body.asset_id).first()
        if not asset:
            raise HTTPException(404, detail="Asset not found")
        if asset.status != AssetStatus.AVAILABLE:
            raise HTTPException(400, detail=f"Only Available assets can be requested. Current status: {asset.status.value}")
        if not getattr(asset, "is_active", True):
            raise HTTPException(400, detail="Asset is inactive")
        if asset.condition.value == "Damaged":
            raise HTTPException(400, detail="Cannot request a damaged asset")
        if asset.status == AssetStatus.UNDER_MAINTENANCE:
            raise HTTPException(400, detail="Cannot request an asset under maintenance")
        if asset.current_custodian_id is not None:
            raise HTTPException(400, detail="Asset is already assigned to a custodian")
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
    db.commit()
    db.refresh(request)
    # S3-08: Notify Asset Managers of New Request
    from app.services.notification_service import create_notification
    background_tasks.add_task(
        create_notification,
        user_id="Asset Manager",
        title="New Asset Request Submitted",
        message=f"A new asset request has been submitted by user {current_user.email} (Request ID: {request.request_id}).",
        notification_type="REQUEST_SUBMITTED",
        related_asset_id=request.asset_id,
    )
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
    from sqlalchemy.orm import joinedload
    from sqlalchemy import exists, or_
    query = db.query(AssetRequest).options(
        joinedload(AssetRequest.requester),
        joinedload(AssetRequest.asset)
    )

    # Exclude requests where a specific asset was assigned but that asset has since been deleted
    query = query.filter(
        or_(
            AssetRequest.asset_id == None,  # type-based requests with no asset yet
            exists().where(Asset.asset_id == AssetRequest.asset_id)  # asset still exists
        )
    )

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
    from sqlalchemy.orm import joinedload
    request = db.query(AssetRequest).options(
        joinedload(AssetRequest.requester),
        joinedload(AssetRequest.asset)
    ).filter(AssetRequest.request_id == request_id).first()
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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR, UserRole.SYSTEM_ADMINISTRATOR)),
    _guard: None = Depends(require_not_self_approval),
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
        if asset.status != AssetStatus.AVAILABLE or not getattr(asset, "is_active", True):
            raise HTTPException(400, detail="Asset is no longer available")
    elif body.assigned_asset_id:
        asset = db.query(Asset).filter(Asset.asset_id == body.assigned_asset_id).first()
        if not asset:
            raise HTTPException(404, detail="Asset not found")
        if asset.status != AssetStatus.AVAILABLE or not getattr(asset, "is_active", True):
            raise HTTPException(400, detail="Asset is no longer available")
        request.asset_id = asset.asset_id

    request.status = RequestStatus.APPROVED
    request.reviewed_by = current_user.id
    request.reviewed_at = datetime.utcnow()
    _log(db, actor=current_user, action="APPROVE_REQUEST", record_id=str(request.request_id), details="Approved asset request")
    db.commit()
    db.refresh(request)
    # S3-08: Notify Employee of Request Approval
    from app.services.notification_service import create_notification
    background_tasks.add_task(
        create_notification,
        user_id=str(request.requested_by),
        title="Asset Request Approved",
        message=f"Your request for asset/type '{request.asset_type or request.asset_id}' has been approved.",
        notification_type="REQUEST_APPROVED",
        related_asset_id=request.asset_id,
    )
    return _serialize_request(request)


@router.put("/{request_id}/reject", response_model=AssetRequestResponse)
def reject_request(
    request_id: int,
    body: AssetRequestReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR, UserRole.SYSTEM_ADMINISTRATOR)),
    _guard: None = Depends(require_not_self_approval),
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
    
    # If asset was assigned, return it to AVAILABLE
    if request.asset_id:
        asset = db.query(Asset).filter(Asset.asset_id == request.asset_id).first()
        if asset and asset.status in {AssetStatus.ASSIGNED, AssetStatus.PENDING_APPROVAL, AssetStatus.PENDING_PICKUP}:
            validate_status_transition(asset.status, AssetStatus.AVAILABLE)
            asset.status = AssetStatus.AVAILABLE
            asset.current_custodian_id = None
    
    _log(db, actor=current_user, action="REJECT_REQUEST", record_id=str(request.request_id), details="Rejected asset request")
    db.commit()
    db.refresh(request)
    return _serialize_request(request)


@router.put("/{request_id}/assign", response_model=AssetRequestResponse)
def assign_request(
    request_id: int,
    body: AssetRequestAssign,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR, UserRole.SYSTEM_ADMINISTRATOR)),
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
    if asset.status != AssetStatus.AVAILABLE or not getattr(asset, "is_active", True):
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

    # New workflow: assign to final recipient first with custodian info
    final_recipient_id = request.requested_by
    
    request.status = RequestStatus.ASSIGNED
    request.assigned_to = custodian_id
    request.assigned_at = datetime.utcnow()
    
    # Create assignment to final recipient with custodian info in notes
    assignment = Assignment(
        asset_id=asset.asset_id,
        assigned_to=str(final_recipient_id),
        assigned_by=str(current_user.id),
        assignment_date=date.today(),
        status=AssignmentStatus.PENDING_ACCEPTANCE,
        notes=f"Assigned from asset request [Custodian: {custodian_id}:{custodian.email}]",
    )
    db.add(assignment)
    
    validate_status_transition(asset.status, AssetStatus.PENDING_ACCEPTANCE)
    asset.status = AssetStatus.PENDING_ACCEPTANCE
    asset.current_custodian_id = str(custodian_id)
    _log(db, actor=current_user, action="ASSIGN_FROM_REQUEST", record_id=str(request.request_id), details=f"Assigned request to asset for final recipient {final_recipient_id} with custodian {custodian_id}")
    
    db.commit()
    db.refresh(request)
    # Notify final recipient of assignment
    from app.services.notification_service import create_notification
    background_tasks.add_task(
        create_notification,
        user_id=str(final_recipient_id),
        title="New Asset Assignment",
        message=f"You have been assigned asset {asset.asset_name} ({asset.asset_id}). Please accept or decline this assignment.",
        notification_type="ASSIGNMENT_SENT",
        related_asset_id=asset.asset_id,
    )
    return _serialize_request(request)


@router.put("/{request_id}/custodian-cancel", response_model=AssetRequestResponse)
def custodian_cancel_request(
    request_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Custodian cancels an assigned request - returns asset to AVAILABLE"""
    request = db.query(AssetRequest).filter(AssetRequest.request_id == request_id).first()
    if not request:
        raise HTTPException(404, detail="Request not found")
    if request.assigned_to != current_user.id:
        raise HTTPException(403, detail="Only the assigned custodian can cancel this request")
    if request.status != RequestStatus.ASSIGNED:
        raise HTTPException(400, detail="Request must be in Assigned status for custodian cancellation")

    request.status = RequestStatus.CANCELLED
    
    # Return asset to AVAILABLE and clear custodian
    if request.asset_id:
        asset = db.query(Asset).filter(Asset.asset_id == request.asset_id).first()
        if asset and asset.status in {AssetStatus.ASSIGNED, AssetStatus.PENDING_APPROVAL}:
            validate_status_transition(asset.status, AssetStatus.AVAILABLE)
            asset.status = AssetStatus.AVAILABLE
            asset.current_custodian_id = None
            
            # Close the active assignment
            from app.models.assignment import Assignment, AssignmentStatus
            existing_assignment = db.query(Assignment).filter(
                Assignment.asset_id == asset.asset_id,
                Assignment.status == AssignmentStatus.ACTIVE
            ).first()
            if existing_assignment:
                existing_assignment.status = AssignmentStatus.RETURNED
                existing_assignment.return_date = date.today()
    
    _log(db, actor=current_user, action="CUSTODIAN_CANCEL", record_id=str(request.request_id), details="Custodian cancelled assigned request")
    db.commit()
    db.refresh(request)
    # Notify requester that their request was cancelled by custodian
    from app.services.notification_service import create_notification
    asset_name = request.asset.asset_name if request.asset else request.asset_type
    background_tasks.add_task(
        create_notification,
        user_id=str(request.requested_by),
        title="Request Cancelled by Custodian",
        message=f"Your asset request for {asset_name} has been cancelled by the custodian.",
        notification_type="REQUEST_CANCELLED",
        related_asset_id=request.asset_id,
    )
    return _serialize_request(request)


@router.put("/{request_id}/handover", response_model=AssetRequestResponse)
def handover_request(
    request_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Custodian hands over asset to requester - changes status to READY_FOR_PICKUP and asset status to PENDING_PICKUP"""
    request = db.query(AssetRequest).filter(AssetRequest.request_id == request_id).first()
    if not request:
        raise HTTPException(404, detail="Request not found")
    if request.assigned_to != current_user.id:
        raise HTTPException(403, detail="Only the assigned custodian can hand over the asset")
    if request.status != RequestStatus.ASSIGNED:
        raise HTTPException(400, detail="Request must be in Assigned status for handover")

    request.status = RequestStatus.READY_FOR_PICKUP
    request.handed_over_at = datetime.utcnow()
    
    # Update asset status from PENDING_APPROVAL to PENDING_PICKUP to show it's awaiting pickup
    if request.asset_id:
        asset = db.query(Asset).filter(Asset.asset_id == request.asset_id).first()
        if asset:
            validate_status_transition(asset.status, AssetStatus.PENDING_PICKUP)
            asset.status = AssetStatus.PENDING_PICKUP
    
    _log(db, actor=current_user, action="HANDOVER_ASSET", record_id=str(request.request_id), details="Asset handed over to requester")
    db.commit()
    db.refresh(request)
    # Notify requester that asset is ready for pickup
    from app.services.notification_service import create_notification
    asset_name = request.asset.asset_name if request.asset else request.asset_type
    background_tasks.add_task(
        create_notification,
        user_id=str(request.requested_by),
        title="Asset Ready for Pickup",
        message=f"Your requested asset {asset_name} is ready for pickup. Please confirm receipt.",
        notification_type="ASSET_READY_PICKUP",
        related_asset_id=request.asset_id,
    )
    return _serialize_request(request)


@router.put("/{request_id}/pickup", response_model=AssetRequestResponse)
def pickup_request(
    request_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = db.query(AssetRequest).filter(AssetRequest.request_id == request_id).first()
    if not request:
        raise HTTPException(404, detail="Request not found")
    if request.requested_by != current_user.id:
        raise HTTPException(403, detail="Not authorized")
    if request.status != RequestStatus.READY_FOR_PICKUP:
        raise HTTPException(400, detail="Invalid status transition")

    request.status = RequestStatus.PICKED_UP
    request.pickup_confirmed_at = datetime.utcnow()
    
    # Update asset status to ASSIGNED and change custodian to requester
    if request.asset_id:
        asset = db.query(Asset).filter(Asset.asset_id == request.asset_id).first()
        if asset:
            validate_status_transition(asset.status, AssetStatus.ASSIGNED)
            asset.status = AssetStatus.ASSIGNED
            asset.current_custodian_id = str(request.requested_by)
            
            # Update assignment record
            from app.models.assignment import Assignment, AssignmentStatus
            existing_assignment = db.query(Assignment).filter(
                Assignment.asset_id == asset.asset_id,
                Assignment.status == AssignmentStatus.ACTIVE
            ).first()
            if existing_assignment:
                # Mark as returned since custody is being transferred to requester
                existing_assignment.status = AssignmentStatus.RETURNED
                existing_assignment.return_date = date.today()
                existing_assignment.notes = f"{existing_assignment.notes or ''} - Handover completed to requester"
            
            # Create new assignment to requester
            db.add(Assignment(
                asset_id=asset.asset_id,
                assigned_to=str(request.requested_by),
                assigned_by=str(request.assigned_to),  # Custodian who handed over
                assignment_date=date.today(),
                status=AssignmentStatus.ACTIVE,
                notes="Asset handed over from request",
            ))
    
    _log(db, actor=current_user, action="PICKUP_CONFIRMED", record_id=str(request.request_id), details="Pickup confirmed")
    db.commit()
    db.refresh(request)
    # Notify Asset Managers and Super System Administrators that pickup was confirmed
    from app.services.notification_service import create_notification
    background_tasks.add_task(
        create_notification,
        user_id="Asset Manager",
        title="Asset Pickup Confirmed",
        message=f"Request #{request.request_id} has been picked up by the requester. The asset is now assigned to them.",
        notification_type="PICKUP_CONFIRMED",
        related_asset_id=request.asset_id,
    )
    background_tasks.add_task(
        create_notification,
        user_id="SUPER_SYSTEM_ADMINISTRATOR",
        title="Asset Pickup Confirmed",
        message=f"Request #{request.request_id} has been picked up by the requester. The asset is now assigned to them.",
        notification_type="PICKUP_CONFIRMED",
        related_asset_id=request.asset_id,
    )
    return _serialize_request(request)


@router.put("/{request_id}/complete", response_model=AssetRequestResponse)
def complete_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR, UserRole.SYSTEM_ADMINISTRATOR)),
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

    if current_user.role in {UserRole.SYSTEM_ADMINISTRATOR, UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR}:
        allowed = True
    elif current_user.role == UserRole.EMPLOYEE and request.status == RequestStatus.PENDING and request.requested_by == current_user.id:
        allowed = True
    else:
        allowed = False

    if not allowed:
        raise HTTPException(403, detail="Not authorized")

    request.status = RequestStatus.CANCELLED
    
    # If asset was assigned, return it to AVAILABLE
    if request.asset_id:
        asset = db.query(Asset).filter(Asset.asset_id == request.asset_id).first()
        if asset and asset.status in {AssetStatus.ASSIGNED, AssetStatus.PENDING_APPROVAL, AssetStatus.PENDING_PICKUP}:
            validate_status_transition(asset.status, AssetStatus.AVAILABLE)
            asset.status = AssetStatus.AVAILABLE
            asset.current_custodian_id = None
    
    _log(db, actor=current_user, action="CANCEL_REQUEST", record_id=str(request.request_id), details="Cancelled asset request")
    db.commit()
    db.refresh(request)
    return _serialize_request(request)


__all__ = ["router", "AssetRequest", "RequestPriority", "RequestStatus"]
