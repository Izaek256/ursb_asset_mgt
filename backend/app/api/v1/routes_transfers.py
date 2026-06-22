"""Transfer routes: list asset transfers."""

from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.transfer import Transfer
from app.models.asset import Asset
from app.models.user import User
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/api/transfers", tags=["transfers"])


class TransferOut(BaseModel):
    transfer_id: int
    asset_name: str
    asset_id: str
    from_user: str
    to_user: str
    transfer_date: str
    reason: str
    authorised_by: str
    acknowledged: bool

    class Config:
        from_attributes = True


@router.get("", response_model=List[TransferOut])
def list_transfers(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    transfers = (
        db.query(Transfer)
        .order_by(Transfer.transfer_date.desc())
        .all()
    )

    results = []
    for t in transfers:
        asset = db.query(Asset).filter(Asset.asset_id == t.asset_id).first()
        from_u = db.query(User).filter(User.user_id == t.from_user_id).first()
        to_u = db.query(User).filter(User.user_id == t.to_user_id).first()
        auth_u = db.query(User).filter(User.user_id == t.authorised_by).first()

        results.append(
            TransferOut(
                transfer_id=t.transfer_id,
                asset_name=asset.asset_name if asset else t.asset_id,
                asset_id=t.asset_id,
                from_user=from_u.full_name if from_u else t.from_user_id,
                to_user=to_u.full_name if to_u else t.to_user_id,
                transfer_date=str(t.transfer_date),
                reason=t.reason,
                authorised_by=auth_u.full_name if auth_u else t.authorised_by,
                acknowledged=t.acknowledged_at is not None,
            )
        )
    return results
