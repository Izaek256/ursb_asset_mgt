import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class AssignmentStatus(str, enum.Enum):
    ACTIVE = "Active"
    RETURNED = "Returned"


class Assignment(Base):
    __tablename__ = "assignments"

    assignment_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    asset_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("assets.asset_id", ondelete="RESTRICT"),
        nullable=False,
    )
    assigned_to: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    assigned_by: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    assignment_date: Mapped[date] = mapped_column(Date, nullable=False)
    return_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[AssignmentStatus] = mapped_column(
        Enum(AssignmentStatus, native_enum=False, length=50),
        nullable=False,
        default=AssignmentStatus.ACTIVE,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    asset = relationship("Asset", back_populates="assignments")
    assigned_to_user = relationship(
        "User", back_populates="assignments_received", foreign_keys=[assigned_to]
    )
    assigned_by_user = relationship(
        "User", back_populates="assignments_made", foreign_keys=[assigned_by]
    )
