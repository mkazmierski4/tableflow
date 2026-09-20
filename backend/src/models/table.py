from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from src.models.reservation import Reservation
    from src.models.restaurant import Restaurant


class DiningTable(TimestampMixin, Base):
    __tablename__ = "tables"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "label"),
        CheckConstraint("capacity > 0", name="positive_capacity"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(32))
    capacity: Mapped[int]
    is_active: Mapped[bool] = mapped_column(default=True)

    restaurant: Mapped["Restaurant"] = relationship(back_populates="tables")
    reservations: Mapped[list["Reservation"]] = relationship(back_populates="table")
