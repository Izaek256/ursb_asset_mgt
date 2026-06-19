from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(length=255), unique=True, nullable=False, index=True)
    first_name = Column(String(length=128), nullable=True)
    last_name = Column(String(length=128), nullable=True)
    phone_number = Column(String(length=64), nullable=True)
    department = Column(String(length=128), nullable=True)
    username = Column(String(length=128), unique=True, nullable=True, index=True)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    password_hash = Column(String(length=128), nullable=False)
    password_salt = Column(String(length=128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    sessions = relationship(
        "Session",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
