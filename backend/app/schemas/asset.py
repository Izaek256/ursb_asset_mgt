from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.asset import AssetStatus


class AssetCreate(BaseModel):
    asset_name: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    status: AssetStatus
    purchase_date: date
    purchase_cost: float = Field(gt=0)
    location: str = Field(min_length=1, max_length=255)
    serial_number: Optional[str] = None

    @field_validator("purchase_date")
    @classmethod
    def purchase_date_not_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Purchase date cannot be in the future")
        return v

    @field_validator("asset_name", "category", "location")
    @classmethod
    def strip_and_validate(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty")
        return v


class AssetResponse(BaseModel):
    asset_id: str
    asset_name: str
    category: str
    description: Optional[str] = None
    status: AssetStatus
    purchase_date: Optional[date] = None
    purchase_cost: Optional[float] = None
    location: Optional[str] = None
    serial_number: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
