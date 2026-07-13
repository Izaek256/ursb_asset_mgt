"""
Assignment business logic service.
Routers call these functions — no business logic lives in route handlers.
"""

from datetime import date
from typing import List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.asset import Asset, AssetStatus
from app.models.assignment import Assignment, AssignmentStatus
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services.asset_service import validate_status_transition


def assign_asset(db: Session, asset_id: str, data, assigned_by_id: int) -> Assignment:
    """
    Create an assignment record for an asset.

    Parameters:
        db: Database session.
        asset_id: ID of the asset to assign.
        data: AssignmentCreateRequest schema object.
        assigned_by_id: user_id of the Asset Manager creating the assignment.

    Returns:
        Newly created Assignment ORM object.

    Raises:
        HTTPException 404 if asset or target user not found.
        HTTPException 422 if asset is not in Available status.
        HTTPException 400 if target user is inactive.

    Business rules:
        Asset must be in Available status before assignment.
        Sets asset status to Pending Acceptance after assignment —
        this removes it from Available views automatically since
        list_assets(status="Available") filters by status only.
        Updates Asset.current_custodian_id on success.
        All database changes wrapped in a single transaction —
        if asset status update fails, assignment record is also rolled back.

    Audit log:
        Writes action=ASSIGN_ASSET on success.
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(404, detail="Asset not found")

    # Asset must be Available — 422 for any other status including Disposed
    validate_status_transition(asset.status, AssetStatus.PENDING_ACCEPTANCE)

    target_user = db.query(User).filter(User.id == data.assigned_to).first()
    if not target_user:
        raise HTTPException(404, detail="User not found")
    if not target_user.is_active:
        raise HTTPException(400, detail="Assigned user is inactive")

    assignment = Assignment(
        asset_id=asset_id,
        assigned_to=str(data.assigned_to),
        assigned_by=str(assigned_by_id),
        assignment_date=data.assignment_date or date.today(),
        return_date=data.return_date,
        status=AssignmentStatus.ACTIVE,
        notes=data.notes,
    )
    db.add(assignment)

    # Set status to Pending Acceptance — asset no longer appears in Available views
    asset.status = AssetStatus.PENDING_ACCEPTANCE
    asset.current_custodian_id = str(data.assigned_to)

    db.add(AuditLog(
        user_id=assigned_by_id,
        action="ASSIGN_ASSET",
        table_affected="assignments",
        record_id=asset_id,
        details=f"Asset {asset_id} assigned to user {data.assigned_to}, status set to Pending Acceptance",
    ))
    db.commit()
    db.refresh(assignment)
    return assignment


def get_assignment_history(db: Session, asset_id: str) -> List[Assignment]:
    """
    Return the full assignment history for a given asset.

    Parameters:
        db: Database session.
        asset_id: ID of the asset.

    Returns:
        List of Assignment objects ordered by assignment_date descending.

    Raises:
        None.

    Business rules:
        Returns all assignments regardless of status.

    Audit log:
        Does not write to audit log.
    """
    return (
        db.query(Assignment)
        .filter(Assignment.asset_id == asset_id)
        .order_by(Assignment.assignment_date.desc())
        .all()
    )


def get_user_assignments(db: Session, user_id: int) -> List[Assignment]:
    """
    Return all currently active assignments for a given user.

    Parameters:
        db: Database session.
        user_id: ID of the user whose assignments to fetch.

    Returns:
        List of active Assignment objects for the user.

    Raises:
        None.

    Business rules:
        Only returns assignments with status Active.
        Used by employee My Assets view.

    Audit log:
        Does not write to audit log.
    """
    return (
        db.query(Assignment)
        .filter(
            Assignment.assigned_to == str(user_id),
            Assignment.status == AssignmentStatus.ACTIVE,
        )
        .order_by(Assignment.assignment_date.desc())
        .all()
    )