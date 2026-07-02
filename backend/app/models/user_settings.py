from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    notifications_email = Column(Boolean, nullable=False, default=True)
    notifications_in_app = Column(Boolean, nullable=False, default=True)
    notifications_maintenance_alerts = Column(Boolean, nullable=False, default=True)
    notifications_transfer_alerts = Column(Boolean, nullable=False, default=True)
    notifications_request_updates = Column(Boolean, nullable=False, default=True)
    theme = Column(String(20), nullable=False, default="light")
    language = Column(String(10), nullable=False, default="en")
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="settings")
