from datetime import date

from sqlalchemy import Date, DECIMAL, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    maintenance_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    asset_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("assets.asset_id", ondelete="RESTRICT"),
        nullable=False,
    )
    service_date: Mapped[date] = mapped_column(Date, nullable=False)
    service_provider: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    cost: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    next_service_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    recorded_by: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.user_id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Relationships
    asset = relationship("Asset", back_populates="maintenance_records")
    recorded_by_user = relationship(
        "User", back_populates="maintenance_records", foreign_keys=[recorded_by]
    )
