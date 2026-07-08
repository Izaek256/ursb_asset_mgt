from datetime import date

from pydantic import BaseModel, Field

from app.models.disposal_record import DisposalMethod


class DisposalCreate(BaseModel):
    """Schema for direct disposal of an asset by an Asset Manager.
    
    Used by: POST /api/assets/{asset_id}/dispose
    Permitted roles: Asset Manager, System Administrator
    Auto-generated fields: disposal_id (excluded from this schema)
    Caller-provided fields: asset_id, disposal_date, disposal_method, reason, authorised_by
    Validation rules: disposal_date cannot be in the future
    """
    asset_id: str = Field(min_length=1, max_length=100)
    disposal_date: date
    disposal_method: DisposalMethod
    reason: str = Field(min_length=1)
    authorised_by: str = Field(min_length=1, max_length=36)


class DisposalResponse(BaseModel):
    """Full disposal record returned to the client.
    
    Used by: GET /api/assets/{asset_id}/disposals, POST /api/assets/{asset_id}/dispose
    Permitted roles: All authenticated users
    Auto-generated fields: disposal_id (included from ORM instance)
    Caller-provided fields: None (this is a response schema)
    Validation rules: None (built from ORM instance)
    """
    disposal_id: int
    asset_id: str
    disposal_date: date
    disposal_method: DisposalMethod
    reason: str
    authorised_by: str

    model_config = {"from_attributes": True}
