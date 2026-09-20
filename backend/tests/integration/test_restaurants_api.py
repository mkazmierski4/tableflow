from typing import Any

from httpx import AsyncClient

from tests.conftest import create_restaurant, create_table


async def test_health(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_create_and_get_restaurant(client: AsyncClient) -> None:
    created = await create_restaurant(client, name="Osteria")
    response = await client.get(f"/api/v1/restaurants/{created['id']}")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Osteria"
    assert body["timezone"] == "Europe/Warsaw"
    assert body["opens_at"] == "12:00:00"


async def test_unknown_restaurant_is_404(client: AsyncClient) -> None:
    response = await client.get("/api/v1/restaurants/999")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_invalid_restaurant_is_422(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/restaurants",
        json={"name": "X", "timezone": "Mars/Olympus", "opens_at": "12:00", "closes_at": "20:00"},
    )
    assert response.status_code == 422


async def test_tables_are_listed_and_labels_are_unique(
    client: AsyncClient, venue: dict[str, Any]
) -> None:
    rid = venue["restaurant"]["id"]
    listed = await client.get(f"/api/v1/restaurants/{rid}/tables")
    assert [t["label"] for t in listed.json()] == ["T1", "T2"]

    duplicate = await client.post(
        f"/api/v1/restaurants/{rid}/tables", json={"label": "T1", "capacity": 6}
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "duplicate_table_label"

    # The same label is fine in another restaurant.
    other = await create_restaurant(client, name="Other")
    await create_table(client, other["id"], "T1", 2)


async def test_table_for_unknown_restaurant_is_404(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/restaurants/999/tables", json={"label": "T1", "capacity": 2}
    )
    assert response.status_code == 404
