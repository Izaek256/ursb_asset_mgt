import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.hybrid import hybrid_property

from app.db import Base


class UserRole(str, enum.Enum):
    SUPER_SYSTEM_ADMINISTRATOR = "SUPER_SYSTEM_ADMINISTRATOR"  # Has all permissions of Asset Manager plus user account management
    SYSTEM_ADMINISTRATOR = "SYSTEM_ADMINISTRATOR"  # Can create users, view audit logs, read-only access to operations
    ASSET_MANAGER = "ASSET_MANAGER"  # Can register, assign, transfer, dispose assets; approve requests (not own)
    ASSET_CUSTODIAN = "ASSET_CUSTODIAN"  # Can register assets; confirms handover during transfers
    EMPLOYEE = "EMPLOYEE"  # Can submit asset requests; view assigned assets


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
    # Plain-text passwords are never stored - they are generated, returned once to the admin, and discarded
    password_hash = Column(String(length=128), nullable=False)
    password_salt = Column(String(length=128), nullable=False)
    
    # Account status
    is_active = Column(Boolean, nullable=False, default=True)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Stamped whenever a user successfully changes their own password.
    # Used by the credentials page to detect if the generated/temp password is still active.
    password_changed_at = Column(DateTime, nullable=True)

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
    requests_made = relationship(
        "AssetRequest", back_populates="requester", foreign_keys="AssetRequest.requested_by"
    )
    requests_reviewed = relationship(
        "AssetRequest", back_populates="reviewer", foreign_keys="AssetRequest.reviewed_by"
    )
    requests_assigned = relationship(
        "AssetRequest", back_populates="assignee", foreign_keys="AssetRequest.assigned_to"
    )
    audit_logs = relationship("AuditLog", back_populates="user")
    # One-to-one relationship for user settings. uselist=False ensures a single settings row per user.
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")

    @hybrid_property
    def user_id(self):
        return self.id

    @user_id.setter
    def user_id(self, value):
        self.id = value

    @hybrid_property
    def full_name(self):
        parts = [self.first_name, self.last_name]
        return " ".join([p for p in parts if p]).strip()

    @full_name.expression
    @classmethod
    def full_name(cls):
        return func.coalesce(cls.first_name, "") + " " + func.coalesce(cls.last_name, "")

    @full_name.setter
    def full_name(self, value):
        if not value:
            self.first_name = ""
            self.last_name = ""
            return
        parts = value.strip().split(maxsplit=1)
        if len(parts) == 1:
            self.first_name = parts[0]
            self.last_name = ""
        else:
            self.first_name = parts[0]
            self.last_name = parts[1]

