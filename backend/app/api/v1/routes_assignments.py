"""Assignment workflow endpoints."""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.v1.auth import get_current_user, require_roles
from app.models.asset import Asset, AssetStatus
from app.models.assignment import Assignment, AssignmentStatus
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services import assignment_service

router = APIRouter(prefix="/api/v1/assignments", tags=["assignments"])


class AssignmentCreateRequest(BaseModel):
    asset_id: str
    assigned_to: int
    assignment_date: Optional[date] = None
    return_date: Optional[date] = None
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
        assigned_to_name=assigned_to_user.full_name if assigned_to_user and hasattr(assigned_to_user, "full_name") else None,
        assigned_by=int(assignment.assigned_by),
        assigned_by_name=assigned_by_user.full_name if assigned_by_user and hasattr(assigned_by_user, "full_name") else None,
        assignment_date=assignment.assignment_date,
        return_date=assignment.return_date,
        status=assignment.status.value if hasattr(assignment.status, "value") else str(assignment.status),
        notes=assignment.notes,
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
    current_user: User = Depends(require_roles("System Administrator", "Asset Manager")),
):
    asset = db.query(Asset).filter(Asset.asset_id == body.asset_id).first()
    if not asset:
        raise HTTPException(404, detail="Asset not found")
    if asset.status != AssetStatus.ACTIVE:
        raise HTTPException(400, detail=f"Only Active assets can be assigned. Current: {asset.status.value}")
    if not getattr(asset, "is_active", True):
        raise HTTPException(400, detail="Asset is inactive")

    existing = (
        db.query(Assignment)
        .filter(Assignment.asset_id == asset.asset_id, Assignment.status == AssignmentStatus.ACTIVE)
        .first()
    )
    if existing:
        raise HTTPException(400, detail="Asset already assigned. Return first.")

    target_user = db.query(User).filter(User.id == body.assigned_to).first()
    if not target_user:
        raise HTTPException(404, detail="User not found")
    if not target_user.is_active:
        raise HTTPException(400, detail="Assigned user is inactive")

    assignment = Assignment(
        asset_id=asset.asset_id,
        assigned_to=str(body.assigned_to),
        assigned_by=str(current_user.id),
        assignment_date=body.assignment_date or date.today(),
        return_date=body.return_date,
        status=AssignmentStatus.ACTIVE,
        notes=body.notes,
    )
    db.add(assignment)
    asset.current_custodian_id = str(body.assigned_to)
    asset.status = AssetStatus.ACTIVE
    _log(db, actor=current_user, action="ASSIGN_ASSET", record_id=asset.asset_id, details="Assigned asset")
    db.commit()
    db.refresh(assignment)
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/return", response_model=AssignmentResponse)
def return_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator", "Asset Manager")),
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
    current_user: User = Depends(get_current_user),
):
    query = db.query(Assignment)
    if asset_id:
        query = query.filter(Assignment.asset_id == asset_id)
    if user_id is not None:
        query = query.filter(Assignment.assigned_to == str(user_id))
    if status:
        try:
            query = query.filter(Assignment.status == AssignmentStatus(status))
        except ValueError:
            raise HTTPException(400, detail="Invalid status")
    assignments = query.order_by(Assignment.assignment_date.desc()).all()
    return AssignmentListResponse(assignments=[_serialize_assignment(a, db) for a in assignments], total=len(assignments))


@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignment = db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()
    if not assignment:
        raise HTTPException(404, detail="Assignment not found")
    return _serialize_assignment(assignment, db)

@router.post("/{assignment_id}/return", response_model=AssignmentResponse)
def initiate_return(
    assignment_id: int,
    db: Session = Depends(get_db),
    # TODO: Replace get_current_user with require_roles("Employee") once S3-04 merges
    current_user: User = Depends(get_current_user),
):
    """Step 1 of 2: Employee initiates asset return. Employee only. SRS §7 — Asset Returns."""
    assignment = assignment_service.initiate_return(db, assignment_id, current_user.user_id)
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/confirm-return", response_model=AssignmentResponse)
def confirm_return(
    assignment_id: int,
    db: Session = Depends(get_db),
    # TODO: Replace get_current_user with require_roles("Asset Custodian") once S3-04 merges
    current_user: User = Depends(get_current_user),
):
    """Step 2 of 2: Custodian confirms physical receipt of returned asset. Custodian only. SRS §7 — Asset Returns."""
    assignment = assignment_service.confirm_return(db, assignment_id, current_user.user_id)
    return _serialize_assignment(assignment, db)


__all__ = ["router"]