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
        If custodian_id is provided, asset goes to custodian first (Pending Acceptance).
        If no custodian_id, asset goes directly to final recipient (Pending Acceptance).
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
    try:
        validate_status_transition(asset.status, AssetStatus.PENDING_ACCEPTANCE)
    except HTTPException as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Asset must be in Available status to assign. Current status: {asset.status.value}"
        )

    target_user = next((u for u in db.query(User).all() if str(u.user_id) == data.assigned_to), None)
    if not target_user:
        raise HTTPException(404, detail="User not found")
    if not target_user.is_active:
        raise HTTPException(400, detail="Assigned user is inactive")

    # If custodian is specified, assign to final recipient first with custodian info stored
    custodian_id = data.custodian_id if hasattr(data, 'custodian_id') and data.custodian_id else None
    final_recipient_id = str(target_user.id)
    
    if custodian_id:
        # Assignment with custodian workflow - assign to final recipient first
        custodian = next((u for u in db.query(User).all() if str(u.user_id) == custodian_id), None)
        if not custodian or not custodian.is_active:
            raise HTTPException(400, detail="Custodian is invalid or inactive")
        
        # Store custodian info in notes for later workflow steps
        assignment = Assignment(
            asset_id=asset_id,
            assigned_to=final_recipient_id,
            assigned_by=str(assigned_by_id),
            assignment_date=data.assignment_date or date.today(),
            return_date=data.return_date,
            status=AssignmentStatus.PENDING_ACCEPTANCE,
            notes=f"{data.notes or ''} [Custodian: {custodian.id}:{custodian.email}]",
        )
        asset.current_custodian_id = str(custodian.id)  # Asset with custodian for pickup
        
        audit_details = f"Asset {asset_id} assigned to final recipient {target_user.id} with custodian {custodian.id} for pickup, status set to Pending Acceptance"
    else:
        # Direct assignment to employee without custodian
        assignment = Assignment(
            asset_id=asset_id,
            assigned_to=final_recipient_id,
            assigned_by=str(assigned_by_id),
            assignment_date=data.assignment_date or date.today(),
            return_date=data.return_date,
            status=AssignmentStatus.PENDING_ACCEPTANCE,
            notes=data.notes,
        )
        asset.current_custodian_id = final_recipient_id
        
        audit_details = f"Asset {asset_id} assigned directly to employee {data.assigned_to}, status set to Pending Acceptance"
    
    db.add(assignment)

    # Set status to Pending Acceptance — asset no longer appears in Available views
    asset.status = AssetStatus.PENDING_ACCEPTANCE

    db.add(AuditLog(
        user_id=assigned_by_id,
        action="ASSIGN_ASSET",
        table_affected="assignments",
        record_id=asset_id,
        details=audit_details,
    ))
    db.commit()
    db.refresh(assignment)
    print(f"[DEBUG] Assignment created successfully: assignment_id={assignment.assignment_id}")
    return assignment


def accept_assignment(db: Session, assignment_id: int, current_user_id: int) -> Assignment:
    """
    Accepts an assignment offer for an employee/custodian.

    Parameters:
        db (Session): Database session.
        assignment_id (int): ID of the assignment to accept.
        current_user_id (int): ID of the employee/custodian accepting the assignment.

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
        - If custodian is specified in notes, they will be notified to handle pickup.

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
    
    # Notify custodian if specified in notes (new workflow)
    if assignment.notes and "[Custodian:" in assignment.notes:
        from app.services.notification_service import create_notification
        import re
        match = re.search(r'\[Custodian: (\d+):([^\]]+)\]', assignment.notes)
        if match:
            custodian_id = int(match.group(1))
            custodian_email = match.group(2)
            custodian = db.query(User).filter(User.id == custodian_id).first()
            if custodian:
                create_notification(
                    db=db,
                    user_id=str(custodian_id),
                    title="Asset Approved for Pickup",
                    message=f"Asset '{asset.asset_name}' has been approved by the recipient. Please handle pickup and handover.",
                    notification_type="ASSET_APPROVED_PICKUP",
                    related_asset_id=asset.asset_id,
                )
    elif assignment.notes and "[Final recipient:" in assignment.notes:
        # Handle old format for backward compatibility
        from app.services.notification_service import create_notification
        import re
        match = re.search(r'\[Final recipient: ([^\]]+)\]', assignment.notes)
        if match:
            final_recipient_email = match.group(1)
            final_recipient = db.query(User).filter(User.email == final_recipient_email).first()
            if final_recipient:
                # In old format, assignment was to custodian, so notify custodian that recipient approved
                create_notification(
                    db=db,
                    user_id=assignment.assigned_to,
                    title="Asset Approved for Pickup",
                    message=f"Asset '{asset.asset_name}' has been approved by {final_recipient.email}. Please handle pickup and handover.",
                    notification_type="ASSET_APPROVED_PICKUP",
                    related_asset_id=asset.asset_id,
                )
    
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

    # Notify Asset Manager that asset is back to Available
    from app.services.notification_service import create_notification
    create_notification(
        db=db,
        user_id="ASSET_MANAGER",
        title="Assignment Declined",
        message=f"Employee declined the assignment for asset '{asset.asset_name}' ({asset.asset_id}). The asset is now Available.",
        notification_type="ASSIGNMENT_DECLINED",
        related_asset_id=asset.asset_id,
    )

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
        - Assignment status is updated to 'Active' and asset status to 'Assigned'
        - Assignment acknowledged_at timestamp is set to current UTC time.
        - Final recipient is notified that asset is ready for pickup.

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
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Asset '{assignment.asset_id}' linked to this assignment no longer exists. Please contact your administrator."
        )

    try:
        # Custodian confirms handover - asset ready for final recipient pickup
        assignment.status = AssignmentStatus.ACTIVE
        assignment.acknowledged_at = datetime.utcnow()
        asset.status = AssetStatus.ASSIGNED

        audit = AuditLog(
            user_id=str(custodian_id),
            action="HANDOVER_CONFIRMED",
            table_affected="assignments",
            record_id=str(assignment_id),
            details=f"Handover confirmed by custodian {custodian_id}. Asset ready for final recipient pickup."
        )
        db.add(audit)
        
        # Notify final recipient that asset is ready for pickup
        from app.services.notification_service import create_notification
        create_notification(
            db=db,
            user_id=assignment.assigned_to,
            title="Asset Ready for Pickup",
            message=f"Asset '{asset.asset_name}' has been prepared by custodian and is ready for pickup. Please confirm receipt.",
            notification_type="ASSET_READY_PICKUP",
            related_asset_id=asset.asset_id,
        )
        
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
        .order_by(Assignment.assignment_date.desc(), Assignment.assignment_id.desc())
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
        Returns assignments with status Active or Return Requested.
        Used by employee My Assets view.

    Audit log:
        Does not write to audit log.
    """
    return (
        db.query(Assignment)
        .filter(
            Assignment.assigned_to == str(user_id),
            Assignment.status.in_([AssignmentStatus.ACTIVE, AssignmentStatus.RETURN_REQUESTED]),
        )
        .order_by(Assignment.assignment_date.desc(), Assignment.assignment_id.desc())
        .all()
    )


def request_asset_return(db: Session, assignment_id: int, custodian_id: int) -> Assignment:
    """
    Custodian requests return of an asset from the employee.

    Parameters:
        db (Session): Database session.
        assignment_id (int): ID of the assignment to request return for.
        custodian_id (int): ID of the custodian requesting the return.

    Business Rules Enforced:
        - 404 error if the assignment is not found.
        - 422 error if the assignment status is not 'Active'.
        - Only custodians can request returns.

    What's Written to the Audit Log:
        - Creates an AuditLog entry with action='RETURN_REQUESTED', table_affected='assignments',
          record_id=str(assignment_id), and details indicating the return request.

    Status Transition Triggered:
        - Assignment status is updated to 'Return Requested'.
        - Sets return_requested_by and return_requested_at fields.

    Returns:
        Assignment: The updated assignment object.
    """
    assignment = db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    if assignment.status != AssignmentStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Only assignments in 'Active' status can have return requested. Current: {assignment.status}"
        )

    assignment.status = AssignmentStatus.RETURN_REQUESTED
    assignment.return_requested_by = str(custodian_id)
    assignment.return_requested_at = datetime.utcnow()

    audit = AuditLog(
        user_id=str(custodian_id),
        action="RETURN_REQUESTED",
        table_affected="assignments",
        record_id=str(assignment_id),
        details=f"Return requested for assignment {assignment_id} by custodian {custodian_id}."
    )
    db.add(audit)
    db.commit()
    db.refresh(assignment)
    return assignment


def approve_return_request(db: Session, assignment_id: int, employee_id: int) -> Assignment:
    """
    Employee approves the return request, indicating they are ready to return the asset.

    Parameters:
        db (Session): Database session.
        assignment_id (int): ID of the assignment to approve return for.
        employee_id (int): ID of the employee approving the return.

    Business Rules Enforced:
        - 404 error if the assignment is not found.
        - 403 error if the assignment is not assigned to the current user.
        - 422 error if the assignment status is not 'Return Requested'.

    What's Written to the Audit Log:
        - Creates an AuditLog entry with action='RETURN_APPROVED', table_affected='assignments',
          record_id=str(assignment_id), and details indicating approval.

    Status Transition Triggered:
        - Assignment status is updated to 'Return Approved'.
        - Sets return_approved_by and return_approved_at fields.

    Returns:
        Assignment: The updated assignment object.
    """
    assignment = db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    if assignment.assigned_to != str(employee_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to approve this return request."
        )

    if assignment.status != AssignmentStatus.RETURN_REQUESTED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Only assignments in 'Return Requested' status can be approved. Current: {assignment.status}"
        )

    assignment.status = AssignmentStatus.RETURN_APPROVED
    assignment.return_approved_by = str(employee_id)
    assignment.return_approved_at = datetime.utcnow()

    audit = AuditLog(
        user_id=str(employee_id),
        action="RETURN_APPROVED",
        table_affected="assignments",
        record_id=str(assignment_id),
        details=f"Return approved for assignment {assignment_id} by employee {employee_id}."
    )
    db.add(audit)
    db.commit()
    db.refresh(assignment)
    return assignment


def reject_return_request(db: Session, assignment_id: int, employee_id: int, rejection_reason: str = None) -> Assignment:
    """
    Employee rejects the return request.

    Parameters:
        db (Session): Database session.
        assignment_id (int): ID of the assignment to reject return for.
        employee_id (int): ID of the employee rejecting the return.
        rejection_reason (str): Optional reason for rejection.

    Business Rules Enforced:
        - 404 error if the assignment is not found.
        - 403 error if the assignment is not assigned to the current user.
        - 422 error if the assignment status is not 'Return Requested'.

    What's Written to the Audit Log:
        - Creates an AuditLog entry with action='RETURN_REJECTED', table_affected='assignments',
          record_id=str(assignment_id), and details indicating rejection.

    Status Transition Triggered:
        - Assignment status is updated to 'Return Rejected'.
        - Clears return workflow fields.
        - Stores rejection reason if provided.

    Returns:
        Assignment: The updated assignment object.
    """
    assignment = db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    if assignment.assigned_to != str(employee_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to reject this return request."
        )

    if assignment.status != AssignmentStatus.RETURN_REQUESTED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Only assignments in 'Return Requested' status can be rejected. Current: {assignment.status}"
        )

    assignment.status = AssignmentStatus.RETURN_REJECTED
    assignment.return_requested_by = None
    assignment.return_requested_at = None
    assignment.return_rejection_reason = rejection_reason

    audit = AuditLog(
        user_id=str(employee_id),
        action="RETURN_REJECTED",
        table_affected="assignments",
        record_id=str(assignment_id),
        details=f"Return rejected for assignment {assignment_id} by employee {employee_id}. Reason: {rejection_reason or 'Not provided'}"
    )
    db.add(audit)
    db.commit()
    db.refresh(assignment)
    return assignment


def confirm_receipt(db: Session, assignment_id: int, employee_id: int) -> Assignment:
    """
    Employee confirms physical receipt of the asset after custodian handover.

    Parameters:
        db (Session): Database session.
        assignment_id (int): ID of the assignment to confirm receipt for.
        employee_id (int): ID of the employee confirming receipt.

    Business Rules Enforced:
        - 404 error if the assignment is not found.
        - 403 error if the assignment is not assigned to the current user.
        - 422 error if the assignment status is not 'Active' (custodian has confirmed handover).

    What's Written to the Audit Log:
        - Creates an AuditLog entry with action='RECEIPT_CONFIRMED'.

    Status Transition Triggered:
        - Assignment acknowledged_at is updated (confirming employee has the asset).
        - Asset status remains 'Assigned' (already set by confirm_handover).
        - Asset Manager is notified that the asset has been received by the employee.

    Returns:
        Assignment: The updated assignment object.
    """
    assignment = db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    if assignment.assigned_to != str(employee_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to confirm receipt of this assignment."
        )

    if assignment.status != AssignmentStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Only assignments in 'Active' status can have receipt confirmed. Current: {assignment.status}"
        )

    # Mark receipt confirmed timestamp
    assignment.acknowledged_at = datetime.utcnow()

    audit = AuditLog(
        user_id=str(employee_id),
        action="RECEIPT_CONFIRMED",
        table_affected="assignments",
        record_id=str(assignment_id),
        details=f"Receipt confirmed by employee {employee_id} for asset {assignment.asset_id}."
    )
    db.add(audit)

    # Notify Asset Manager and custodian that asset has been received by the employee
    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    from app.services.notification_service import create_notification
    if asset:
        # Notify all Asset Managers
        create_notification(
            db=db,
            user_id="ASSET_MANAGER",
            title="Asset Receipt Confirmed",
            message=f"Employee has confirmed receipt of asset '{asset.asset_name}' ({asset.asset_id}). Assignment #{assignment_id} is now fully active.",
            notification_type="RECEIPT_CONFIRMED",
            related_asset_id=asset.asset_id,
        )
        # Notify the custodian who handled the handover (stored in notes)
        if assignment.notes and "[Custodian:" in assignment.notes:
            import re
            match = re.search(r'\[Custodian: (\d+):', assignment.notes)
            if match:
                custodian_id_from_notes = int(match.group(1))
                create_notification(
                    db=db,
                    user_id=str(custodian_id_from_notes),
                    title="Asset Receipt Confirmed",
                    message=f"The employee has confirmed receipt of asset '{asset.asset_name}' ({asset.asset_id}). Handover is complete.",
                    notification_type="RECEIPT_CONFIRMED",
                    related_asset_id=asset.asset_id,
                )
    else:
        # Asset record missing but still notify managers
        create_notification(
            db=db,
            user_id="ASSET_MANAGER",
            title="Asset Receipt Confirmed",
            message=f"Employee has confirmed receipt of asset (ID: {assignment.asset_id}). Assignment #{assignment_id} is now fully active.",
            notification_type="RECEIPT_CONFIRMED",
            related_asset_id=None,
        )

    db.commit()
    db.refresh(assignment)
    return assignment


def confirm_asset_return(db: Session, assignment_id: int, custodian_id: int) -> Assignment:
    """
    Custodian confirms physical receipt of the returned asset.

    Parameters:
        db (Session): Database session.
        assignment_id (int): ID of the assignment to confirm return for.
        custodian_id (int): ID of the custodian confirming the return.

    Business Rules Enforced:
        - 404 error if the assignment is not found.
        - 422 error if the assignment status is not 'Return Approved'.

    What's Written to the Audit Log:
        - Creates an AuditLog entry with action='RETURN_CONFIRMED', table_affected='assignments',
          record_id=str(assignment_id), and details indicating the return confirmation.

    Status Transition Triggered:
        - Assignment status is updated to 'Returned'.
        - Asset status is updated to 'Available'.
        - Asset's current_custodian_id is cleared (set to None).
        - Assignment return_date is set to current date.

    Transaction Requirement:
        - All database modifications (assignment status, asset status, return_date, audit log)
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

    if assignment.status != AssignmentStatus.RETURN_APPROVED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Only assignments in 'Return Approved' status can be confirmed. Current: {assignment.status}"
        )

    asset = db.query(Asset).filter(Asset.asset_id == assignment.asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found for this assignment."
        )

    try:
        assignment.status = AssignmentStatus.RETURNED
        assignment.return_date = date.today()
        
        validate_status_transition(asset.status, AssetStatus.AVAILABLE)
        asset.status = AssetStatus.AVAILABLE
        asset.current_custodian_id = None

        audit = AuditLog(
            user_id=str(custodian_id),
            action="RETURN_CONFIRMED",
            table_affected="assignments",
            record_id=str(assignment_id),
            details=f"Return confirmed for assignment {assignment_id} by custodian {custodian_id}. Asset {assignment.asset_id} is now Available."
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
