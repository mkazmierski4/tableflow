from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.services import availability_service
from tests.conftest import TestUser, booking, create_restaurant, create_table

API = "/api/v1"
DAY = "2030-06-10"  # CEST, UTC+2


def slots_url(restaurant_id: int) -> str:
    return f"{API}/restaurants/{restaurant_id}/availability/slots"


async def get_slots(
    client: AsyncClient, venue: dict[str, Any], party_size: int = 2, day: str = DAY
) -> dict[str, Any]:
    response = await client.get(
        slots_url(venue["restaurant"]["id"]), params={"date": day, "party_size": party_size}
    )
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def by_time(body: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {slot["local_time"]: slot for slot in body["slots"]}


async def book(client: AsyncClient, user: TestUser, table: dict[str, Any], start: str) -> Any:
    return await client.post(
        f"{API}/reservations", json=booking(table["id"], start), headers=user.headers
    )


class TestShape:
    async def test_lists_every_half_hour_that_fits_the_opening_hours(
        self, client: AsyncClient, venue: dict[str, Any]
    ) -> None:
        body = await get_slots(client, venue)  # anonymous: availability is public

        times = [s["local_time"] for s in body["slots"]]
        assert times[0] == "12:00"
        assert times[-1] == "21:30"  # 21:30 + 90 min = 23:00, the closing time
        assert len(times) == 20
        assert (body["date"], body["timezone"]) == (DAY, "Europe/Warsaw")
        assert (body["duration_minutes"], body["party_size"]) == (90, 2)

    async def test_times_are_utc_instants_of_the_local_wall_clock(
        self, client: AsyncClient, venue: dict[str, Any]
    ) -> None:
        first = (await get_slots(client, venue))["slots"][0]
        assert datetime.fromisoformat(first["start_at"]) == datetime(2030, 6, 10, 10, 0, tzinfo=UTC)
        assert datetime.fromisoformat(first["end_at"]) == datetime(2030, 6, 10, 11, 30, tzinfo=UTC)

    async def test_everything_is_free_on_an_empty_day(
        self, client: AsyncClient, venue: dict[str, Any]
    ) -> None:
        slots = (await get_slots(client, venue))["slots"]
        assert all(s["available"] and s["free_tables"] == 2 for s in slots)

    @pytest.mark.parametrize(
        "params",
        [
            {"party_size": 2},
            {"date": DAY},
            {"date": "not-a-date", "party_size": 2},
            {"date": DAY, "party_size": 0},
        ],
    )
    async def test_rejects_invalid_queries(
        self, client: AsyncClient, venue: dict[str, Any], params: dict[str, Any]
    ) -> None:
        response = await client.get(slots_url(venue["restaurant"]["id"]), params=params)
        assert response.status_code == 422

    async def test_unknown_restaurant_is_404(self, client: AsyncClient) -> None:
        response = await client.get(slots_url(999), params={"date": DAY, "party_size": 2})
        assert response.status_code == 404


class TestParty:
    async def test_only_tables_that_fit_are_counted(
        self, client: AsyncClient, venue: dict[str, Any]
    ) -> None:
        three = (await get_slots(client, venue, party_size=3))["slots"]
        assert all(s["free_tables"] == 1 for s in three)  # T1 (4 seats); T2 (2) is too small

        five = (await get_slots(client, venue, party_size=5))["slots"]
        assert all(not s["available"] and s["free_tables"] == 0 for s in five)

    async def test_inactive_tables_do_not_count(
        self, client: AsyncClient, admin: TestUser, venue: dict[str, Any]
    ) -> None:
        await client.delete(f"{API}/tables/{venue['small']['id']}", headers=admin.headers)
        slots = (await get_slots(client, venue))["slots"]
        assert all(s["free_tables"] == 1 for s in slots)


class TestOccupancy:
    async def test_a_reservation_blocks_exactly_the_overlapping_slots(
        self, client: AsyncClient, guest: TestUser, venue: dict[str, Any]
    ) -> None:
        # T1 booked 18:00-19:30: a 2-person party can still use T2.
        assert (
            await book(client, guest, venue["big"], "2030-06-10T18:00:00+02:00")
        ).status_code == 201
        slots = by_time(await get_slots(client, venue))

        assert slots["16:30"]["free_tables"] == 2  # ends 18:00, back-to-back with the booking
        assert slots["17:00"]["free_tables"] == 1  # 17:00-18:30 overlaps
        assert slots["18:00"]["free_tables"] == 1
        assert slots["19:00"]["free_tables"] == 1  # 19:00-20:30 overlaps the last half hour
        assert slots["19:30"]["free_tables"] == 2  # starts when the booking ends

    async def test_a_slot_with_every_table_taken_is_unavailable(
        self, client: AsyncClient, guest: TestUser, venue: dict[str, Any]
    ) -> None:
        for table in (venue["big"], venue["small"]):
            await book(client, guest, table, "2030-06-10T18:00:00+02:00")
        slots = by_time(await get_slots(client, venue))

        assert not slots["18:00"]["available"] and slots["18:00"]["free_tables"] == 0
        assert slots["19:30"]["available"]

    async def test_cancelling_frees_the_slot(
        self, client: AsyncClient, guest: TestUser, venue: dict[str, Any]
    ) -> None:
        created = (await book(client, guest, venue["big"], "2030-06-10T18:00:00+02:00")).json()
        await client.post(f"{API}/reservations/{created['id']}/cancel", headers=guest.headers)
        assert by_time(await get_slots(client, venue))["18:00"]["free_tables"] == 2

    async def test_other_days_are_unaffected(
        self, client: AsyncClient, guest: TestUser, venue: dict[str, Any]
    ) -> None:
        await book(client, guest, venue["big"], "2030-06-10T18:00:00+02:00")
        assert (
            by_time(await get_slots(client, venue, day="2030-06-11"))["18:00"]["free_tables"] == 2
        )


class TestLeadTime:
    async def test_slots_too_close_to_now_are_unavailable(
        self, session_factory: async_sessionmaker[AsyncSession], venue: dict[str, Any]
    ) -> None:
        now = datetime(2030, 6, 10, 12, 0, tzinfo=UTC)  # 14:00 local
        async with session_factory() as session:
            result = await availability_service.list_slots(
                session,
                venue["restaurant"]["id"],
                day=datetime(2030, 6, 10).date(),
                party_size=2,
                min_lead_time_minutes=30,
                now=now,
            )
        slots = {s.local_time: s for s in result.slots}

        assert not slots["14:00"].available and slots["14:00"].free_tables == 0
        assert slots["14:30"].available  # exactly now + 30 minutes is still allowed
        assert not slots["13:30"].available

    async def test_the_past_has_no_availability(
        self, client: AsyncClient, venue: dict[str, Any]
    ) -> None:
        slots = (await get_slots(client, venue, day="2020-01-01"))["slots"]
        assert slots and not any(s["available"] for s in slots)


async def test_daylight_saving_day_neither_repeats_nor_skips_slots(
    client: AsyncClient, admin: TestUser
) -> None:
    """Warsaw jumps from 02:00 to 03:00 on 2030-03-31: there is no 02:xx on that night."""
    restaurant = await create_restaurant(
        client, headers=admin.headers, name="Night owl", opens_at="00:00", closes_at="06:00"
    )
    await create_table(client, restaurant["id"], "N1", 2, headers=admin.headers)

    response = await client.get(
        slots_url(restaurant["id"]), params={"date": "2030-03-31", "party_size": 2}
    )

    times = [s["local_time"] for s in response.json()["slots"]]
    assert times == ["00:00", "00:30", "01:00", "01:30", "03:00", "03:30", "04:00", "04:30"]
