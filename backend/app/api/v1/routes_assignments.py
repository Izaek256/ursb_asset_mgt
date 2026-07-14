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
from app.api.v1.auth import get_current_user, require_role
from app.models.user import UserRole
from app.models.asset import Asset, AssetStatus
from app.models.assignment import Assignment, AssignmentStatus
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services import assignment_service
from app.services.asset_service import validate_status_transition

require_role = require_roles

router = APIRouter(prefix="/api/v1/assignments", tags=["assignments"])


class AssignmentCreateRequest(BaseModel):
    asset_id: str
    assigned_to: int
    assignment_date: Optional[date] = None
    return_date: Optional[date] = None
    expected_return_date: Optional[date] = None
    notes: Optional[str] = None


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
    )


def _log(db: Session, *, actor: User, action: str, record_id: str, details: str) -> None:
    db.add(
        AuditLog(
            user_id=actor.user_id,
            action=action,
            table_affected="assignments",
            record_id=record_id,
            details=details,
        )
    )


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    body: AssignmentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR)),
):
    """Assign an asset to a custodian. Asset Manager and System Administrator only. SRS AM-A01."""
    assignment = assignment_service.assign_asset(db, body.asset_id, body, current_user.user_id)
    
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

@router.post("/{assignment_id}/return", response_model=AssignmentResponse)
def return_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR)),
):
    assignment = db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()
    if not assignment:
        raise HTTPException(404, detail="Assignment not found")
    if assignment.status != AssignmentStatus.ACTIVE:
        raise HTTPException(400, detail="Assignment is not active")

    assignment.status = AssignmentStatus.RETURNED
    assignment.return_date = assignment.return_date or date.today()
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if asset:
        validate_status_transition(asset.status, AssetStatus.AVAILABLE)
        asset.status = AssetStatus.AVAILABLE
        asset.current_custodian_id = None
    _log(db, actor=current_user, action="RETURN_ASSET", record_id=str(assignment.assignment_id), details="Returned asset")
    db.commit()
    db.refresh(assignment)
    return _serialize_assignment(assignment, db)


@router.get("", response_model=AssignmentListResponse)
def list_assignments(
    asset_id: Optional[str] = None,
    user_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SUPER_SYSTEM_ADMINISTRATOR, UserRole.SYSTEM_ADMINISTRATOR)),
):
    """List assignments with optional filters. All authenticated roles. SRS AM-A04."""
    if asset_id:
        assignments = assignment_service.get_assignment_history(db, asset_id)
    elif user_id is not None:
        assignments = assignment_service.get_user_assignments(db, user_id)
    else:
        query = db.query(Assignment)
        if status:
            try:
                query = query.filter(Assignment.status == AssignmentStatus(status))
            except ValueError:
                raise HTTPException(400, detail="Invalid status")
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
    current_user: User = Depends(require_role("Employee")),
):
    """Step 1 of 2: Employee accepts assignment offer. Employee only. SRS §3 — Assignment Workflows."""
    from app.services.assignment_service import accept_assignment as service_accept
    assignment = service_accept(db, assignment_id, current_user.id)
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/decline", response_model=AssignmentResponse)
def decline_assignment_route(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Employee")),
):
    """Step 1 of 2: Employee declines assignment offer. Employee only. SRS §3 — Assignment Workflows."""
    from app.services.assignment_service import decline_assignment as service_decline
    assignment = service_decline(db, assignment_id, current_user.id)
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/confirm-handover", response_model=AssignmentResponse)
def confirm_handover_route(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Asset Custodian")),
):
    """Step 2 of 2: Custodian confirms physical handover. Custodian only. SRS §3 — Handover Workflows."""
    from app.services.assignment_service import confirm_handover as service_confirm
    assignment = service_confirm(db, assignment_id, current_user.id)
    return _serialize_assignment(assignment, db)


__all__ = ["router"]