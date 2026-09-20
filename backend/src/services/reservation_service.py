from datetime import UTC, datetime, timedelta

from sqlalchemy import ColumnElement, func, select
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
from src.models import ACTIVE_STATUSES, DiningTable, Reservation, ReservationStatus, User
from src.models.base import utcnow
from src.schemas import ReservationCreate, ReservationFilters
from src.services.access import can_access_reservation, reservation_scope
from src.services.locking import lock_table
from src.services.scheduling import resolve_end, within_opening_hours

EXCLUSION_CONSTRAINT = "no_overlapping_reservations"
CANCELLABLE_STATUSES = (ReservationStatus.PENDING, ReservationStatus.CONFIRMED)


async def create_reservation(
    session: AsyncSession,
    user: User,
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
        await lock_table(session, data.table_id)

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
            user_id=user.id,
            start_at=start_at,
            end_at=end_at,
            party_size=data.party_size,
            guest_name=data.guest_name or user.full_name,
            guest_email=str(data.guest_email) if data.guest_email else user.email,
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


async def get_reservation(session: AsyncSession, user: User, reservation_id: int) -> Reservation:
    """Load a reservation the user may see; anything else is reported as not found."""
    reservation = await session.scalar(
        select(Reservation)
        .options(joinedload(Reservation.table))
        .where(Reservation.id == reservation_id)
    )
    if reservation is None or not can_access_reservation(user, reservation):
        raise NotFoundError(f"Reservation {reservation_id} not found")
    return reservation


async def list_reservations(
    session: AsyncSession,
    user: User,
    filters: ReservationFilters,
    *,
    limit: int,
    offset: int,
) -> tuple[list[Reservation], int]:
    conditions: list[ColumnElement[bool]] = []
    if (scope := reservation_scope(user)) is not None:
        conditions.append(scope)
    if filters.restaurant_id is not None:
        conditions.append(DiningTable.restaurant_id == filters.restaurant_id)
    if filters.table_id is not None:
        conditions.append(Reservation.table_id == filters.table_id)
    if filters.status is not None:
        conditions.append(Reservation.status == filters.status)
    if filters.from_ is not None:
        conditions.append(Reservation.start_at >= filters.from_)
    if filters.to is not None:
        conditions.append(Reservation.start_at < filters.to)

    base = select(Reservation).join(DiningTable, Reservation.table_id == DiningTable.id)
    total = (
        await session.scalar(
            select(func.count()).select_from(base.where(*conditions).order_by(None).subquery())
        )
        or 0
    )
    result = await session.scalars(
        base.where(*conditions)
        .order_by(Reservation.start_at, Reservation.id)
        .limit(limit)
        .offset(offset)
    )
    return list(result), total


async def cancel_reservation(session: AsyncSession, user: User, reservation_id: int) -> Reservation:
    reservation = await get_reservation(session, user, reservation_id)
    if reservation.status not in CANCELLABLE_STATUSES:
        raise InvalidReservationStateError(
            f"Reservation in status '{reservation.status.value}' cannot be cancelled"
        )
    reservation.status = ReservationStatus.CANCELLED
    await session.commit()
    return reservation
