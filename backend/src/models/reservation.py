from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    DDL,
    CheckConstraint,
    ForeignKey,
    Index,
    String,
    Text,
    event,
    literal_column,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from src.models.table import DiningTable


class ReservationStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SEATED = "seated"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


# Statuses that occupy a table; only these can conflict with each other.
ACTIVE_STATUSES: tuple[ReservationStatus, ...] = (
    ReservationStatus.PENDING,
    ReservationStatus.CONFIRMED,
    ReservationStatus.SEATED,
)

_ACTIVE_SQL = ", ".join(f"'{s.value}'" for s in ACTIVE_STATUSES)


class Reservation(TimestampMixin, Base):
    __tablename__ = "reservations"
    __table_args__ = (
        CheckConstraint("end_at > start_at", name="end_after_start"),
        CheckConstraint("party_size > 0", name="positive_party_size"),
        Index("ix_reservations_table_id_start_at", "table_id", "start_at"),
        # Last line of defence against double-booking (PostgreSQL only).
        ExcludeConstraint(
            ("table_id", "="),
            (literal_column("tstzrange(start_at, end_at, '[)')"), "&&"),
            where=text(f"status IN ({_ACTIVE_SQL})"),
            using="gist",
            name="no_overlapping_reservations",
        ).ddl_if(dialect="postgresql"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    table_id: Mapped[int] = mapped_column(ForeignKey("tables.id", ondelete="RESTRICT"))
    # Who booked; kept nullable so history survives account deletion.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None, index=True
    )
    start_at: Mapped[datetime]
    end_at: Mapped[datetime]
    party_size: Mapped[int]
    status: Mapped[ReservationStatus] = mapped_column(
        SAEnum(
            ReservationStatus,
            native_enum=False,
            length=16,
            values_callable=lambda e: [m.value for m in e],
            create_constraint=False,
        ),
        default=ReservationStatus.CONFIRMED,
    )
    guest_name: Mapped[str] = mapped_column(String(120))
    guest_email: Mapped[str] = mapped_column(String(254))
    guest_phone: Mapped[str | None] = mapped_column(String(32), default=None)
    notes: Mapped[str | None] = mapped_column(Text, default=None)

    table: Mapped["DiningTable"] = relationship(back_populates="reservations")


# The exclusion constraint on (int, range) needs btree_gist for the `=` on table_id.
event.listen(
    Reservation.__table__,
    "before_create",
    DDL("CREATE EXTENSION IF NOT EXISTS btree_gist").execute_if(dialect="postgresql"),  # type: ignore[no-untyped-call]
)
