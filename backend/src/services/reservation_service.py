from datetime import UTC, datetime, timedelta

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from src.core.exceptions import (
    CapacityExceededError,
    InvalidReservationStateError,
    InvalidReservationTimeError,
    NotFoundError,
    OutsideOpeningHoursError,
    PermissionDeniedError,
    ReservationInPastError,
    SlotConflictError,
)
from src.models import (
    ACTIVE_STATUSES,
    DiningTable,
    Reservation,
    ReservationStatus,
    User,
    UserRole,
)
from src.models.base import utcnow
from src.schemas import (
    ReservationCreate,
    ReservationFilters,
    ReservationUpdate,
)
from src.services.access import can_access_reservation, can_manage_reservation, reservation_scope
from src.services.locking import lock_table
from src.services.reservation_status import EDITABLE_STATUSES, validate_transition
from src.services.scheduling import resolve_end, within_opening_hours

EXCLUSION_CONSTRAINT = "no_overlapping_reservations"


# --- shared validation -------------------------------------------------------------------


def _ensure_lead_time(start_at: datetime, *, now: datetime, minutes: int) -> None:
    if start_at < now + timedelta(minutes=minutes):
        raise ReservationInPastError(f"Reservations must start at least {minutes} minutes from now")


def _ensure_capacity(table: DiningTable, party_size: int) -> None:
    if party_size > table.capacity:
        raise CapacityExceededError(
            f"Table {table.label} seats {table.capacity}, party size is {party_size}"
        )


def _ensure_within_opening_hours(table: DiningTable, start_at: datetime, end_at: datetime) -> None:
    restaurant = table.restaurant
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


async def _ensure_slot_free(
    session: AsyncSession,
    table: DiningTable,
    start_at: datetime,
    end_at: datetime,
    *,
    ignore_id: int | None = None,
) -> None:
    conditions = [
        Reservation.table_id == table.id,
        Reservation.status.in_(ACTIVE_STATUSES),
        Reservation.start_at < end_at,
        Reservation.end_at > start_at,
    ]
    if ignore_id is not None:
        conditions.append(Reservation.id != ignore_id)
    if await session.scalar(select(Reservation.id).where(*conditions).limit(1)) is not None:
        raise SlotConflictError(f"Table {table.label} is already booked for this time")


def _as_slot_conflict(exc: IntegrityError) -> SlotConflictError | None:
    """The database constraint caught what the application check could not."""
    if EXCLUSION_CONSTRAINT in str(exc.orig):
        return SlotConflictError("Table is already booked for this time")
    return None


# --- create ------------------------------------------------------------------------------


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

        start_at = data.start_at.astimezone(UTC)
        end_at = resolve_end(
            start_at,
            data.end_at.astimezone(UTC) if data.end_at else None,
            table.restaurant.default_duration_minutes,
        )

        _ensure_lead_time(start_at, now=now, minutes=min_lead_time_minutes)
        _ensure_capacity(table, data.party_size)
        _ensure_within_opening_hours(table, start_at, end_at)
        await _ensure_slot_free(session, table, start_at, end_at)

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
        if conflict := _as_slot_conflict(exc):
            raise conflict from exc
        raise
    except BaseException:
        await session.rollback()
        raise


# --- read --------------------------------------------------------------------------------


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


# --- change ------------------------------------------------------------------------------


async def cancel_reservation(
    session: AsyncSession, user: User, reservation_id: int, *, now: datetime | None = None
) -> Reservation:
    reservation = await get_reservation(session, user, reservation_id)
    validate_transition(
        reservation.status,
        ReservationStatus.CANCELLED,
        start_at=reservation.start_at,
        now=now or utcnow(),
    )
    reservation.status = ReservationStatus.CANCELLED
    await session.commit()
    return reservation


async def change_status(
    session: AsyncSession,
    user: User,
    reservation_id: int,
    target: ReservationStatus,
    *,
    now: datetime | None = None,
) -> Reservation:
    """Staff/admin lifecycle changes (see `reservation_status` for the allowed moves)."""
    reservation = await get_reservation(session, user, reservation_id)
    if not can_manage_reservation(user, reservation):
        raise PermissionDeniedError("Only restaurant staff can change a reservation's status")
    validate_transition(
        reservation.status, target, start_at=reservation.start_at, now=now or utcnow()
    )
    reservation.status = target
    await session.commit()
    return reservation


async def update_reservation(
    session: AsyncSession,
    user: User,
    reservation_id: int,
    data: ReservationUpdate,
    *,
    min_lead_time_minutes: int = 0,
    now: datetime | None = None,
) -> Reservation:
    """Reschedule, resize or (staff only) move a reservation to another table.

    The tables involved are locked in ascending id order, so two concurrent moves in
    opposite directions cannot deadlock. Expects a session with no transaction yet.
    """
    now = now or utcnow()
    try:
        # 1. Read-only: permission check and which tables to lock. The read transaction
        #    ends before locking so the lock is the first statement of the next one.
        current = await get_reservation(session, user, reservation_id)
        old_table_id = current.table_id
        old_restaurant_id = current.table.restaurant_id
        target_table_id = data.table_id if data.table_id is not None else old_table_id
        if target_table_id != old_table_id and user.role == UserRole.GUEST:
            raise PermissionDeniedError("Only restaurant staff can move a reservation to a table")
        await session.rollback()

        # 2. Lock, then re-read the now-stable state.
        for table_id in sorted({old_table_id, target_table_id}):
            await lock_table(session, table_id)
        reservation = await session.get(Reservation, reservation_id, populate_existing=True)
        if reservation is None or reservation.table_id != old_table_id:
            raise InvalidReservationStateError(
                "The reservation was changed concurrently; reload it and try again"
            )
        if reservation.status not in EDITABLE_STATUSES:
            raise InvalidReservationStateError(
                f"A reservation in status '{reservation.status.value}' can no longer be changed"
            )
        table = await session.get(
            DiningTable,
            target_table_id,
            options=[joinedload(DiningTable.restaurant)],
            populate_existing=True,
        )
        if table is None or not table.is_active or table.restaurant_id != old_restaurant_id:
            raise NotFoundError(f"Table {target_table_id} not found")

        # 3. Merge the requested changes, keeping the duration when only the start moves.
        start_at = data.start_at.astimezone(UTC) if data.start_at else reservation.start_at
        if data.end_at:
            end_at = data.end_at.astimezone(UTC)
        elif data.start_at:
            end_at = start_at + (reservation.end_at - reservation.start_at)
        else:
            end_at = reservation.end_at
        party_size = data.party_size if data.party_size is not None else reservation.party_size
        if end_at <= start_at:
            raise InvalidReservationTimeError("end_at must be later than start_at")

        # 4. Validate the result the same way a new booking is validated.
        moved_in_time = (start_at, end_at) != (reservation.start_at, reservation.end_at)
        if user.role == UserRole.GUEST and start_at != reservation.start_at:
            _ensure_lead_time(start_at, now=now, minutes=min_lead_time_minutes)
        _ensure_capacity(table, party_size)
        if moved_in_time:
            _ensure_within_opening_hours(table, start_at, end_at)
        if moved_in_time or target_table_id != old_table_id:
            await _ensure_slot_free(session, table, start_at, end_at, ignore_id=reservation.id)

        reservation.table_id = target_table_id
        reservation.start_at = start_at
        reservation.end_at = end_at
        reservation.party_size = party_size
        if "notes" in data.model_fields_set:
            reservation.notes = data.notes
        await session.commit()
        return reservation
    except IntegrityError as exc:
        await session.rollback()
        if conflict := _as_slot_conflict(exc):
            raise conflict from exc
        raise
    except BaseException:
        await session.rollback()
        raise
