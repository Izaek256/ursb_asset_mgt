from datetime import datetime

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    """Stub schema for the notification system (S3-08).
    
    Used by: GET /api/notifications, GET /api/notifications/{notification_id}, PUT /api/notifications/{notification_id}/read
    Permitted roles: All authenticated users
    Auto-generated fields: notification_id, created_at (included from ORM instance)
    Caller-provided fields: None (this is a response schema)
    Validation rules: None (built from ORM instance)
    """
    notification_id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime
    related_asset_id: str | None = None

    model_config = {"from_attributes": True}
