from fastapi import HTTPException, status
from app.models.asset import AssetStatus

# A mapping of all valid status transitions.
# Standard: Every transition branch is documented with inline comments specifying the triggering workflow.
VALID_TRANSITIONS = {
    AssetStatus.AVAILABLE: {
        AssetStatus.RESERVED,            # Triggered by assignment offer sent (e.g. Employee offered asset)
        AssetStatus.UNDER_MAINTENANCE,   # Triggered by sending available asset to maintenance
        AssetStatus.DISPOSED,            # Triggered by asset disposal from storage - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating an available asset
        AssetStatus.ASSIGNED,            # Triggered by direct assignment from storage (immediate assign)
    },
    AssetStatus.RESERVED: {
        AssetStatus.PENDING_ACCEPTANCE,  # Triggered by employee notification of request approval - see S3-05
        AssetStatus.AVAILABLE,           # Triggered by cancellation/expiration of assignment offer
        AssetStatus.DISPOSED,            # Triggered by disposing a reserved asset - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating a reserved asset
    },
    AssetStatus.PENDING_ACCEPTANCE: {
        AssetStatus.PENDING_PICKUP,      # Triggered by employee accepting the assignment offer - see S3-05
        AssetStatus.AVAILABLE,           # Triggered by employee declining the assignment offer - see S3-05
        AssetStatus.DISPOSED,            # Triggered by disposing an asset awaiting acceptance - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating an asset awaiting acceptance
    },
    AssetStatus.PENDING_PICKUP: {
        AssetStatus.ASSIGNED,            # Triggered by custodian confirming physical handover - see S3-05
        AssetStatus.AVAILABLE,           # Triggered by cancellation/failure of handover (returns to storage)
        AssetStatus.DISPOSED,            # Triggered by disposing an asset pending pickup - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating an asset pending pickup
    },
    AssetStatus.ASSIGNED: {
        AssetStatus.UNDER_TRANSFER,      # Triggered by custodian initiating a transfer to another custodian - see S3-02
        AssetStatus.RETURNED,            # Triggered by employee returning the asset - see S3-06
        AssetStatus.UNDER_MAINTENANCE,   # Triggered by sending assigned asset to maintenance (custodian requests service)
        AssetStatus.DISPOSED,            # Triggered by disposing an assigned asset (must close assignment) - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating an assigned asset
        AssetStatus.AVAILABLE,           # Triggered by returning asset directly to storage (no intermediate custody change)
    },
    AssetStatus.UNDER_TRANSFER: {
        AssetStatus.ASSIGNED,            # Triggered by target custodian acknowledging custody transfer - see S3-02
        AssetStatus.AVAILABLE,           # Triggered by transfer return/cancellation back to storage
        AssetStatus.UNDER_MAINTENANCE,   # Triggered if asset damaged in transit and redirected to repairs
        AssetStatus.DISPOSED,            # Triggered if asset lost/damaged beyond repair in transit - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating an asset under transfer
    },
    AssetStatus.UNDER_MAINTENANCE: {
        AssetStatus.AVAILABLE,           # Triggered by completing maintenance and returning to storage
        AssetStatus.ASSIGNED,            # Triggered by completing maintenance and returning to original custodian
        AssetStatus.DISPOSED,            # Triggered if maintenance finds asset beyond economic repair - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating an asset under maintenance
    },
    AssetStatus.RETURNED: {
        AssetStatus.AVAILABLE,           # Triggered by custodian confirming return to storage - see S3-06
        AssetStatus.UNDER_MAINTENANCE,   # Triggered by custodian redirecting returned asset to repairs - see S3-06
        AssetStatus.DISPOSED,            # Triggered if returned asset is immediately retired/disposed - see S3-07
        AssetStatus.DEACTIVATED,         # Triggered by deactivating a returned asset
    },
    AssetStatus.DISPOSED: set(),         # Terminal state — no further transitions
    AssetStatus.DEACTIVATED: set(),      # Terminal state — no further transitions
}


def validate_status_transition(current_status: str | AssetStatus, new_status: str | AssetStatus) -> None:
    """Validate if transition between two asset statuses is permitted.

    Valid Transitions:
    - Available -> Reserved, Under Maintenance, Disposed, Deactivated, Assigned
    - Reserved -> Pending Acceptance, Available, Disposed, Deactivated
    - Pending Acceptance -> Pending Pickup, Available, Disposed, Deactivated
    - Pending Pickup -> Assigned, Available, Disposed, Deactivated
    - Assigned -> Under Transfer, Returned, Under Maintenance, Disposed, Deactivated, Available
    - Under Transfer -> Assigned, Available, Under Maintenance, Disposed, Deactivated
    - Under Maintenance -> Available, Assigned, Disposed, Deactivated
    - Returned -> Available, Under Maintenance, Disposed, Deactivated
    - Disposed -> Terminal (No transitions allowed)
    - Deactivated -> Terminal (No transitions allowed)

    Raises:
        HTTPException: HTTP 422 if transition is not permitted.
    """
    # Normalize inputs to raw strings
    curr_str = current_status.value if hasattr(current_status, "value") else str(current_status)
    new_str = new_status.value if hasattr(new_status, "value") else str(new_status)

    # Validate that statuses are known values
    try:
        curr_enum = AssetStatus(curr_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid current asset status: '{curr_str}'"
        )

    try:
        new_enum = AssetStatus(new_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid target asset status: '{new_str}'"
        )

    # Self transition (no-op) is always permitted
    if curr_enum == new_enum:
        return

    # Verify if transition exists in allowed transitions mapping
    allowed = VALID_TRANSITIONS.get(curr_enum, set())
    if new_enum not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid asset status transition from '{curr_str}' to '{new_str}'"
        )
