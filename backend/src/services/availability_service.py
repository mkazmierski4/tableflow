from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import ACTIVE_STATUSES, DiningTable, Reservation
from src.models.base import utcnow
from src.schemas import SlotRead, SlotsRead
from src.services.restaurant_service import get_restaurant
from src.services.scheduling import intervals_overlap, resolve_end, within_opening_hours

SLOT_STEP_MINUTES = 30


async def find_available_tables(
    session: AsyncSession,
    restaurant_id: int,
    *,
    start_at: datetime,
    end_at: datetime | None,
    party_size: int,
) -> tuple[datetime, datetime, list[DiningTable]]:
    """Free tables that fit the party, smallest first.

    A slot outside opening hours simply has no tables. This is a read-only hint:
    the authoritative check happens (under lock) when the reservation is created.
    """
    restaurant = await get_restaurant(session, restaurant_id)
    end_at = resolve_end(start_at, end_at, restaurant.default_duration_minutes)

    if not within_opening_hours(
        start_at,
        end_at,
        timezone=restaurant.timezone,
        opens_at=restaurant.opens_at,
        closes_at=restaurant.closes_at,
    ):
        return start_at, end_at, []

    booked = exists().where(
        Reservation.table_id == DiningTable.id,
        Reservation.status.in_(ACTIVE_STATUSES),
        Reservation.start_at < end_at,
        Reservation.end_at > start_at,
    )
    result = await session.scalars(
        select(DiningTable)
        .where(
            DiningTable.restaurant_id == restaurant_id,
            DiningTable.is_active.is_(True),
            DiningTable.capacity >= party_size,
            ~booked,
        )
        .order_by(DiningTable.capacity, DiningTable.label)
    )
    return start_at, end_at, list(result)


async def list_slots(
    session: AsyncSession,
    restaurant_id: int,
    *,
    day: date,
    party_size: int,
    min_lead_time_minutes: int = 0,
    now: datetime | None = None,
) -> SlotsRead:
    """Bookable start times for one local day, every `SLOT_STEP_MINUTES`.

    A slot lasts the restaurant's default duration and must fit its opening hours.
    `available` means at least one active table that fits the party is free for the whole
    slot and the slot starts far enough ahead (the same rule a booking enforces).
    """
    restaurant = await get_restaurant(session, restaurant_id)
    now = now or utcnow()
    tz = ZoneInfo(restaurant.timezone)
    duration = timedelta(minutes=restaurant.default_duration_minutes)
    step = timedelta(minutes=SLOT_STEP_MINUTES)

    # Step in absolute (UTC) time so a daylight-saving change never repeats or skips a slot.
    cursor = datetime.combine(day, restaurant.opens_at, tzinfo=tz).astimezone(UTC)
    last_end = datetime.combine(day, restaurant.closes_at, tzinfo=tz).astimezone(UTC)
    windows: list[tuple[datetime, datetime]] = []
    while cursor + duration <= last_end:
        if within_opening_hours(
            cursor,
            cursor + duration,
            timezone=restaurant.timezone,
            opens_at=restaurant.opens_at,
            closes_at=restaurant.closes_at,
        ):
            windows.append((cursor, cursor + duration))
        cursor += step

    table_ids = list(
        await session.scalars(
            select(DiningTable.id).where(
                DiningTable.restaurant_id == restaurant_id,
                DiningTable.is_active.is_(True),
                DiningTable.capacity >= party_size,
            )
        )
    )
    busy: dict[int, list[tuple[datetime, datetime]]] = {table_id: [] for table_id in table_ids}
    if windows and table_ids:
        rows = await session.execute(
            select(Reservation.table_id, Reservation.start_at, Reservation.end_at).where(
                Reservation.table_id.in_(table_ids),
                Reservation.status.in_(ACTIVE_STATUSES),
                Reservation.start_at < windows[-1][1],
                Reservation.end_at > windows[0][0],
            )
        )
        for table_id, start_at, end_at in rows:
            busy[table_id].append((start_at, end_at))

    earliest = now + timedelta(minutes=min_lead_time_minutes)
    slots: list[SlotRead] = []
    for start_at, end_at in windows:
        free = sum(
            not any(intervals_overlap(start_at, end_at, b_start, b_end) for b_start, b_end in taken)
            for taken in busy.values()
        )
        bookable_in_time = start_at >= earliest
        slots.append(
            SlotRead(
                start_at=start_at,
                end_at=end_at,
                local_time=start_at.astimezone(tz).strftime("%H:%M"),
                available=free > 0 and bookable_in_time,
                free_tables=free if bookable_in_time else 0,
            )
        )

    return SlotsRead(
        date=day,
        timezone=restaurant.timezone,
        duration_minutes=restaurant.default_duration_minutes,
        party_size=party_size,
        slots=slots,
    )
