from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Transfer(Base):
    __tablename__ = "transfers"

    transfer_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    asset_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("assets.asset_id", ondelete="RESTRICT"),
        nullable=False,
    )
    from_user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    to_user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    transfer_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    authorised_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )

    # Relationships
    asset = relationship("Asset", back_populates="transfers", foreign_keys=[asset_id])
    from_user = relationship(
        "User", back_populates="transfers_from", foreign_keys=[from_user_id]
    )
    to_user = relationship(
        "User", back_populates="transfers_to", foreign_keys=[to_user_id]
    )
    authorised_by_user = relationship(
        "User", back_populates="transfers_authorised", foreign_keys=[authorised_by]
    )
