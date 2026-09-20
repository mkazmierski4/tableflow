from typing import Any

import pytest
from httpx import AsyncClient

from src.models import UserRole
from tests.conftest import MakeUser, TestUser, booking, create_restaurant, create_table

API = "/api/v1"


async def test_health(client: AsyncClient) -> None:
    response = await client.get(f"{API}/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


class TestCreateAndRead:
    async def test_admin_creates_and_anyone_reads(
        self, client: AsyncClient, admin: TestUser
    ) -> None:
        created = await create_restaurant(client, headers=admin.headers, name="Osteria")
        response = await client.get(f"{API}/restaurants/{created['id']}")  # anonymous
        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "Osteria"
        assert body["timezone"] == "Europe/Warsaw"
        assert body["opens_at"] == "12:00:00"

    async def test_only_admins_may_create(
        self, client: AsyncClient, guest: TestUser, make_user: MakeUser, venue: dict[str, Any]
    ) -> None:
        staff = await make_user(UserRole.STAFF, restaurant_id=venue["restaurant"]["id"])
        payload = {"name": "X", "city": "Warsaw", "opens_at": "10:00", "closes_at": "20:00"}

        assert (await client.post(f"{API}/restaurants", json=payload)).status_code == 401
        for user in (guest, staff):
            response = await client.post(f"{API}/restaurants", json=payload, headers=user.headers)
            assert response.status_code == 403

    async def test_unknown_restaurant_is_404(self, client: AsyncClient) -> None:
        response = await client.get(f"{API}/restaurants/999")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"

    async def test_invalid_payload_is_422(self, client: AsyncClient, admin: TestUser) -> None:
        response = await client.post(
            f"{API}/restaurants",
            json={
                "name": "X",
                "city": "Warsaw",
                "timezone": "Mars/Olympus",
                "opens_at": "12:00",
                "closes_at": "20:00",
            },
            headers=admin.headers,
        )
        assert response.status_code == 422


class TestList:
    async def test_is_public_paginated_and_sorted_by_name(
        self, client: AsyncClient, admin: TestUser
    ) -> None:
        for name in ("Charlie", "Alpha", "Bravo"):
            await create_restaurant(client, headers=admin.headers, name=name)

        first = (await client.get(f"{API}/restaurants", params={"limit": 2})).json()
        assert [r["name"] for r in first["items"]] == ["Alpha", "Bravo"]
        assert (first["total"], first["limit"], first["offset"]) == (3, 2, 0)

        second = (await client.get(f"{API}/restaurants", params={"limit": 2, "offset": 2})).json()
        assert [r["name"] for r in second["items"]] == ["Charlie"]

    @pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 101}, {"offset": -1}])
    async def test_rejects_invalid_pagination(
        self, client: AsyncClient, params: dict[str, int]
    ) -> None:
        assert (await client.get(f"{API}/restaurants", params=params)).status_code == 422


class TestCityFilter:
    async def seed(self, client: AsyncClient, admin: TestUser) -> None:
        for name, city in (
            ("Alpha", "Warsaw"),
            ("Bravo", "Kraków"),
            ("Charlie", "Warsaw"),
            ("Delta", "Gdańsk"),
        ):
            await create_restaurant(client, headers=admin.headers, name=name, city=city)

    async def test_lists_distinct_cities_alphabetically(
        self, client: AsyncClient, admin: TestUser
    ) -> None:
        await self.seed(client, admin)
        response = await client.get(f"{API}/restaurants/cities")  # public, not parsed as an id
        assert response.status_code == 200
        assert response.json() == ["Gdańsk", "Kraków", "Warsaw"]

    async def test_no_restaurants_means_no_cities(self, client: AsyncClient) -> None:
        assert (await client.get(f"{API}/restaurants/cities")).json() == []

    async def test_filters_by_city_case_insensitively(
        self, client: AsyncClient, admin: TestUser
    ) -> None:
        await self.seed(client, admin)
        for value in ("Warsaw", "warsaw", "  WARSAW "):
            body = (await client.get(f"{API}/restaurants", params={"city": value})).json()
            assert [r["name"] for r in body["items"]] == ["Alpha", "Charlie"], value
            assert body["total"] == 2
        assert all(r["city"] == "Warsaw" for r in body["items"])

    async def test_filter_composes_with_pagination(
        self, client: AsyncClient, admin: TestUser
    ) -> None:
        await self.seed(client, admin)
        body = (
            await client.get(
                f"{API}/restaurants", params={"city": "Warsaw", "limit": 1, "offset": 1}
            )
        ).json()
        assert [r["name"] for r in body["items"]] == ["Charlie"]
        assert body["total"] == 2

    async def test_unknown_city_is_an_empty_page_not_an_error(
        self, client: AsyncClient, admin: TestUser
    ) -> None:
        await self.seed(client, admin)
        body = (await client.get(f"{API}/restaurants", params={"city": "Atlantis"})).json()
        assert (body["items"], body["total"]) == ([], 0)

    async def test_city_is_required_and_updatable(
        self, client: AsyncClient, admin: TestUser, venue: dict[str, Any]
    ) -> None:
        missing = await client.post(
            f"{API}/restaurants",
            json={"name": "X", "opens_at": "10:00", "closes_at": "20:00"},
            headers=admin.headers,
        )
        assert missing.status_code == 422

        rid = venue["restaurant"]["id"]
        moved = await client.patch(
            f"{API}/restaurants/{rid}", json={"city": "Poznań"}, headers=admin.headers
        )
        assert moved.status_code == 200
        assert moved.json()["city"] == "Poznań"
        assert (await client.get(f"{API}/restaurants/cities")).json() == ["Poznań"]


class TestUpdate:
    async def test_admin_updates_only_the_sent_fields(
        self, client: AsyncClient, admin: TestUser, venue: dict[str, Any]
    ) -> None:
        rid = venue["restaurant"]["id"]
        response = await client.patch(
            f"{API}/restaurants/{rid}",
            json={"name": "Renamed", "closes_at": "23:30"},
            headers=admin.headers,
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["name"] == "Renamed"
        assert body["closes_at"] == "23:30:00"
        assert body["opens_at"] == "12:00:00"  # untouched
        assert body["timezone"] == "Europe/Warsaw"

    async def test_only_admins_may_update(
        self, client: AsyncClient, guest: TestUser, make_user: MakeUser, venue: dict[str, Any]
    ) -> None:
        rid = venue["restaurant"]["id"]
        staff = await make_user(UserRole.STAFF, restaurant_id=rid)
        url = f"{API}/restaurants/{rid}"
        assert (await client.patch(url, json={"name": "X"})).status_code == 401
        for user in (guest, staff):
            assert (
                await client.patch(url, json={"name": "X"}, headers=user.headers)
            ).status_code == 403

    @pytest.mark.parametrize(
        "payload",
        [
            {"timezone": "Mars/Olympus"},
            {"name": None},
            {"name": "   "},
            {"default_duration_minutes": 5},
            {"opens_at": "23:30"},  # merged with existing 23:00 close -> opens after closes
        ],
    )
    async def test_rejects_invalid_changes(
        self, client: AsyncClient, admin: TestUser, venue: dict[str, Any], payload: dict[str, Any]
    ) -> None:
        response = await client.patch(
            f"{API}/restaurants/{venue['restaurant']['id']}", json=payload, headers=admin.headers
        )
        assert response.status_code == 422

    async def test_merged_hours_error_has_a_specific_code(
        self, client: AsyncClient, admin: TestUser, venue: dict[str, Any]
    ) -> None:
        response = await client.patch(
            f"{API}/restaurants/{venue['restaurant']['id']}",
            json={"opens_at": "23:30"},
            headers=admin.headers,
        )
        assert response.json()["error"]["code"] == "invalid_restaurant_update"

    async def test_unknown_restaurant_is_404(self, client: AsyncClient, admin: TestUser) -> None:
        response = await client.patch(
            f"{API}/restaurants/999", json={"name": "X"}, headers=admin.headers
        )
        assert response.status_code == 404

    async def test_changing_hours_leaves_existing_reservations_alone(
        self, client: AsyncClient, admin: TestUser, guest: TestUser, venue: dict[str, Any]
    ) -> None:
        reservation = await client.post(
            f"{API}/reservations", json=booking(venue["big"]["id"]), headers=guest.headers
        )  # 18:00 local
        assert reservation.status_code == 201

        await client.patch(
            f"{API}/restaurants/{venue['restaurant']['id']}",
            json={"opens_at": "19:00"},
            headers=admin.headers,
        )
        fetched = await client.get(
            f"{API}/reservations/{reservation.json()['id']}", headers=guest.headers
        )
        assert fetched.json()["status"] == "confirmed"


class TestTables:
    async def test_admin_adds_and_anyone_lists(
        self, client: AsyncClient, venue: dict[str, Any]
    ) -> None:
        listed = await client.get(f"{API}/restaurants/{venue['restaurant']['id']}/tables")
        assert [t["label"] for t in listed.json()] == ["T1", "T2"]

    async def test_only_admins_may_add(
        self, client: AsyncClient, guest: TestUser, venue: dict[str, Any]
    ) -> None:
        url = f"{API}/restaurants/{venue['restaurant']['id']}/tables"
        payload = {"label": "T9", "capacity": 2}
        assert (await client.post(url, json=payload)).status_code == 401
        assert (await client.post(url, json=payload, headers=guest.headers)).status_code == 403

    async def test_labels_are_unique_per_restaurant(
        self, client: AsyncClient, admin: TestUser, venue: dict[str, Any]
    ) -> None:
        rid = venue["restaurant"]["id"]
        duplicate = await client.post(
            f"{API}/restaurants/{rid}/tables",
            json={"label": "T1", "capacity": 6},
            headers=admin.headers,
        )
        assert duplicate.status_code == 409
        assert duplicate.json()["error"]["code"] == "duplicate_table_label"

        other = await create_restaurant(client, headers=admin.headers, name="Other")
        await create_table(client, other["id"], "T1", 2, headers=admin.headers)  # fine elsewhere

    async def test_unknown_restaurant_is_404(self, client: AsyncClient, admin: TestUser) -> None:
        response = await client.post(
            f"{API}/restaurants/999/tables",
            json={"label": "T1", "capacity": 2},
            headers=admin.headers,
        )
        assert response.status_code == 404
