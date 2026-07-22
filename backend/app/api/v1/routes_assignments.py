"""Assignment workflow endpoints.

Access Control Rules:
- POST /api/assignments — Asset Manager, Super System Administrator
- POST /api/assignments/{assignment_id}/return — Asset Manager, Super System Administrator
- GET /api/assignments — Asset Manager, Super System Administrator, System Administrator (read-only)
- GET /api/assignments/{assignment_id} — Asset Manager, Super System Administrator, System Administrator (read-only)
"""

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
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
    assigned_to: str
    assigned_to_name: Optional[str] = None
    assigned_by: str
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
    background_tasks: BackgroundTasks,
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
        
        background_tasks.add_task(
            create_notification,
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
    assignment_type: Optional[str] = None,  # "final_handover" to show only handovers to requesters
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List assignments with optional filters. All authenticated roles can view their own assignments. Admins/managers can view all. SRS AM-A04."""
    from app.models.asset import Asset
    from sqlalchemy import exists

    # Helper: subquery that keeps only assignments whose asset still exists in the DB
    def _with_existing_asset(q):
        return q.filter(
            exists().where(Asset.asset_id == Assignment.asset_id)
        )

    # Roles that can view all assignments
    can_view_all = current_user.role in {
        UserRole.SUPER_SYSTEM_ADMINISTRATOR,
        UserRole.SYSTEM_ADMINISTRATOR,
        UserRole.ASSET_MANAGER
    }
    
    # Employees and custodians can only view their own assignments by default
    if current_user.role in {UserRole.EMPLOYEE, UserRole.ASSET_CUSTODIAN}:
        user_id = int(current_user.id)
    elif user_id is not None and not can_view_all:
        # Non-admin users cannot filter by other user IDs
        raise HTTPException(403, detail="Not authorized to view other users' assignments")
    
    if asset_id:
        assignments = assignment_service.get_assignment_history(db, asset_id)
    elif user_id is not None:
        # When user_id is provided, optionally filter by status
        if status:
            from sqlalchemy import or_
            # Custom query to filter by both user_id and status
            if current_user.role == UserRole.ASSET_CUSTODIAN:
                query = db.query(Assignment).filter(
                    or_(
                        Assignment.assigned_to == str(user_id),
                        Assignment.notes.like(f"%[Custodian: {user_id}:%")
                    )
                )
            else:
                query = db.query(Assignment).filter(Assignment.assigned_to == str(user_id))
            try:
                query = query.filter(Assignment.status == AssignmentStatus(status))
            except ValueError:
                raise HTTPException(400, detail="Invalid status")
            assignments = _with_existing_asset(query).order_by(Assignment.assignment_date.desc(), Assignment.assignment_id.desc()).all()
        else:
            # get_user_assignments returns Active+ReturnRequested for the user;
            # filter out orphaned assets inline
            base = db.query(Assignment).filter(
                Assignment.assigned_to == str(user_id),
                Assignment.status.in_([AssignmentStatus.ACTIVE, AssignmentStatus.RETURN_REQUESTED]),
            )
            assignments = _with_existing_asset(base).order_by(Assignment.assignment_date.desc(), Assignment.assignment_id.desc()).all()
    else:
        # Only admins/managers can view all assignments without filters
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
        assignments = _with_existing_asset(query).order_by(Assignment.assignment_date.desc(), Assignment.assignment_id.desc()).all()

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
    background_tasks: BackgroundTasks,
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

    db.delete(assignment)
    db.commit()

    background_tasks.add_task(
        create_notification,
        user_id=str(assignment.assigned_to),
        title="Assignment Cancelled",
        message=f"Your pending assignment for asset '{asset_label}' has been cancelled by the administrator.",
        notification_type="ASSIGNMENT_CANCELLED",
        related_asset_id=assignment.asset_id,
    )





@router.post("/{assignment_id}/accept", response_model=AssignmentResponse)
def accept_assignment_route(
    assignment_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYEE)),
):
    """Step 1 of 2: Employee accepts assignment offer. Employee only. SRS §3 — Assignment Workflows."""
    from app.services.assignment_service import accept_assignment as service_accept
    from app.services.notification_service import create_notification
    assignment = service_accept(db, assignment_id, current_user.id)
    
    # Enhanced audit log with workflow step
    _log(db, actor=current_user, action="ACCEPT_ASSIGNMENT", record_id=str(assignment_id), 
          details=f"Assignment {assignment_id} accepted by user {current_user.id}", workflow_step="USER_CONFIRMATION")
    db.commit()

    # S3-08: Notify custodian if specified in notes, or final recipient
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset:
        if assignment.notes and "[Custodian:" in assignment.notes:
            import re
            match = re.search(r'\[Custodian: (\d+):([^\]]+)\]', assignment.notes)
            if match:
                custodian_id = int(match.group(1))
                background_tasks.add_task(
                    create_notification,
                    user_id=str(custodian_id),
                    title="Asset Approved for Pickup",
                    message=f"Asset '{asset.asset_name}' has been approved by the recipient. Please handle pickup and handover.",
                    notification_type="ASSET_APPROVED_PICKUP",
                    related_asset_id=asset.asset_id,
                )
        elif assignment.notes and "[Final recipient:" in assignment.notes:
            # Handle old format for backward compatibility
            import re
            match = re.search(r'\[Final recipient: ([^\]]+)\]', assignment.notes)
            if match:
                final_recipient_email = match.group(1)
                final_recipient = db.query(User).filter(User.email == final_recipient_email).first()
                if final_recipient:
                    background_tasks.add_task(
                        create_notification,
                        user_id=assignment.assigned_to,
                        title="Asset Approved for Pickup",
                        message=f"Asset '{asset.asset_name}' has been approved by {final_recipient.email}. Please handle pickup and handover.",
                        notification_type="ASSET_APPROVED_PICKUP",
                        related_asset_id=asset.asset_id,
                    )
    
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/decline", response_model=AssignmentResponse)
def decline_assignment_route(
    assignment_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYEE)),
):
    """Step 1 of 2: Employee declines assignment offer. Employee only. SRS §3 — Assignment Workflows."""
    from app.services.assignment_service import decline_assignment as service_decline
    from app.services.notification_service import create_notification
    assignment = service_decline(db, assignment_id, current_user.id)

    # S3-08: Notify Asset Manager that asset is back to Available
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset:
        background_tasks.add_task(
            create_notification,
            user_id="ASSET_MANAGER",
            title="Assignment Declined",
            message=f"Employee declined the assignment for asset '{asset.asset_name}' ({asset.asset_id}). The asset is now Available.",
            notification_type="ASSIGNMENT_DECLINED",
            related_asset_id=asset.asset_id,
        )
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/confirm-handover", response_model=AssignmentResponse)
def confirm_handover_route(
    assignment_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_CUSTODIAN)),
):
    """Step 2 of 2: Custodian confirms physical handover. Custodian only. SRS §3 — Handover Workflows."""
    from app.services.assignment_service import confirm_handover as service_confirm
    from app.services.notification_service import create_notification
    assignment = service_confirm(db, assignment_id, current_user.id)
    
    # Enhanced audit log with workflow step
    _log(db, actor=current_user, action="CONFIRM_HANDOVER", record_id=str(assignment_id), 
          details=f"Physical handover confirmed by custodian {current_user.id}", workflow_step="CUSTODIAN_CONFIRMATION")
    db.commit()

    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset:
        background_tasks.add_task(
            create_notification,
            user_id=assignment.assigned_to,
            title="Asset Ready for Pickup",
            message=f"Asset '{asset.asset_name}' has been prepared by custodian and is ready for pickup. Please confirm receipt.",
            notification_type="ASSET_READY_PICKUP",
            related_asset_id=asset.asset_id,
        )
    
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/confirm-receipt", response_model=AssignmentResponse)
def confirm_receipt_route(
    assignment_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYEE)),
):
    """Step 3: Employee confirms physical receipt of asset after custodian handover. Employee only."""
    from app.services.assignment_service import confirm_receipt as service_confirm_receipt
    from app.services.notification_service import create_notification

    assignment = service_confirm_receipt(db, assignment_id, current_user.id)

    # Enhanced audit log with workflow step
    _log(db, actor=current_user, action="CONFIRM_RECEIPT", record_id=str(assignment_id),
          details=f"Receipt confirmed by employee {current_user.id}", workflow_step="RECEIPT_CONFIRMATION")
    db.commit()

    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset:
        background_tasks.add_task(
            create_notification,
            user_id="ASSET_MANAGER",
            title="Asset Receipt Confirmed",
            message=f"Employee has confirmed receipt of asset '{asset.asset_name}' ({asset.asset_id}). Assignment #{assignment_id} is now fully active.",
            notification_type="RECEIPT_CONFIRMED",
            related_asset_id=asset.asset_id,
        )
        if assignment.notes and "[Custodian:" in assignment.notes:
            import re
            match = re.search(r'\[Custodian: (\d+):', assignment.notes)
            if match:
                custodian_id_from_notes = int(match.group(1))
                background_tasks.add_task(
                    create_notification,
                    user_id=str(custodian_id_from_notes),
                    title="Asset Receipt Confirmed",
                    message=f"The employee has confirmed receipt of asset '{asset.asset_name}' ({asset.asset_id}). Handover is complete.",
                    notification_type="RECEIPT_CONFIRMED",
                    related_asset_id=asset.asset_id,
                )
    else:
        background_tasks.add_task(
            create_notification,
            user_id="ASSET_MANAGER",
            title="Asset Receipt Confirmed",
            message=f"Employee has confirmed receipt of asset (ID: {assignment.asset_id}). Assignment #{assignment_id} is now fully active.",
            notification_type="RECEIPT_CONFIRMED",
            related_asset_id=None,
        )

    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/request-return", response_model=AssignmentResponse)
def request_return_route(
    assignment_id: int,
    background_tasks: BackgroundTasks,
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
    db.commit()
    
    # Notify employee of return request
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset:
        background_tasks.add_task(
            create_notification,
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
    background_tasks: BackgroundTasks,
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
    db.commit()
    
    # Notify custodian that return is approved
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset and assignment.return_requested_by:
        background_tasks.add_task(
            create_notification,
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
    background_tasks: BackgroundTasks,
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
    db.commit()
    
    # Notify custodian that return is rejected
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset and assignment.return_requested_by:
        background_tasks.add_task(
            create_notification,
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
    background_tasks: BackgroundTasks,
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
    db.commit()
    
    # Notify asset manager that return is complete
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset:
        background_tasks.add_task(
            create_notification,
            user_id="Asset Manager",
            title="Asset Return Completed",
            message=f"Asset '{asset.asset_name}' has been returned to custody and is now Available.",
            notification_type="RETURN_COMPLETED",
            related_asset_id=asset.asset_id,
        )
    
    return _serialize_assignment(assignment, db)


__all__ = ["router"]