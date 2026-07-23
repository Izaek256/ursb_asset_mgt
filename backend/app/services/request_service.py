from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.asset_request import AssetRequest

def get_request_or_404(db: Session, request_id: int) -> AssetRequest:
    """
    Fetch a single asset request by ID, raising a 404 if not found.
    """
    try:
        request_id_int = int(request_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )
    request = db.query(AssetRequest).filter(AssetRequest.request_id == request_id_int).first()
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )
    return request
