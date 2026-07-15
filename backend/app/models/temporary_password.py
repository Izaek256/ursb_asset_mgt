from datetime import datetime, timedelta

from sqlalchemy import Column, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class TemporaryPassword(Base):
    """
    Tracks when a temporary password was issued for a user.
    Does NOT store the plaintext password - only metadata.
    """
    __tablename__ = "temporary_passwords"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(days=7), nullable=False)
    viewed = Column(Integer, default=0, nullable=False)  # Track if password was shown
