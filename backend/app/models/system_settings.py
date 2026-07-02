from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class SystemSettings(Base):
    """Singleton table holding global system configuration. Only one row should exist."""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True)
    org_name = Column(String(255), nullable=False, default="Uganda Registration Services Bureau")
    asset_id_prefix = Column(String(20), nullable=False, default="AST")
    session_timeout_hours = Column(Integer, nullable=False, default=24)
    max_failed_logins = Column(Integer, nullable=False, default=3)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, nullable=True)

    updated_by_user = relationship("User")
