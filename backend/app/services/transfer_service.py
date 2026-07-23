from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.transfer import Transfer

def get_transfer_or_404(db: Session, transfer_id: int) -> Transfer:
    """
    Fetch a single transfer by ID, raising a 404 if not found.
    """
    try:
        transfer_id_int = int(transfer_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transfer not found",
        )
    transfer = db.query(Transfer).filter(Transfer.transfer_id == transfer_id_int).first()
    if not transfer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transfer not found",
        )
    return transfer
