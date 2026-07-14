import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from app.db import Base

class Notification(Base):
    """
    ORM Model for system in-app notifications.

    Notifications are created only by services as side-effects,
    never directly by API clients or route handlers.
    """
    __tablename__ = "notifications"

    notification_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        nullable=False,
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(100), nullable=False)
    message = Column(String(500), nullable=False)
    notification_type = Column(String(50), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    related_asset_id = Column(
        String(100),
        ForeignKey("assets.asset_id", ondelete="SET NULL"),
        nullable=True,
    )
