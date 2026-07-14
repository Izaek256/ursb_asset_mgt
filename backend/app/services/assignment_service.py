"""
Assignment business logic service.
Routers call these functions — no business logic lives in route handlers.
"""

from datetime import datetime, date
from typing import List

from fastapi import HTTPException, status
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


def accept_assignment(db: Session, assignment_id: int, current_user_id: int) -> Assignment:
    """
    Accepts an assignment offer for an employee.

    Parameters:
        db (Session): Database session.
        assignment_id (int): ID of the assignment to accept.
        current_user_id (int): ID of the employee accepting the assignment.

    Business Rules Enforced:
        - 404 error if the assignment is not found.
        - 403 error if the assignment is not assigned to the current user (current_user_id).
        - 422 error if the assignment status is not 'Pending Acceptance'.

    What's Written to the Audit Log:
        - Creates an AuditLog entry with action='ASSIGNMENT_ACCEPTED', table_affected='assignments',
          record_id=str(assignment_id), and details indicating acceptance.

    Status Transition Triggered:
        - Assignment status is updated to 'Accepted'.
        - Asset status is updated to 'Pending Pickup'.

    Returns:
        Assignment: The updated assignment object.
    """
    assignment = db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    # Check ownership
    if assignment.assigned_to != str(current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to accept this assignment."
        )

    if assignment.status != AssignmentStatus.PENDING_ACCEPTANCE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Only assignments in 'Pending Acceptance' status can be accepted. Current: {assignment.status}"
        )

    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found for this assignment."
        )

    assignment.status = AssignmentStatus.ACCEPTED
    asset.status = AssetStatus.PENDING_PICKUP

    audit = AuditLog(
        user_id=str(current_user_id),
        action="ASSIGNMENT_ACCEPTED",
        table_affected="assignments",
        record_id=str(assignment_id),
        details=f"Assignment {assignment_id} for asset {assignment.asset_id} was accepted by user {current_user_id}."
    )
    db.add(audit)
    db.commit()
    db.refresh(assignment)
    return assignment


def decline_assignment(db: Session, assignment_id: int, current_user_id: int) -> Assignment:
    """
    Declines an assignment offer for an employee.

    Parameters:
        db (Session): Database session.
        assignment_id (int): ID of the assignment to decline.
        current_user_id (int): ID of the employee declining the assignment.

    Business Rules Enforced:
        - 404 error if the assignment is not found.
        - 403 error if the assignment is not assigned to the current user (current_user_id).
        - 422 error if the assignment status is not 'Pending Acceptance'.

    What's Written to the Audit Log:
        - Creates an AuditLog entry with action='ASSIGNMENT_DECLINED', table_affected='assignments',
          record_id=str(assignment_id), and details indicating rejection.

    Status Transition Triggered:
        - Assignment status is updated to 'Declined'.
        - Asset status is updated to 'Available'.
        - Asset's current_custodian_id is cleared (set to None).

    Returns:
        Assignment: The updated assignment object.
    """
    assignment = db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    # Check ownership
    if assignment.assigned_to != str(current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to decline this assignment."
        )

    if assignment.status != AssignmentStatus.PENDING_ACCEPTANCE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Only assignments in 'Pending Acceptance' status can be declined. Current: {assignment.status}"
        )

    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found for this assignment."
        )

    assignment.status = AssignmentStatus.DECLINED
    asset.status = AssetStatus.AVAILABLE
    asset.current_custodian_id = None

    audit = AuditLog(
        user_id=str(current_user_id),
        action="ASSIGNMENT_DECLINED",
        table_affected="assignments",
        record_id=str(assignment_id),
        details=f"Assignment {assignment_id} for asset {assignment.asset_id} was declined by user {current_user_id}."
    )
    db.add(audit)
    db.commit()
    db.refresh(assignment)
    return assignment


def confirm_handover(db: Session, assignment_id: int, custodian_id: int) -> Assignment:
    """
    Confirms the physical handover of an asset by a custodian.

    Parameters:
        db (Session): Database session.
        assignment_id (int): ID of the assignment to confirm handover for.
        custodian_id (int): ID of the custodian confirming the handover.

    Business Rules Enforced:
        - 404 error if the assignment is not found.
        - 422 error if the assignment status is not 'Accepted'.

    What's Written to the Audit Log:
        - Creates an AuditLog entry with action='HANDOVER_CONFIRMED', table_affected='assignments',
          record_id=str(assignment_id), and details indicating the handover.

    Status Transition Triggered:
        - Assignment status is updated to 'Active'.
        - Asset status is updated to 'Assigned'.
        - Assignment acknowledged_at timestamp is set to current UTC time.

    Transaction Requirement:
        - All database modifications (assignment status, asset status, acknowledged_at, audit log)
          must be executed as an atomic transaction. Any error will roll back all modifications.

    Returns:
        Assignment: The updated assignment object.
    """
    assignment = db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    if assignment.status != AssignmentStatus.ACCEPTED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Only assignments in 'Accepted' status can be handed over. Current: {assignment.status}"
        )

    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found for this assignment."
        )

    try:
        assignment.status = AssignmentStatus.ACTIVE
        assignment.acknowledged_at = datetime.utcnow()
        asset.status = AssetStatus.ASSIGNED

        audit = AuditLog(
            user_id=str(custodian_id),
            action="HANDOVER_CONFIRMED",
            table_affected="assignments",
            record_id=str(assignment_id),
            details=f"Handover confirmed for assignment {assignment_id} by custodian {custodian_id}."
        )
        db.add(audit)
        db.commit()
        db.refresh(assignment)
        return assignment
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database transaction failed: {str(e)}"
        )


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
