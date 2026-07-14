from datetime import date

from pydantic import BaseModel, Field

from app.models.assignment import AssignmentStatus


class AssignmentCreate(BaseModel):
    """Schema for assigning an asset to a user.
    
    Used by: POST /api/assets/{asset_id}/assign
    Permitted roles: Asset Manager, System Administrator
    Auto-generated fields: assignment_id (excluded from this schema)
    Caller-provided fields: asset_id, assigned_to, assigned_by, assignment_date, optional return_date, notes
    Validation rules: return_date must be after assignment_date if provided
    """
    asset_id: str = Field(min_length=1, max_length=100)
    assigned_to: str = Field(min_length=1, max_length=36)
    assigned_by: str = Field(min_length=1, max_length=36)
    assignment_date: date
    return_date: date | None = None
    notes: str | None = None


class AssignmentResponse(BaseModel):
    """Full assignment record returned to the client.
    
    Used by: GET /api/assets/{asset_id}/assignments, POST /api/assets/{asset_id}/assign
    Permitted roles: All authenticated users
    Auto-generated fields: assignment_id (included from ORM instance)
    Caller-provided fields: None (this is a response schema)
    Validation rules: None (built from ORM instance)
    """
    assignment_id: int
    asset_id: str
    assigned_to: str
    assigned_by: str
    assignment_date: date
    return_date: date | None
    status: AssignmentStatus
    notes: str | None

    model_config = {"from_attributes": True}


class AssignmentHistoryResponse(BaseModel):
    """Paginated list of assignment history for an asset.
    
    Used by: GET /api/assets/{asset_id}/assignments/history
    Permitted roles: All authenticated users
    Auto-generated fields: None
    Caller-provided fields: None (this is a response schema)
    Validation rules: None
    """
    items: list[AssignmentResponse]
    total: int
