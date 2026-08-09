from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class MaintenanceCreate(BaseModel):
    """Schema for recording a maintenance event for an asset.
    
    Used by: POST /api/assets/{asset_id}/maintenance
    Permitted roles: Asset Manager, System Administrator
    Auto-generated fields: maintenance_id (excluded from this schema)
    Caller-provided fields: asset_id, service_date, service_provider, description, cost, next_service_date, recorded_by
    Validation rules: cost must be positive, next_service_date must be after service_date if provided
    """
    asset_id: str = Field(min_length=1, max_length=100)
    service_date: date
    service_provider: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    cost: Decimal = Field(gt=0)
    next_service_date: date | None = None
    recorded_by: str = Field(min_length=1, max_length=36)


class MaintenanceCompleteRequest(BaseModel):
    """Schema for marking a maintenance record as complete.
    
    Used by: PUT /api/assets/{asset_id}/maintenance/{maintenance_id}/complete
    Permitted roles: Asset Manager, System Administrator
    Auto-generated fields: None
    Caller-provided fields: None (empty payload triggers status transition)
    Validation rules: None (triggers asset status transition to Available)
    """
    pass


class MaintenanceResponse(BaseModel):
    """Full maintenance record returned to the client.
    
    Used by: GET /api/assets/{asset_id}/maintenance, POST /api/assets/{asset_id}/maintenance
    Permitted roles: All authenticated users
    Auto-generated fields: maintenance_id (included from ORM instance)
    Caller-provided fields: None (this is a response schema)
    Validation rules: None (built from ORM instance)
    """
    maintenance_id: int
    asset_id: str
    service_date: date
    service_provider: str
    description: str
    cost: Decimal
    next_service_date: date | None
    recorded_by: str

    model_config = {"from_attributes": True}
