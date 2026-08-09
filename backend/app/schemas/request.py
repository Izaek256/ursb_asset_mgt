from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.asset import AssetType
from app.models.asset_request import RequestPriority, RequestStatus


class AssetRequestCreate(BaseModel):
    """Schema for an employee submitting an asset request.
    
    Used by: POST /api/requests
    Permitted roles: Employee, Asset Custodian, Asset Manager, System Administrator
    Auto-generated fields: request_id, requested_date, created_at (excluded from this schema)
    Caller-provided fields: asset_type, reason, priority, required_by_date, requested_by
    Validation rules: required_by_date must be in the future if provided
    """
    asset_type: AssetType
    reason: str = Field(min_length=1)
    priority: RequestPriority = RequestPriority.NORMAL
    required_by_date: date | None = None
    requested_by: int


class AssetRequestUpdate(BaseModel):
    """Schema for approving or rejecting an asset request.
    
    Used by: PUT /api/requests/{request_id}
    Permitted roles: Asset Manager, System Administrator
    Auto-generated fields: reviewed_at (excluded from this schema)
    Caller-provided fields: status, notes (for rejection reason)
    Validation rules: status must be APPROVED or REJECTED
    """
    status: RequestStatus
    notes: str | None = Field(None, description="Rejection reason or approval notes")


class AssetRequestResponse(BaseModel):
    """Full asset request record returned to the client.
    
    Used by: GET /api/requests, GET /api/requests/{request_id}, POST /api/requests, PUT /api/requests/{request_id}
    Permitted roles: All authenticated users
    Auto-generated fields: request_id, requested_date, created_at, reviewed_at, assigned_at, pickup_confirmed_at (included from ORM instance)
    Caller-provided fields: None (this is a response schema)
    Validation rules: None (built from ORM instance)
    """
    request_id: int
    asset_id: str | None
    asset_type: AssetType | None
    requested_by: int
    reviewed_by: int | None
    assigned_to: int | None
    status: RequestStatus
    priority: RequestPriority
    reason: str
    notes: str | None
    requested_date: date
    required_by_date: date | None
    reviewed_at: datetime | None
    assigned_at: datetime | None
    pickup_confirmed_at: datetime | None
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}
