import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.models import Reservation, ReservationStatus
from src.schemas import TableUpdate
from src.services import table_service
from src.services.locking import lock_table
from tests.conftest import TestUser, booking

API = "/api/v1"


def table_url(table: dict[str, Any]) -> str:
    return f"{API}/tables/{table['id']}"


async def book(
    client: AsyncClient, user: TestUser, table: dict[str, Any], start: str, **overrides: Any
) -> Any:
    return await client.post(
        f"{API}/reservations", json=booking(table["id"], start, **overrides), headers=user.headers
    )


class TestUpdate:
    async def test_admin_changes_label_and_capacity(
        self, client: AsyncClient, admin: TestUser, venue: dict[str, Any]
    ) -> None:
        response = await client.patch(
            table_url(venue["big"]), json={"label": "Window", "capacity": 6}, headers=admin.headers
        )
        assert response.status_code == 200, response.text
        assert (response.json()["label"], response.json()["capacity"]) == ("Window", 6)

    async def test_only_admins_may_update(
        self, client: AsyncClient, guest: TestUser, venue: dict[str, Any]
    ) -> None:
        url = table_url(venue["big"])
        assert (await client.patch(url, json={"capacity": 5})).status_code == 401
        assert (
            await client.patch(url, json={"capacity": 5}, headers=guest.headers)
        ).status_code == 403

    async def test_duplicate_label_is_a_conflict(
        self, client: AsyncClient, admin: TestUser, venue: dict[str, Any]
    ) -> None:
        response = await client.patch(
            table_url(venue["big"]), json={"label": "T2"}, headers=admin.headers
        )
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "duplicate_table_label"

    async def test_unknown_table_and_null_values(
        self, client: AsyncClient, admin: TestUser, venue: dict[str, Any]
    ) -> None:
        missing = await client.patch(
            f"{API}/tables/999", json={"capacity": 2}, headers=admin.headers
        )
        null = await client.patch(
            table_url(venue["big"]), json={"capacity": None}, headers=admin.headers
        )
        assert missing.status_code == 404
        assert null.status_code == 422

    async def test_capacity_cannot_drop_below_an_upcoming_party(
        self, client: AsyncClient, admin: TestUser, guest: TestUser, venue: dict[str, Any]
    ) -> None:
        big = venue["big"]  # 4 seats
        await book(client, guest, big, "2030-06-10T18:00:00+02:00", party_size=4)

        blocked = await client.patch(table_url(big), json={"capacity": 3}, headers=admin.headers)
        assert blocked.status_code == 409
        assert blocked.json()["error"]["code"] == "table_has_reservations"

        # A larger table, or a change that still fits the party, is fine.
        assert (
            await client.patch(table_url(big), json={"capacity": 8}, headers=admin.headers)
        ).status_code == 200
        assert (
            await client.patch(table_url(big), json={"capacity": 4}, headers=admin.headers)
        ).status_code == 200


class TestDeactivation:
    async def test_blocked_by_upcoming_reservation_until_it_is_cancelled(
        self, client: AsyncClient, admin: TestUser, guest: TestUser, venue: dict[str, Any]
    ) -> None:
        big = venue["big"]
        reservation = (await book(client, guest, big, "2030-06-10T18:00:00+02:00")).json()

        blocked = await client.delete(table_url(big), headers=admin.headers)
        assert blocked.status_code == 409
        assert blocked.json()["error"]["code"] == "table_has_reservations"

        await client.post(f"{API}/reservations/{reservation['id']}/cancel", headers=guest.headers)
        assert (await client.delete(table_url(big), headers=admin.headers)).status_code == 204

    async def test_past_reservations_do_not_block(
        self,
        client: AsyncClient,
        admin: TestUser,
        venue: dict[str, Any],
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        past = datetime.now(UTC) - timedelta(days=30)
        async with session_factory() as session:
            session.add(
                Reservation(
                    table_id=venue["big"]["id"],
                    start_at=past,
                    end_at=past + timedelta(minutes=90),
                    party_size=2,
                    status=ReservationStatus.COMPLETED,
                    guest_name="Old",
                    guest_email="old@example.com",
                )
            )
            await session.commit()

        assert (
            await client.delete(table_url(venue["big"]), headers=admin.headers)
        ).status_code == 204

    async def test_delete_is_a_soft_and_idempotent_operation(
        self, client: AsyncClient, admin: TestUser, venue: dict[str, Any]
    ) -> None:
        url = table_url(venue["big"])
        assert (await client.delete(url, headers=admin.headers)).status_code == 204
        assert (await client.delete(url, headers=admin.headers)).status_code == 204

        listed = await client.get(f"{API}/restaurants/{venue['restaurant']['id']}/tables")
        by_label = {t["label"]: t for t in listed.json()}
        assert by_label["T1"]["is_active"] is False  # still there, just inactive

    async def test_only_admins_may_delete(
        self, client: AsyncClient, guest: TestUser, venue: dict[str, Any]
    ) -> None:
        url = table_url(venue["big"])
        assert (await client.delete(url)).status_code == 401
        assert (await client.delete(url, headers=guest.headers)).status_code == 403

    async def test_inactive_table_is_unavailable_and_unbookable_until_reactivated(
        self, client: AsyncClient, admin: TestUser, guest: TestUser, venue: dict[str, Any]
    ) -> None:
        big, rid = venue["big"], venue["restaurant"]["id"]
        slot = "2030-06-10T18:00:00+02:00"
        await client.patch(table_url(big), json={"is_active": False}, headers=admin.headers)

        availability = await client.get(
            f"{API}/restaurants/{rid}/availability", params={"start_at": slot, "party_size": 3}
        )
        assert availability.json()["tables"] == []
        assert (await book(client, guest, big, slot)).status_code == 404

        await client.patch(table_url(big), json={"is_active": True}, headers=admin.headers)
        assert (await book(client, guest, big, slot)).status_code == 201


async def test_table_changes_wait_for_the_booking_lock(
    session_factory: async_sessionmaker[AsyncSession], venue: dict[str, Any]
) -> None:
    """While a booking holds a table's lock, changes to that table must queue behind it.

    The change is a no-op (same capacity) so it writes nothing itself: the only reason
    it can wait is the lock, which makes this check independent of the database's
    own write serialisation.
    """
    table_id = venue["big"]["id"]
    async with session_factory() as booking_tx, session_factory() as admin_tx:
        await lock_table(booking_tx, table_id)  # a reservation is mid-flight

        change = asyncio.create_task(
            table_service.update_table(
                admin_tx, table_id, TableUpdate(capacity=venue["big"]["capacity"])
            )
        )
        done, _ = await asyncio.wait({change}, timeout=0.5)
        assert not done, "table change ran while the table was locked by a booking"

        await booking_tx.rollback()  # the booking finishes
        table = await asyncio.wait_for(change, timeout=10)
        assert table.capacity == venue["big"]["capacity"]


async def test_deactivation_and_bookings_never_both_win(
    client: AsyncClient, admin: TestUser, guest: TestUser, venue: dict[str, Any]
) -> None:
    """A reservation and the removal of its table can never both succeed."""
    big = venue["big"]
    base = datetime(2030, 6, 10, 10, 0, tzinfo=UTC)
    bookings = [
        book(client, guest, big, (base + timedelta(hours=2 * i)).isoformat()) for i in range(4)
    ]
    removal = client.delete(table_url(big), headers=admin.headers)

    *booked, removed = await asyncio.gather(*bookings, removal)

    created = [r for r in booked if r.status_code == 201]
    if removed.status_code == 204:
        assert created == []  # every booking either lost the race or was refused
    else:
        assert removed.status_code == 409
        assert created  # the removal only fails because a booking got there first
