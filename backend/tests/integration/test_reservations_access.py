from dataclasses import dataclass
from typing import Any

import pytest
from httpx import AsyncClient

from src.models import UserRole
from tests.conftest import MakeUser, TestUser, booking, create_restaurant, create_table

API = "/api/v1"
SLOT_1 = "2030-06-10T18:00:00+02:00"
SLOT_2 = "2030-06-11T18:00:00+02:00"
SLOT_3 = "2030-06-12T18:00:00+02:00"


@dataclass
class World:
    """Two restaurants, each with staff, two guests and three reservations.

    - guest1: reservation `g1_a` in restaurant A and `g1_b` in restaurant B
    - guest2: reservation `g2_a` in restaurant A
    """

    admin: TestUser
    staff_a: TestUser
    staff_b: TestUser
    guest1: TestUser
    guest2: TestUser
    table_a1: dict[str, Any]
    table_a2: dict[str, Any]
    table_b1: dict[str, Any]
    g1_a: dict[str, Any]
    g1_b: dict[str, Any]
    g2_a: dict[str, Any]
    restaurant_a: dict[str, Any]
    restaurant_b: dict[str, Any]


@pytest.fixture
async def world(client: AsyncClient, admin: TestUser, make_user: MakeUser) -> World:
    restaurant_a = await create_restaurant(client, headers=admin.headers, name="A")
    restaurant_b = await create_restaurant(client, headers=admin.headers, name="B")
    table_a1 = await create_table(client, restaurant_a["id"], "A1", 4, headers=admin.headers)
    table_a2 = await create_table(client, restaurant_a["id"], "A2", 4, headers=admin.headers)
    table_b1 = await create_table(client, restaurant_b["id"], "B1", 4, headers=admin.headers)

    staff_a = await make_user(UserRole.STAFF, restaurant_id=restaurant_a["id"])
    staff_b = await make_user(UserRole.STAFF, restaurant_id=restaurant_b["id"])
    guest1 = await make_user(UserRole.GUEST)
    guest2 = await make_user(UserRole.GUEST)

    async def book(user: TestUser, table: dict[str, Any], start: str) -> dict[str, Any]:
        response = await client.post(
            f"{API}/reservations", json=booking(table["id"], start), headers=user.headers
        )
        assert response.status_code == 201, response.text
        return dict(response.json())

    return World(
        admin=admin,
        staff_a=staff_a,
        staff_b=staff_b,
        guest1=guest1,
        guest2=guest2,
        table_a1=table_a1,
        table_a2=table_a2,
        table_b1=table_b1,
        g1_a=await book(guest1, table_a1, SLOT_1),
        g1_b=await book(guest1, table_b1, SLOT_2),
        g2_a=await book(guest2, table_a2, SLOT_3),
        restaurant_a=restaurant_a,
        restaurant_b=restaurant_b,
    )


def ids(response: Any) -> list[int]:
    assert response.status_code == 200, response.text
    return [r["id"] for r in response.json()["items"]]


class TestAnonymous:
    async def test_every_reservation_endpoint_requires_login(
        self, client: AsyncClient, world: World
    ) -> None:
        rid = world.g1_a["id"]
        responses = [
            await client.post(f"{API}/reservations", json=booking(world.table_a1["id"])),
            await client.get(f"{API}/reservations"),
            await client.get(f"{API}/reservations/{rid}"),
            await client.post(f"{API}/reservations/{rid}/cancel"),
        ]
        assert [r.status_code for r in responses] == [401, 401, 401, 401]

    async def test_availability_stays_public(self, client: AsyncClient, world: World) -> None:
        response = await client.get(
            f"{API}/restaurants/{world.restaurant_a['id']}/availability",
            params={"start_at": SLOT_1, "party_size": 2},
        )
        assert response.status_code == 200


class TestCreate:
    async def test_records_the_booking_user_and_defaults_guest_details(
        self, client: AsyncClient, world: World
    ) -> None:
        response = await client.post(
            f"{API}/reservations",
            json={
                "table_id": world.table_a1["id"],
                "start_at": "2030-07-01T18:00:00+02:00",
                "party_size": 2,
            },
            headers=world.guest2.headers,
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["user_id"] == world.guest2.id
        assert body["guest_email"] == world.guest2.email
        assert body["guest_name"] == "Test Guest"

    async def test_explicit_guest_details_win(self, client: AsyncClient, world: World) -> None:
        response = await client.post(
            f"{API}/reservations",
            json=booking(world.table_a1["id"], "2030-07-01T18:00:00+02:00", guest_name="Bob"),
            headers=world.guest2.headers,
        )
        assert response.json()["guest_name"] == "Bob"
        assert response.json()["user_id"] == world.guest2.id


class TestGetAndCancel:
    async def test_owner_staff_of_the_venue_and_admin_can_read(
        self, client: AsyncClient, world: World
    ) -> None:
        url = f"{API}/reservations/{world.g1_a['id']}"
        for user in (world.guest1, world.staff_a, world.admin):
            response = await client.get(url, headers=user.headers)
            assert response.status_code == 200, user.role
            assert response.json()["id"] == world.g1_a["id"]

    async def test_others_get_not_found_not_forbidden(
        self, client: AsyncClient, world: World
    ) -> None:
        url = f"{API}/reservations/{world.g1_a['id']}"
        for user in (world.guest2, world.staff_b):  # another guest / staff of another venue
            response = await client.get(url, headers=user.headers)
            assert response.status_code == 404, user.role
            assert response.json()["error"]["code"] == "not_found"

    async def test_others_cannot_cancel(self, client: AsyncClient, world: World) -> None:
        url = f"{API}/reservations/{world.g1_a['id']}/cancel"
        for user in (world.guest2, world.staff_b):
            assert (await client.post(url, headers=user.headers)).status_code == 404

        still = await client.get(
            f"{API}/reservations/{world.g1_a['id']}", headers=world.admin.headers
        )
        assert still.json()["status"] == "confirmed"

    @pytest.mark.parametrize("who", ["guest1", "staff_a", "admin"])
    async def test_owner_staff_and_admin_can_cancel(
        self, client: AsyncClient, world: World, who: str
    ) -> None:
        user: TestUser = getattr(world, who)
        response = await client.post(
            f"{API}/reservations/{world.g1_a['id']}/cancel", headers=user.headers
        )
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "cancelled"


class TestList:
    async def test_each_role_sees_only_its_scope(self, client: AsyncClient, world: World) -> None:
        url = f"{API}/reservations"
        g1_a, g1_b, g2_a = world.g1_a["id"], world.g1_b["id"], world.g2_a["id"]

        assert ids(await client.get(url, headers=world.guest1.headers)) == [g1_a, g1_b]
        assert ids(await client.get(url, headers=world.guest2.headers)) == [g2_a]
        assert ids(await client.get(url, headers=world.staff_a.headers)) == [g1_a, g2_a]
        assert ids(await client.get(url, headers=world.staff_b.headers)) == [g1_b]
        assert ids(await client.get(url, headers=world.admin.headers)) == [g1_a, g1_b, g2_a]

    async def test_filters_cannot_widen_the_scope(self, client: AsyncClient, world: World) -> None:
        # staff of A asking for restaurant B, or a guest asking for someone else's table
        staff = await client.get(
            f"{API}/reservations",
            params={"restaurant_id": world.restaurant_b["id"]},
            headers=world.staff_a.headers,
        )
        guest = await client.get(
            f"{API}/reservations",
            params={"table_id": world.table_a2["id"]},
            headers=world.guest1.headers,
        )
        assert ids(staff) == [] and ids(guest) == []

    async def test_filter_by_restaurant_table_status_and_dates(
        self, client: AsyncClient, world: World
    ) -> None:
        url, admin = f"{API}/reservations", world.admin.headers
        await client.post(f"{url}/{world.g2_a['id']}/cancel", headers=admin)

        by_restaurant = {"restaurant_id": world.restaurant_a["id"]}
        assert ids(await client.get(url, params=by_restaurant, headers=admin)) == [
            world.g1_a["id"],
            world.g2_a["id"],
        ]
        assert ids(
            await client.get(url, params={"table_id": world.table_b1["id"]}, headers=admin)
        ) == [world.g1_b["id"]]
        assert ids(await client.get(url, params={"status": "cancelled"}, headers=admin)) == [
            world.g2_a["id"]
        ]
        window = {"from": "2030-06-11T00:00:00+02:00", "to": "2030-06-12T00:00:00+02:00"}
        assert ids(await client.get(url, params=window, headers=admin)) == [world.g1_b["id"]]

    async def test_pagination_orders_by_start_time(self, client: AsyncClient, world: World) -> None:
        url = f"{API}/reservations"
        page = await client.get(url, params={"limit": 2, "offset": 1}, headers=world.admin.headers)
        body = page.json()
        assert [r["id"] for r in body["items"]] == [world.g1_b["id"], world.g2_a["id"]]
        assert (body["total"], body["limit"], body["offset"]) == (3, 2, 1)

    @pytest.mark.parametrize(
        "params",
        [{"status": "bogus"}, {"from": "2030-06-11T00:00:00"}, {"limit": 0}, {"limit": 1000}],
    )
    async def test_rejects_invalid_query(
        self, client: AsyncClient, world: World, params: dict[str, Any]
    ) -> None:
        response = await client.get(
            f"{API}/reservations", params=params, headers=world.admin.headers
        )
        assert response.status_code == 422
