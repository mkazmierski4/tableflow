"""Staff book walk-ins: no lead time, but only a short look-back into the past."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from src.core.exceptions import ReservationInPastError
from src.models import User, UserRole
from src.schemas import ReservationCreate
from src.services import reservation_service
from tests.conftest import MakeUser

# 17:10 in Warsaw on a summer day: inside the venue's 12:00-23:00 opening hours.
NOW = datetime(2030, 6, 10, 15, 10, tzinfo=UTC)
LEAD = 30


async def book(
    session_factory: async_sessionmaker[Any],
    user_id: int,
    table_id: int,
    start_at: datetime,
) -> None:
    async with session_factory() as session:
        user = await session.get(User, user_id)
        assert user is not None
        await reservation_service.create_reservation(
            session,
            user,
            ReservationCreate(table_id=table_id, start_at=start_at, party_size=2, guest_name="Kim"),
            min_lead_time_minutes=LEAD,
            now=NOW,
        )


async def test_staff_can_seat_a_walk_in_right_now(
    session_factory: async_sessionmaker[Any], make_user: MakeUser, venue: dict[str, Any]
) -> None:
    staff = await make_user(UserRole.STAFF, restaurant_id=venue["restaurant"]["id"])

    await book(session_factory, staff.id, venue["big"]["id"], NOW + timedelta(minutes=5))
    await book(session_factory, staff.id, venue["small"]["id"], NOW - timedelta(minutes=40))


async def test_staff_cannot_reach_far_into_the_past(
    session_factory: async_sessionmaker[Any], make_user: MakeUser, venue: dict[str, Any]
) -> None:
    staff = await make_user(UserRole.STAFF, restaurant_id=venue["restaurant"]["id"])

    with pytest.raises(ReservationInPastError):
        await book(session_factory, staff.id, venue["big"]["id"], NOW - timedelta(hours=2))


async def test_guests_still_need_the_lead_time(
    session_factory: async_sessionmaker[Any], make_user: MakeUser, venue: dict[str, Any]
) -> None:
    guest = await make_user(UserRole.GUEST)

    with pytest.raises(ReservationInPastError):
        await book(session_factory, guest.id, venue["big"]["id"], NOW + timedelta(minutes=5))
    await book(session_factory, guest.id, venue["big"]["id"], NOW + timedelta(minutes=LEAD))
