"""AssetRequest model — tracks the full lifecycle of an asset request."""

import enum
from datetime import date, datetime

from sqlalchemy import (
    Column, DateTime, Date, Enum, ForeignKey, Integer, String, Text
)
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.asset import AssetType


class RequestStatus(str, enum.Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    ASSIGNED = "Assigned"
    READY_FOR_PICKUP = "ReadyForPickup"
    PICKED_UP = "PickedUp"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"


class RequestPriority(str, enum.Enum):
    LOW = "Low"
    NORMAL = "Normal"
    HIGH = "High"
    URGENT = "Urgent"


class AssetRequest(Base):
    __tablename__ = "asset_requests"

    request_id = Column(Integer, primary_key=True, autoincrement=True)

    # Asset being requested — at least one of these must be set
    asset_id = Column(
        String(100),
        ForeignKey("assets.asset_id", ondelete="RESTRICT"),
        nullable=True,
    )
    asset_type = Column(
        Enum(AssetType, native_enum=False, length=50),
        nullable=True,
    )

    # People involved
    requested_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    reviewed_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    assigned_to = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )

    # Status & priority
    status = Column(
        Enum(RequestStatus, native_enum=False, length=20),
        nullable=False,
        default=RequestStatus.PENDING,
    )
    priority = Column(
        Enum(RequestPriority, native_enum=False, length=10),
        nullable=False,
        default=RequestPriority.NORMAL,
    )

    # Details
    reason = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)  # reviewer notes

    # Dates
    requested_date = Column(Date, nullable=False, default=date.today)
    required_by_date = Column(Date, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    handed_over_at = Column(DateTime, nullable=True)
    pickup_confirmed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    # Relationships
    asset = relationship("Asset", foreign_keys=[asset_id])
    requester = relationship("User", foreign_keys=[requested_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    assignee = relationship("User", foreign_keys=[assigned_to])