import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class UserRole(str, enum.Enum):
    ASSET_MANAGER = "Asset Manager"
    ASSET_CUSTODIAN = "Asset Custodian"
    EMPLOYEE = "Employee"
    SYSTEM_ADMINISTRATOR = "System Administrator"


class User(Base):
    __tablename__ = "users"

    # Primary key (support both integer and UUID patterns)
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic identity fields
    email = Column(String(length=255), unique=True, nullable=False, index=True)
    username = Column(String(length=128), unique=True, nullable=True, index=True)
    first_name = Column(String(length=128), nullable=True)
    last_name = Column(String(length=128), nullable=True)
    phone_number = Column(String(length=64), nullable=True)
    
    # Department and role
    department = Column(String(length=128), nullable=True)
    role = Column(Enum(UserRole, native_enum=False, length=50), nullable=True)
    
    # Authentication fields
    password_hash = Column(String(length=128), nullable=False)
    password_salt = Column(String(length=128), nullable=False)
    
    # Account status
    is_active = Column(Boolean, nullable=False, default=True)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Authentication relationship
    sessions = relationship(
        "Session",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    
    # Asset management relationships
    assets_as_custodian = relationship(
        "Asset", back_populates="current_custodian", foreign_keys="Asset.current_custodian_id"
    )
    assignments_received = relationship(
        "Assignment", back_populates="assigned_to_user", foreign_keys="Assignment.assigned_to"
    )
    assignments_made = relationship(
        "Assignment", back_populates="assigned_by_user", foreign_keys="Assignment.assigned_by"
    )
    transfers_from = relationship(
        "Transfer", back_populates="from_user", foreign_keys="Transfer.from_user_id"
    )
    transfers_to = relationship(
        "Transfer", back_populates="to_user", foreign_keys="Transfer.to_user_id"
    )
    transfers_authorised = relationship(
        "Transfer", back_populates="authorised_by_user", foreign_keys="Transfer.authorised_by"
    )
    maintenance_records = relationship(
        "MaintenanceRecord", back_populates="recorded_by_user", foreign_keys="MaintenanceRecord.recorded_by"
    )
    disposals_authorised = relationship(
        "DisposalRecord", back_populates="authorised_by_user", foreign_keys="DisposalRecord.authorised_by"
    )
    audit_logs = relationship("AuditLog", back_populates="user")

