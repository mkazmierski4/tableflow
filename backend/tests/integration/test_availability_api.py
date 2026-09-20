from typing import Any

import pytest
from httpx import AsyncClient

from tests.conftest import booking

pytestmark = pytest.mark.usefixtures("as_guest")

RESERVATIONS = "/api/v1/reservations"


def availability_url(restaurant_id: int) -> str:
    return f"/api/v1/restaurants/{restaurant_id}/availability"


async def free_labels(
    client: AsyncClient, restaurant_id: int, start: str, party_size: int = 2
) -> list[str]:
    response = await client.get(
        availability_url(restaurant_id), params={"start_at": start, "party_size": party_size}
    )
    assert response.status_code == 200, response.text
    return [t["label"] for t in response.json()["tables"]]


async def test_lists_fitting_tables_smallest_first(
    client: AsyncClient, venue: dict[str, Any]
) -> None:
    rid = venue["restaurant"]["id"]
    start = "2030-06-10T18:00:00+02:00"
    assert await free_labels(client, rid, start, party_size=2) == ["T2", "T1"]  # 2-seat first
    assert await free_labels(client, rid, start, party_size=3) == ["T1"]
    assert await free_labels(client, rid, start, party_size=5) == []


async def test_response_contains_resolved_end(client: AsyncClient, venue: dict[str, Any]) -> None:
    response = await client.get(
        availability_url(venue["restaurant"]["id"]),
        params={"start_at": "2030-06-10T18:00:00+02:00", "party_size": 2},
    )
    body = response.json()
    assert body["end_at"].startswith("2030-06-10T19:30:00")
    assert body["party_size"] == 2


async def test_booked_table_is_excluded_until_cancelled(
    client: AsyncClient, venue: dict[str, Any]
) -> None:
    rid = venue["restaurant"]["id"]
    reservation = (await client.post(RESERVATIONS, json=booking(venue["small"]["id"]))).json()

    assert await free_labels(client, rid, "2030-06-10T18:30:00+02:00") == ["T1"]

    await client.post(f"{RESERVATIONS}/{reservation['id']}/cancel")
    assert await free_labels(client, rid, "2030-06-10T18:30:00+02:00") == ["T2", "T1"]


async def test_adjacent_slot_is_still_free(client: AsyncClient, venue: dict[str, Any]) -> None:
    rid = venue["restaurant"]["id"]
    await client.post(RESERVATIONS, json=booking(venue["small"]["id"]))  # 18:00-19:30
    assert await free_labels(client, rid, "2030-06-10T19:30:00+02:00") == ["T2", "T1"]


async def test_outside_opening_hours_has_no_tables(
    client: AsyncClient, venue: dict[str, Any]
) -> None:
    assert await free_labels(client, venue["restaurant"]["id"], "2030-06-10T08:00:00+02:00") == []


async def test_unknown_restaurant_is_404(client: AsyncClient) -> None:
    response = await client.get(
        availability_url(999), params={"start_at": "2030-06-10T18:00:00+02:00", "party_size": 2}
    )
    assert response.status_code == 404


async def test_invalid_query_is_422(client: AsyncClient, venue: dict[str, Any]) -> None:
    response = await client.get(
        availability_url(venue["restaurant"]["id"]),
        params={"start_at": "2030-06-10T18:00:00", "party_size": 2},  # naive datetime
    )
    assert response.status_code == 422
