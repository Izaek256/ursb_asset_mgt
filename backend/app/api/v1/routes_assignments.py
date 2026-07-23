"""Assignment workflow endpoints.

Access Control Rules:
- POST /api/assignments — Asset Manager, Super System Administrator
- POST /api/assignments/{assignment_id}/return — Asset Manager, Super System Administrator
- GET /api/assignments — Asset Manager, Super System Administrator, System Administrator (read-only)
- GET /api/assignments/{assignment_id} — Asset Manager, Super System Administrator, System Administrator (read-only)
"""

from datetime import date, datetime, timezone
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
    assigned_to: str
    custodian_id: Optional[str] = None
    assignment_date: Optional[str] = None  # Date string YYYY-MM-DD
    return_date: Optional[date] = None
    expected_return_date: Optional[date] = None
    notes: Optional[str] = None


class ReturnRejectRequest(BaseModel):
    reason: str


class AssignmentResponse(BaseModel):
    assignment_id: int
    asset_id: str
    asset_name: Optional[str] = None
    assigned_to: str
    assigned_to_name: Optional[str] = None
    assigned_by: str
    assigned_by_name: Optional[str] = None
    assignment_date: datetime
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
        asset_name=asset.asset_name if asset else assignment.asset_id,
        assigned_to=str(assigned_to_user.user_id) if assigned_to_user else str(assignment.assigned_to),
        assigned_to_name=assigned_to_user.full_name or f"{assigned_to_user.first_name or ''} {assigned_to_user.last_name or ''}".strip() or assigned_to_user.email if assigned_to_user else None,
        assigned_by=str(assigned_by_user.user_id) if assigned_by_user else str(assignment.assigned_by),
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
        user_id=actor.user_id,
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
    """Assign an asset to a custodian. Asset Manager and Super System Administrator only. SRS AM-A01."""
    # Prevent self-assignment for accountability
    if body.assigned_to == str(current_user.user_id):
        raise HTTPException(status_code=403, detail="Cannot assign assets to yourself for accountability reasons. Use transfer workflow instead.")
    
    assignment = assignment_service.assign_asset(db, body.asset_id, body, current_user.user_id)
    
    # Enhanced audit log with workflow step
    _log(db, actor=current_user, action="CREATE_ASSIGNMENT", record_id=str(assignment.assignment_id), 
          details=f"Asset {body.asset_id} assigned to custodian {assignment.assigned_to} for final recipient {body.assigned_to}", workflow_step="INITIATION")
    
    # S3-08: Notify final recipient of assignment
    from app.services.notification_service import create_notification
    asset = db.query(Asset).filter(Asset.asset_id == body.asset_id).first()
    if asset:
        # Notify the final recipient who needs to accept the assignment
        recipient_id = str(body.assigned_to)
        message = f"You have been assigned the asset '{asset.asset_name}'. Please accept or decline this assignment."
        if body.custodian_id:
            message += " A custodian will handle pickup after your approval."
        
        create_notification(
            db=db,
            user_id=recipient_id,
            title="New Asset Assignment",
            message=message,
            notification_type="ASSIGNMENT_SENT",
            related_asset_id=asset.asset_id,
        )
    
    return _serialize_assignment(assignment, db)

@router.get("", response_model=AssignmentListResponse)
def list_assignments(
    asset_id: Optional[str] = None,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    tab: Optional[str] = None,  # "active" or "history" — returns correct status set for each tab
    assignment_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List assignments with optional filters. All authenticated roles can view their own assignments. Admins/managers can view all."""
    from app.models.asset import Asset
    from sqlalchemy import exists, or_

    # Keep only assignments whose asset still exists in the DB
    def _with_existing_asset(q):
        return q.filter(exists().where(Asset.asset_id == Assignment.asset_id))

    # Statuses that belong in the Active Assignments tab
    ACTIVE_TAB_STATUSES = [
        AssignmentStatus.ACTIVE,
        AssignmentStatus.PENDING_ACCEPTANCE,
        AssignmentStatus.ACCEPTED,
        AssignmentStatus.RETURN_REQUESTED,
        AssignmentStatus.RETURN_APPROVED,
    ]

    # Statuses that belong in the History tab
    HISTORY_TAB_STATUSES = [
        AssignmentStatus.RETURNED,
        AssignmentStatus.DECLINED,
        AssignmentStatus.RETURN_REJECTED,
    ]

    can_view_all = current_user.role in {
        UserRole.SUPER_SYSTEM_ADMINISTRATOR,
        UserRole.SYSTEM_ADMINISTRATOR,
        UserRole.ASSET_MANAGER,
    }

    # Employees and custodians are always scoped to their own assignments
    if current_user.role in {UserRole.EMPLOYEE, UserRole.ASSET_CUSTODIAN}:
        effective_user_id = str(current_user.id)
    else:
        effective_user_id = str(user_id) if user_id is not None else None

    if asset_id:
        # Return full history for a specific asset (admin/manager use only)
        assignments = assignment_service.get_assignment_history(db, asset_id)
        return AssignmentListResponse(
            assignments=[_serialize_assignment(a, db) for a in assignments],
            total=len(assignments),
        )

    # Build base query scoped to the right user(s)
    if effective_user_id is not None:
        if current_user.role == UserRole.ASSET_CUSTODIAN:
            # Custodians see assignments they are:
            # 1. directly assigned to (assigned_to)
            # 2. named as custodian in notes  [Custodian: <id>:...]
            # 3. the one who created/handed-over the assignment (assigned_by)
            base_query = db.query(Assignment).filter(
                or_(
                    Assignment.assigned_to == effective_user_id,
                    Assignment.notes.like(f"%[Custodian: {effective_user_id}:%"),
                    Assignment.assigned_by == effective_user_id,
                )
            )
        else:
            base_query = db.query(Assignment).filter(Assignment.assigned_to == effective_user_id)
    elif can_view_all:
        base_query = db.query(Assignment)
    else:
        raise HTTPException(403, detail="Not authorized to view all assignments")

    # Apply tab filter (preferred over raw status param)
    if tab == "active":
        base_query = base_query.filter(Assignment.status.in_(ACTIVE_TAB_STATUSES))
    elif tab == "history":
        base_query = base_query.filter(Assignment.status.in_(HISTORY_TAB_STATUSES))
    elif status:
        # Legacy single-status filter (kept for backward compat)
        try:
            base_query = base_query.filter(Assignment.status == AssignmentStatus(status))
        except ValueError:
            raise HTTPException(400, detail=f"Invalid status '{status}'")

    if assignment_type == "final_handover":
        base_query = base_query.filter(Assignment.notes.like("%Asset handed over from request%"))

    assignments = (
        _with_existing_asset(base_query)
        .order_by(Assignment.assignment_date.desc(), Assignment.assignment_id.desc())
        .all()
    )

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


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR)),
):
    """
    Cancel and delete a pending assignment (Pending Acceptance or Accepted only).
    Returns the asset to Available and clears the custodian.
    Asset Manager and Super System Administrator only.
    """
    assignment = db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()
    if not assignment:
        raise HTTPException(404, detail="Assignment not found")

    # Only allow deletion of pre-handover assignments
    if assignment.status not in {AssignmentStatus.PENDING_ACCEPTANCE, AssignmentStatus.ACCEPTED}:
        raise HTTPException(
            400,
            detail=f"Only Pending Acceptance or Accepted assignments can be deleted. Current status: {assignment.status.value}"
        )

    # Reset asset status back to Available
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset:
        asset.status = AssetStatus.AVAILABLE
        asset.current_custodian_id = None

    # Audit log before deletion
    db.add(AuditLog(
        user_id=current_user.user_id,
        action="DELETE_ASSIGNMENT",
        table_affected="assignments",
        record_id=str(assignment_id),
        details=f"Assignment {assignment_id} for asset {assignment.asset_id} deleted by {current_user.email}. Asset returned to Available.",
    ))

    # Notify the employee who was assigned
    from app.services.notification_service import create_notification
    asset_label = asset.asset_name if asset else assignment.asset_id
    create_notification(
        db=db,
        user_id=str(assignment.assigned_to),
        title="Assignment Cancelled",
        message=f"Your pending assignment for asset '{asset_label}' has been cancelled by the administrator.",
        notification_type="ASSIGNMENT_CANCELLED",
        related_asset_id=assignment.asset_id,
    )

    db.delete(assignment)
    db.commit()





@router.post("/{assignment_id}/accept", response_model=AssignmentResponse)
def accept_assignment_route(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Step 1 of 2: Employee or Asset Manager accepts assignment offer when they are the assigned recipient."""
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
    current_user: User = Depends(get_current_user),
):
    """Step 1 of 2: Employee or Asset Manager declines assignment offer when they are the assigned recipient."""
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


@router.post("/{assignment_id}/confirm-receipt", response_model=AssignmentResponse)
def confirm_receipt_route(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYEE)),
):
    """Step 3: Employee confirms physical receipt of asset after custodian handover. Employee only."""
    from app.services.assignment_service import confirm_receipt as service_confirm_receipt

    assignment = service_confirm_receipt(db, assignment_id, current_user.id)

    # Enhanced audit log with workflow step
    _log(db, actor=current_user, action="CONFIRM_RECEIPT", record_id=str(assignment_id),
          details=f"Receipt confirmed by employee {current_user.id}", workflow_step="RECEIPT_CONFIRMATION")

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
    
    assignment = request_asset_return(db, assignment_id, current_user.user_id)
    
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
    
    assignment = approve_return_request(db, assignment_id, current_user.user_id)
    
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
    
    assignment = reject_return_request(db, assignment_id, current_user.user_id, body.reason)
    
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
    
    assignment = confirm_asset_return(db, assignment_id, current_user.user_id)
    
    # Enhanced audit log with workflow step
    _log(db, actor=current_user, action="CONFIRM_RETURN", record_id=str(assignment_id), 
          details=f"Physical return confirmed by custodian {current_user.id}", workflow_step="RETURN_COMPLETION")
    
    # Notify asset manager that return is complete
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset:
        create_notification(
            db=db,
            user_id="ASSET_MANAGER",
            title="Asset Return Completed",
            message=f"Asset '{asset.asset_name}' has been returned to custody and is now Available.",
            notification_type="RETURN_COMPLETED",
            related_asset_id=asset.asset_id,
        )
    
    return _serialize_assignment(assignment, db)


__all__ = ["router"]