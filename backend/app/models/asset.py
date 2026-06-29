import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    DECIMAL,
    Enum,
    ForeignKey,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class AssetType(str, enum.Enum):
    ICT_EQUIPMENT = "ICT Equipment"
    FURNITURE = "Furniture"
    VEHICLE = "Vehicle"
    SOFTWARE = "Software"
    OTHER = "Other"


class AssetCondition(str, enum.Enum):
    NEW = "New"
    GOOD = "Good"
    REFURBISHED = "Refurbished"
    DAMAGED = "Damaged"


class AssetStatus(str, enum.Enum):
    ACTIVE = "Active"
    IN_STORAGE = "In Storage"
    UNDER_MAINTENANCE = "Under Maintenance"
    DISPOSED = "Disposed"


class SourceType(str, enum.Enum):
    PROCUREMENT = "Procurement"
    DONATION = "Donation"
    OTHER = "Other"


class Asset(Base):
    __tablename__ = "assets"

    asset_id: Mapped[str] = mapped_column(
        String(100), primary_key=True, default=lambda: f"AST-{uuid.uuid4().hex[:8].upper()}"
    )
    asset_name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[AssetType] = mapped_column(
        Enum(AssetType, native_enum=False, length=50), nullable=False
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    serial_number: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True
    )
    condition: Mapped[AssetCondition] = mapped_column(
        Enum(AssetCondition, native_enum=False, length=50), nullable=False
    )
    status: Mapped[AssetStatus] = mapped_column(
        Enum(AssetStatus, native_enum=False, length=50),
        nullable=False,
        default=AssetStatus.ACTIVE,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    source_type: Mapped[SourceType] = mapped_column(
        Enum(SourceType, native_enum=False, length=50), nullable=False
    )
    procurement_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cost: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    acquisition_date: Mapped[date] = mapped_column(Date, nullable=False)
    supplier: Mapped[str] = mapped_column(String(255), nullable=False)
    current_custodian_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    current_custodian = relationship(
        "User", back_populates="assets_as_custodian", foreign_keys=[current_custodian_id]
    )
    assignments = relationship("Assignment", back_populates="asset")
    transfers = relationship("Transfer", back_populates="asset")
    maintenance_records = relationship("MaintenanceRecord", back_populates="asset")
    disposal_records = relationship("DisposalRecord", back_populates="asset")
