from datetime import date, datetime

from pydantic import BaseModel, Field


class TransferCreate(BaseModel):
    """Schema for initiating an asset transfer between users.
    
    Used by: POST /api/assets/{asset_id}/transfer
    Permitted roles: Asset Manager, System Administrator
    Auto-generated fields: transfer_id, acknowledged_at (excluded from this schema)
    Caller-provided fields: asset_id, from_user_id, to_user_id, transfer_date, reason, authorised_by
    Validation rules: from_user_id and to_user_id must be different users
    """
    asset_id: str = Field(min_length=1, max_length=100)
    from_user_id: str = Field(min_length=1, max_length=36)
    to_user_id: str = Field(min_length=1, max_length=36)
    transfer_date: date
    reason: str = Field(min_length=1)
    authorised_by: str = Field(min_length=1, max_length=36)


class TransferResponse(BaseModel):
    """Full transfer record returned to the client.
    
    Used by: GET /api/assets/{asset_id}/transfers, POST /api/assets/{asset_id}/transfer
    Permitted roles: All authenticated users
    Auto-generated fields: transfer_id, acknowledged_at (included from ORM instance)
    Caller-provided fields: None (this is a response schema)
    Validation rules: None (built from ORM instance)
    """
    transfer_id: int
    asset_id: str
    from_user_id: str
    to_user_id: str
    transfer_date: date
    reason: str
    authorised_by: str
    acknowledged_at: datetime | None

    model_config = {"from_attributes": True}
