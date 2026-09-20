from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import CursorResult, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from src.core.exceptions import (
    CapacityExceededError,
    InvalidReservationStateError,
    NotFoundError,
    OutsideOpeningHoursError,
    ReservationInPastError,
    SlotConflictError,
)
from src.models import ACTIVE_STATUSES, DiningTable, Reservation, ReservationStatus
from src.models.base import utcnow
from src.schemas import ReservationCreate
from src.services.scheduling import resolve_end, within_opening_hours

EXCLUSION_CONSTRAINT = "no_overlapping_reservations"
CANCELLABLE_STATUSES = (ReservationStatus.PENDING, ReservationStatus.CONFIRMED)


async def _lock_table(session: AsyncSession, table_id: int) -> None:
    """Serialise concurrent bookings of one table for the rest of the transaction.

    Must be the first statement of the transaction. PostgreSQL takes a row lock
    (`SELECT ... FOR UPDATE`); SQLite has no row locks, so a no-op UPDATE acquires
    the database write lock instead. Other writers wait until we commit/rollback.
    """
    if session.get_bind().dialect.name == "sqlite":
        result = await session.execute(
            text("UPDATE tables SET id = id WHERE id = :id"), {"id": table_id}
        )
        found = cast("CursorResult[Any]", result).rowcount > 0
    else:
        locked = await session.execute(
            select(DiningTable.id).where(DiningTable.id == table_id).with_for_update()
        )
        found = locked.first() is not None
    if not found:
        raise NotFoundError(f"Table {table_id} not found")


async def create_reservation(
    session: AsyncSession,
    data: ReservationCreate,
    *,
    min_lead_time_minutes: int = 0,
    now: datetime | None = None,
) -> Reservation:
    """Create a reservation, guaranteeing no overlap with another active one.

    Expects a session with no transaction started yet. Commits on success and
    rolls back (releasing the lock) on any failure.
    """
    now = now or utcnow()
    try:
        await _lock_table(session, data.table_id)

        table = await session.get(
            DiningTable, data.table_id, options=[joinedload(DiningTable.restaurant)]
        )
        if table is None or not table.is_active:
            raise NotFoundError(f"Table {data.table_id} not found")
        restaurant = table.restaurant

        start_at = data.start_at.astimezone(UTC)
        end_at = resolve_end(
            start_at,
            data.end_at.astimezone(UTC) if data.end_at else None,
            restaurant.default_duration_minutes,
        )

        if start_at < now + timedelta(minutes=min_lead_time_minutes):
            raise ReservationInPastError(
                f"Reservations must start at least {min_lead_time_minutes} minutes from now"
            )
        if data.party_size > table.capacity:
            raise CapacityExceededError(
                f"Table {table.label} seats {table.capacity}, party size is {data.party_size}"
            )
        if not within_opening_hours(
            start_at,
            end_at,
            timezone=restaurant.timezone,
            opens_at=restaurant.opens_at,
            closes_at=restaurant.closes_at,
        ):
            raise OutsideOpeningHoursError(
                f"Reservation must fit within opening hours "
                f"{restaurant.opens_at:%H:%M}-{restaurant.closes_at:%H:%M} ({restaurant.timezone})"
            )

        conflict = await session.scalar(
            select(Reservation.id)
            .where(
                Reservation.table_id == table.id,
                Reservation.status.in_(ACTIVE_STATUSES),
                Reservation.start_at < end_at,
                Reservation.end_at > start_at,
            )
            .limit(1)
        )
        if conflict is not None:
            raise SlotConflictError(f"Table {table.label} is already booked for this time")

        reservation = Reservation(
            table_id=table.id,
            start_at=start_at,
            end_at=end_at,
            party_size=data.party_size,
            guest_name=data.guest_name,
            guest_email=str(data.guest_email),
            guest_phone=data.guest_phone,
            notes=data.notes,
            status=ReservationStatus.CONFIRMED,
        )
        session.add(reservation)
        await session.commit()
        return reservation
    except IntegrityError as exc:
        await session.rollback()
        # Database constraint caught what the application check could not.
        if EXCLUSION_CONSTRAINT in str(exc.orig):
            raise SlotConflictError("Table is already booked for this time") from exc
        raise
    except BaseException:
        await session.rollback()
        raise


async def get_reservation(session: AsyncSession, reservation_id: int) -> Reservation:
    reservation = await session.get(Reservation, reservation_id)
    if reservation is None:
        raise NotFoundError(f"Reservation {reservation_id} not found")
    return reservation


async def cancel_reservation(session: AsyncSession, reservation_id: int) -> Reservation:
    reservation = await get_reservation(session, reservation_id)
    if reservation.status not in CANCELLABLE_STATUSES:
        raise InvalidReservationStateError(
            f"Reservation in status '{reservation.status.value}' cannot be cancelled"
        )
    reservation.status = ReservationStatus.CANCELLED
    await session.commit()
    return reservation
