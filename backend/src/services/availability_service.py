from datetime import datetime

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import ACTIVE_STATUSES, DiningTable, Reservation
from src.services.restaurant_service import get_restaurant
from src.services.scheduling import resolve_end, within_opening_hours


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
