"""Assignment workflow endpoints.

Access Control Rules:
- POST /api/assignments — Asset Manager, Super System Administrator
- POST /api/assignments/{assignment_id}/return — Asset Manager, Super System Administrator
- GET /api/assignments — Asset Manager, Super System Administrator, System Administrator (read-only)
- GET /api/assignments/{assignment_id} — Asset Manager, Super System Administrator, System Administrator (read-only)
"""

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.v1.auth import get_current_user, require_role, require_roles
from app.models.user import UserRole
from app.models.asset import Asset, AssetStatus
from app.models.assignment import Assignment, AssignmentStatus
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services import assignment_service
from app.services.asset_service import validate_status_transition

router = APIRouter(prefix="/api/v1/assignments", tags=["assignments"])


class AssignmentCreateRequest(BaseModel):
    asset_id: str
    assigned_to: int
    assignment_date: Optional[date] = None
    return_date: Optional[date] = None
    expected_return_date: Optional[date] = None
    notes: Optional[str] = None


class ReturnRejectRequest(BaseModel):
    reason: str


class AssignmentResponse(BaseModel):
    assignment_id: int
    asset_id: str
    asset_name: Optional[str] = None
    assigned_to: int
    assigned_to_name: Optional[str] = None
    assigned_by: int
    assigned_by_name: Optional[str] = None
    assignment_date: date
    return_date: Optional[date] = None
    status: str
    notes: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    return_requested_by: Optional[str] = None
    return_requested_at: Optional[datetime] = None
    return_approved_by: Optional[str] = None
    return_approved_at: Optional[datetime] = None
    return_rejection_reason: Optional[str] = None


    class Config:
        from_attributes = True


class AssignmentListResponse(BaseModel):
    assignments: List[AssignmentResponse]
    total: int


def _serialize_assignment(assignment: Assignment, db: Session) -> AssignmentResponse:
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    assigned_to_user = db.query(User).filter(User.id == int(assignment.assigned_to)).first() if assignment.assigned_to else None
    assigned_by_user = db.query(User).filter(User.id == int(assignment.assigned_by)).first() if assignment.assigned_by else None
    return AssignmentResponse(
        assignment_id=assignment.assignment_id,
        asset_id=assignment.asset_id,
        asset_name=asset.asset_name if asset else None,
        assigned_to=int(assignment.assigned_to),
        assigned_to_name=assigned_to_user.full_name or f"{assigned_to_user.first_name or ''} {assigned_to_user.last_name or ''}".strip() or assigned_to_user.email if assigned_to_user else None,
        assigned_by=int(assignment.assigned_by),
        assigned_by_name=assigned_by_user.full_name or f"{assigned_by_user.first_name or ''} {assigned_by_user.last_name or ''}".strip() or assigned_by_user.email if assigned_by_user else None,
        assignment_date=assignment.assignment_date,
        return_date=assignment.return_date,
        status=assignment.status.value if hasattr(assignment.status, "value") else str(assignment.status),
        notes=assignment.notes,
        acknowledged_at=assignment.acknowledged_at,
        return_requested_by=assignment.return_requested_by,
        return_requested_at=assignment.return_requested_at,
        return_approved_by=assignment.return_approved_by,
        return_approved_at=assignment.return_approved_at,
        return_rejection_reason=assignment.return_rejection_reason,
    )


def _log(db: Session, *, actor: User, action: str, record_id: str, details: str, workflow_step: str = None) -> None:
    """Enhanced audit logging with workflow step tracking for accountability."""
    log_entry = AuditLog(
        user_id=actor.id,
        action=action,
        table_affected="assignments",
        record_id=record_id,
        details=details,
    )
    
    # Add workflow step information if provided
    if workflow_step:
        log_entry.details = f"[{workflow_step}] {details}"
    
    db.add(log_entry)


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    body: AssignmentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR)),
):
    """Assign an asset to a custodian. Asset Manager and System Administrator only. SRS AM-A01."""
    # Prevent self-assignment for accountability
    if int(body.assigned_to) == int(current_user.id):
        raise HTTPException(status_code=403, detail="Cannot assign assets to yourself for accountability reasons. Use transfer workflow instead.")
    
    assignment = assignment_service.assign_asset(db, body.asset_id, body, current_user.id)
    
    # Enhanced audit log with workflow step
    _log(db, actor=current_user, action="CREATE_ASSIGNMENT", record_id=str(assignment.assignment_id), 
          details=f"Asset {body.asset_id} assigned to user {body.assigned_to}", workflow_step="INITIATION")
    
    # S3-08: Notify employee of assignment
    from app.services.notification_service import create_notification
    asset = db.query(Asset).filter(Asset.asset_id == body.asset_id).first()
    if asset:
        create_notification(
            db=db,
            user_id=str(assignment.assigned_to),
            title="New Asset Custody Assignment",
            message=f"You have been assigned the asset '{asset.asset_name}'. Please accept or decline custody of this asset.",
            notification_type="ASSIGNMENT_SENT",
            related_asset_id=asset.asset_id,
        )
    
    return _serialize_assignment(assignment, db)

@router.get("", response_model=AssignmentListResponse)
def list_assignments(
    asset_id: Optional[str] = None,
    user_id: Optional[int] = None,
    status: Optional[str] = None,
    assignment_type: Optional[str] = None,  # "final_handover" to show only handovers to requesters
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List assignments with optional filters. All authenticated roles can view their own assignments. Admins/managers/custodians can view all. SRS AM-A04."""
    # Roles that can view all assignments
    can_view_all = current_user.role in {
        UserRole.SUPER_SYSTEM_ADMINISTRATOR,
        UserRole.SYSTEM_ADMINISTRATOR,
        UserRole.ASSET_MANAGER,
        UserRole.ASSET_CUSTODIAN
    }
    
    # Employees can only view their own assignments
    if current_user.role == UserRole.EMPLOYEE:
        user_id = int(current_user.id)
    elif user_id is not None and not can_view_all:
        # Non-admin users cannot filter by other user IDs
        raise HTTPException(403, detail="Not authorized to view other users' assignments")
    
    if asset_id:
        assignments = assignment_service.get_assignment_history(db, asset_id)
    elif user_id is not None:
        # When user_id is provided, optionally filter by status
        if status:
            # Custom query to filter by both user_id and status
            query = db.query(Assignment).filter(Assignment.assigned_to == str(user_id))
            try:
                query = query.filter(Assignment.status == AssignmentStatus(status))
            except ValueError:
                raise HTTPException(400, detail="Invalid status")
            assignments = query.order_by(Assignment.assignment_date.desc()).all()
        else:
            assignments = assignment_service.get_user_assignments(db, user_id)
    else:
        # Only admins/managers/custodians can view all assignments without filters
        if not can_view_all:
            raise HTTPException(403, detail="Not authorized to view all assignments")
        query = db.query(Assignment)
        if status:
            try:
                query = query.filter(Assignment.status == AssignmentStatus(status))
            except ValueError:
                raise HTTPException(400, detail="Invalid status")
        # Filter to show only final handovers to requesters (not internal custodian assignments)
        if assignment_type == "final_handover":
            query = query.filter(Assignment.notes.like("%Asset handed over from request%"))
        assignments = query.order_by(Assignment.assignment_date.desc()).all()

    return AssignmentListResponse(
        assignments=[_serialize_assignment(a, db) for a in assignments],
        total=len(assignments),
    )

@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR, UserRole.SYSTEM_ADMINISTRATOR)),
):
    assignment = db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()
    if not assignment:
        raise HTTPException(404, detail="Assignment not found")
    return _serialize_assignment(assignment, db)





@router.post("/{assignment_id}/accept", response_model=AssignmentResponse)
def accept_assignment_route(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYEE)),
):
    """Step 1 of 2: Employee accepts assignment offer. Employee only. SRS §3 — Assignment Workflows."""
    from app.services.assignment_service import accept_assignment as service_accept
    assignment = service_accept(db, assignment_id, current_user.id)
    
    # Enhanced audit log with workflow step
    _log(db, actor=current_user, action="ACCEPT_ASSIGNMENT", record_id=str(assignment_id), 
          details=f"Assignment {assignment_id} accepted by user {current_user.id}", workflow_step="USER_CONFIRMATION")
    
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/decline", response_model=AssignmentResponse)
def decline_assignment_route(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYEE)),
):
    """Step 1 of 2: Employee declines assignment offer. Employee only. SRS §3 — Assignment Workflows."""
    from app.services.assignment_service import decline_assignment as service_decline
    assignment = service_decline(db, assignment_id, current_user.id)
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/confirm-handover", response_model=AssignmentResponse)
def confirm_handover_route(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_CUSTODIAN)),
):
    """Step 2 of 2: Custodian confirms physical handover. Custodian only. SRS §3 — Handover Workflows."""
    from app.services.assignment_service import confirm_handover as service_confirm
    assignment = service_confirm(db, assignment_id, current_user.id)
    
    # Enhanced audit log with workflow step
    _log(db, actor=current_user, action="CONFIRM_HANDOVER", record_id=str(assignment_id), 
          details=f"Physical handover confirmed by custodian {current_user.id}", workflow_step="CUSTODIAN_CONFIRMATION")
    
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/request-return", response_model=AssignmentResponse)
def request_return_route(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_CUSTODIAN)),
):
    """Custodian requests return of asset from employee. Custodian only."""
    from app.services.assignment_service import request_asset_return
    from app.services.notification_service import create_notification
    
    assignment = request_asset_return(db, assignment_id, current_user.id)
    
    # Enhanced audit log with workflow step
    _log(db, actor=current_user, action="REQUEST_RETURN", record_id=str(assignment_id), 
          details=f"Return requested by custodian {current_user.id}", workflow_step="RETURN_INITIATION")
    
    # Notify employee of return request
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset:
        create_notification(
            db=db,
            user_id=str(assignment.assigned_to),
            title="Asset Return Requested",
            message=f"The custodian has requested return of asset '{asset.asset_name}'. Please approve or reject this request.",
            notification_type="RETURN_REQUESTED",
            related_asset_id=asset.asset_id,
        )
    
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/approve-return", response_model=AssignmentResponse)
def approve_return_route(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYEE)),
):
    """Employee approves return request. Employee only."""
    from app.services.assignment_service import approve_return_request
    from app.services.notification_service import create_notification
    
    assignment = approve_return_request(db, assignment_id, current_user.id)
    
    # Enhanced audit log with workflow step
    _log(db, actor=current_user, action="APPROVE_RETURN", record_id=str(assignment_id), 
          details=f"Return approved by employee {current_user.id}", workflow_step="RETURN_APPROVAL")
    
    # Notify custodian that return is approved
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset and assignment.return_requested_by:
        create_notification(
            db=db,
            user_id=str(assignment.return_requested_by),
            title="Asset Return Approved",
            message=f"Employee has approved return of asset '{asset.asset_name}'. Please confirm receipt to complete the return.",
            notification_type="RETURN_APPROVED",
            related_asset_id=asset.asset_id,
        )
    
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/reject-return", response_model=AssignmentResponse)
def reject_return_route(
    assignment_id: int,
    body: ReturnRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYEE)),
):
    """Employee rejects return request. Employee only."""
    from app.services.assignment_service import reject_return_request
    from app.services.notification_service import create_notification
    
    assignment = reject_return_request(db, assignment_id, current_user.id, body.reason)
    
    # Enhanced audit log with workflow step
    _log(db, actor=current_user, action="REJECT_RETURN", record_id=str(assignment_id), 
          details=f"Return rejected by employee {current_user.id}. Reason: {body.reason}", workflow_step="RETURN_REJECTION")
    
    # Notify custodian that return is rejected
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset and assignment.return_requested_by:
        create_notification(
            db=db,
            user_id=str(assignment.return_requested_by),
            title="Asset Return Rejected",
            message=f"Employee has rejected the return request for asset '{asset.asset_name}'. Reason: {body.reason}",
            notification_type="RETURN_REJECTED",
            related_asset_id=asset.asset_id,
        )
    
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/confirm-return", response_model=AssignmentResponse)
def confirm_return_route(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_CUSTODIAN)),
):
    """Custodian confirms physical receipt of returned asset. Custodian only."""
    from app.services.assignment_service import confirm_asset_return
    from app.services.notification_service import create_notification
    
    assignment = confirm_asset_return(db, assignment_id, current_user.id)
    
    # Enhanced audit log with workflow step
    _log(db, actor=current_user, action="CONFIRM_RETURN", record_id=str(assignment_id), 
          details=f"Physical return confirmed by custodian {current_user.id}", workflow_step="RETURN_COMPLETION")
    
    # Notify asset manager that return is complete
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset:
        create_notification(
            db=db,
            user_id="Asset Manager",
            title="Asset Return Completed",
            message=f"Asset '{asset.asset_name}' has been returned to custody and is now Available.",
            notification_type="RETURN_COMPLETED",
            related_asset_id=asset.asset_id,
        )
    
    return _serialize_assignment(assignment, db)


__all__ = ["router"]