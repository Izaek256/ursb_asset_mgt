import enum
from datetime import date
from typing import Optional

from sqlalchemy import Date, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class DisposalMethod(str, enum.Enum):
    SALE = "Sale"
    WRITE_OFF = "Write-off"
    DONATION = "Donation"
    DESTRUCTION = "Destruction"


class DisposalStatus(str, enum.Enum):
    RECOMMENDED = "Recommended"
    APPROVED = "Approved"
    REJECTED = "Rejected"


class DisposalRecord(Base):
    __tablename__ = "disposal_records"

    disposal_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    asset_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("assets.asset_id", ondelete="RESTRICT"),
        nullable=False,
    )
    disposal_date: Mapped[date] = mapped_column(Date, nullable=False)
    disposal_method: Mapped[DisposalMethod] = mapped_column(
        Enum(DisposalMethod, native_enum=False, length=50, values_callable=lambda x: [e.name for e in x]), nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    authorised_by: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[DisposalStatus] = mapped_column(
        Enum(DisposalStatus, native_enum=False, length=50, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=DisposalStatus.APPROVED,
    )
    recommended_by: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    recommendation_reason: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )

    # Relationships
    asset = relationship("Asset", back_populates="disposal_records")
    authorised_by_user = relationship(
        "User", back_populates="disposals_authorised", foreign_keys=[authorised_by]
    )
