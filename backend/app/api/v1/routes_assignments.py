"""Assignment workflow endpoints."""

from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.v1.auth import get_current_user, require_roles
from app.models.assignment import Assignment, AssignmentStatus
from app.models.asset import Asset
from app.models.user import User
from app.services import assignment_service

router = APIRouter(prefix="/api/v1/assignments", tags=["assignments"])


# ── Schemas ──────────────────────────────────────────────────────────────────────────

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


# ── Helpers ──────────────────────────────────────────────────────────────────────────

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


# ── Endpoints ────────────────────────────────────────────────────────────────────────

@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    body: AssignmentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator", "Asset Manager")),
):
    """Assign an asset to a custodian. Asset Manager and System Administrator only. SRS AM-A01."""
    assignment = assignment_service.assign_asset(db, body.asset_id, body, current_user.user_id)
    return _serialize_assignment(assignment, db)


@router.post("/{assignment_id}/return", response_model=AssignmentResponse)
def return_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator", "Asset Manager")),
):
    """Return an assigned asset. Asset Manager and System Administrator only. SRS AM-A07."""
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

    from app.models.audit_log import AuditLog
    db.add(AuditLog(
        user_id=current_user.user_id,
        action="RETURN_ASSET",
        table_affected="assignments",
        record_id=str(assignment_id),
        details=f"Assignment {assignment_id} returned",
    ))
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
    current_user: User = Depends(get_current_user),
):
    """Get a single assignment by ID. All authenticated roles. SRS AM-A04."""
    assignment = db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()
    if not assignment:
        raise HTTPException(404, detail="Assignment not found")
    return _serialize_assignment(assignment, db)


__all__ = ["router"]