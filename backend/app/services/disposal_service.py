from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.disposal_record import DisposalRecord

def get_disposal_or_404(db: Session, disposal_id: int) -> DisposalRecord:
    """
    Fetch a single disposal record by ID, raising a 404 if not found.
    """
    try:
        disposal_id_int = int(disposal_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disposal record not found",
        )
    disposal = db.query(DisposalRecord).filter(DisposalRecord.disposal_id == disposal_id_int).first()
    if not disposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disposal record not found",
        )
    return disposal
