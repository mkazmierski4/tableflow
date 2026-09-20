"""Concurrency tests: many simultaneous requests must never produce overlapping bookings."""

import asyncio
from datetime import UTC, datetime, timedelta
from itertools import pairwise
from typing import Any

import pytest
from httpx import AsyncClient, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from src.models import Reservation, ReservationStatus
from tests.conftest import booking

pytestmark = pytest.mark.usefixtures("as_guest")

URL = "/api/v1/reservations"
CONCURRENCY = 20


def statuses(responses: list[Response]) -> list[int]:
    return sorted(r.status_code for r in responses)


async def test_same_slot_exactly_one_wins(client: AsyncClient, venue: dict[str, Any]) -> None:
    payload = booking(venue["big"]["id"])
    responses = await asyncio.gather(*(client.post(URL, json=payload) for _ in range(CONCURRENCY)))

    assert statuses(responses) == [201] + [409] * (CONCURRENCY - 1)
    assert {r.json()["error"]["code"] for r in responses if r.status_code == 409} == {
        "slot_conflict"
    }


async def test_staggered_overlapping_slots_exactly_one_wins(
    client: AsyncClient, venue: dict[str, Any]
) -> None:
    # Ten requests starting every 5 minutes; with 90 minute slots every pair overlaps.
    base = datetime(2030, 6, 10, 16, 0, tzinfo=UTC)
    payloads = [
        booking(venue["big"]["id"], (base + timedelta(minutes=5 * i)).isoformat())
        for i in range(10)
    ]
    responses = await asyncio.gather(*(client.post(URL, json=p) for p in payloads))
    assert statuses(responses) == [201] + [409] * 9


async def test_different_tables_do_not_block_each_other(
    client: AsyncClient, venue: dict[str, Any]
) -> None:
    payloads = [booking(venue["big"]["id"]), booking(venue["small"]["id"])] * 5
    responses = await asyncio.gather(*(client.post(URL, json=p) for p in payloads))
    assert statuses(responses) == [201, 201] + [409] * 8


async def test_stored_reservations_never_overlap(
    client: AsyncClient, engine: AsyncEngine, venue: dict[str, Any]
) -> None:
    base = datetime(2030, 6, 10, 10, 0, tzinfo=UTC)  # 12:00 local
    payloads = [
        booking(venue["big"]["id"], (base + timedelta(minutes=15 * i)).isoformat())
        for i in range(30)
    ]
    responses = await asyncio.gather(*(client.post(URL, json=p) for p in payloads))
    assert 201 in statuses(responses)

    async with async_sessionmaker(engine)() as session:
        rows = (await session.execute(Reservation.__table__.select())).all()
    ranges = sorted((r.start_at, r.end_at) for r in rows)
    for (_, prev_end), (next_start, _) in pairwise(ranges):
        assert prev_end <= next_start
    assert len(ranges) == statuses(responses).count(201)


@pytest.mark.postgres
async def test_database_constraint_rejects_overlap_without_the_service(
    engine: AsyncEngine, client: AsyncClient, venue: dict[str, Any], database_url: str
) -> None:
    """Bypass the application entirely: PostgreSQL itself must refuse the overlap."""
    if not database_url.startswith("postgresql"):
        pytest.skip("exclusion constraint is PostgreSQL-only")

    def make(start: datetime, status: ReservationStatus) -> Reservation:
        return Reservation(
            table_id=venue["big"]["id"],
            start_at=start,
            end_at=start + timedelta(minutes=90),
            party_size=2,
            status=status,
            guest_name="Ann",
            guest_email="ann@example.com",
        )

    start = datetime(2030, 6, 10, 16, tzinfo=UTC)
    async with async_sessionmaker(engine)() as session:
        session.add(make(start, ReservationStatus.CONFIRMED))
        await session.commit()

        session.add(make(start + timedelta(minutes=30), ReservationStatus.CONFIRMED))
        with pytest.raises(IntegrityError, match="no_overlapping_reservations"):
            await session.commit()
        await session.rollback()

        # Cancelled reservations do not occupy the table, so they may overlap.
        session.add(make(start + timedelta(minutes=30), ReservationStatus.CANCELLED))
        await session.commit()
