import enum
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.models.asset import AssetCondition, AssetType, SourceType


class AssetStatus(str, enum.Enum):
    """Expanded asset status enum for schema-level validation.
    
    Note: This enum is defined at the schema level pending ORM model update in S3-03.
    """
    AVAILABLE = "Available"
    RESERVED = "Reserved"
    PENDING_ACCEPTANCE = "Pending Acceptance"
    PENDING_PICKUP = "Pending Pickup"
    ASSIGNED = "Assigned"
    UNDER_TRANSFER = "Under Transfer"
    UNDER_MAINTENANCE = "Under Maintenance"
    RETURNED = "Returned"
    DISPOSED = "Disposed"
    DEACTIVATED = "Deactivated"


class AssetBase(BaseModel):
    """Base schema with shared asset fields.
    
    Used as a base for Create and Response schemas. Captures all SRS AM-R03 mandatory fields.
    """
    asset_name: str = Field(min_length=1, max_length=255)
    asset_type: AssetType
    category: str = Field(min_length=1, max_length=100)
    serial_number: str = Field(min_length=1, max_length=100)
    condition: AssetCondition
    status: AssetStatus
    is_active: bool = True
    source_type: SourceType
    cost: Decimal = Field(gt=0)
    acquisition_date: date
    supplier: str = Field(min_length=1, max_length=255)
    procurement_ref: str | None = Field(None, max_length=100)
    current_custodian_id: str | None = Field(None, max_length=36)
    department: str | None = Field(None, max_length=100)

    @field_validator("acquisition_date")
    @classmethod
    def validate_acquisition_date_not_future(cls, v: date) -> date:
        """Validate that acquisition_date is not in the future."""
        if v > date.today():
            raise ValueError("acquisition_date cannot be in the future")
        return v


class AssetCreate(AssetBase):
    """Schema for creating a new asset via POST /api/assets.
    
    Used by: POST /api/assets
    Permitted roles: Asset Manager, System Administrator
    Auto-generated fields: asset_id, created_at, updated_at (excluded from this schema)
    Caller-provided fields: All fields from AssetBase
    Validation rules: acquisition_date cannot be in the future, cost must be positive
    """


class AssetUpdate(BaseModel):
    """Schema for partial asset updates via PUT /api/assets/{id}.
    
    Used by: PUT /api/assets/{id}
    Permitted roles: Asset Manager, System Administrator
    Auto-generated fields: None (all fields are optional for partial updates)
    Caller-provided fields: All fields optional
    Validation rules: If provided, acquisition_date cannot be in the future, cost must be positive
    """
    asset_name: str | None = Field(None, min_length=1, max_length=255)
    asset_type: AssetType | None = None
    category: str | None = Field(None, min_length=1, max_length=100)
    serial_number: str | None = Field(None, min_length=1, max_length=100)
    condition: AssetCondition | None = None
    status: AssetStatus | None = None
    is_active: bool | None = None
    source_type: SourceType | None = None
    cost: Decimal | None = Field(None, gt=0)
    acquisition_date: date | None = None
    supplier: str | None = Field(None, min_length=1, max_length=255)
    procurement_ref: str | None = Field(None, max_length=100)
    current_custodian_id: str | None = Field(None, max_length=36)
    department: str | None = Field(None, max_length=100)

    @field_validator("acquisition_date")
    @classmethod
    def validate_acquisition_date_not_future_optional(cls, v: date | None) -> date | None:
        """Validate that acquisition_date is not in the future if provided."""
        if v is not None and v > date.today():
            raise ValueError("acquisition_date cannot be in the future")
        return v


class AssetResponse(AssetBase):
    """Full asset representation returned to the client.
    
    Used by: GET /api/assets, GET /api/assets/{id}, POST /api/assets, PUT /api/assets/{id}
    Permitted roles: All authenticated users
    Auto-generated fields: asset_id, created_at, updated_at (included from ORM instance)
    Caller-provided fields: None (this is a response schema)
    Validation rules: None (built from ORM instance)
    """
    asset_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssetListResponse(BaseModel):
    """Paginated list of assets returned to the client.
    
    Used by: GET /api/assets (with pagination)
    Permitted roles: All authenticated users
    Auto-generated fields: total count
    Caller-provided fields: None (this is a response schema)
    Validation rules: None
    """
    items: list[AssetResponse]
    total: int
