import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    ASSET_MANAGER = "Asset Manager"
    ASSET_CUSTODIAN = "Asset Custodian"
    EMPLOYEE = "Employee"
    SYSTEM_ADMINISTRATOR = "System Administrator"


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, native_enum=False, length=50), nullable=False
    )
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Relationships
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
