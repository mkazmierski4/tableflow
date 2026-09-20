from datetime import time
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from src.models.table import DiningTable


class Restaurant(TimestampMixin, Base):
    __tablename__ = "restaurants"
    __table_args__ = (
        CheckConstraint("opens_at < closes_at", name="opens_before_closes"),
        CheckConstraint("default_duration_minutes > 0", name="positive_duration"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    opens_at: Mapped[time]
    closes_at: Mapped[time]
    default_duration_minutes: Mapped[int] = mapped_column(default=90)

    tables: Mapped[list["DiningTable"]] = relationship(
        back_populates="restaurant", cascade="all, delete-orphan"
    )
