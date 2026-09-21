from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient

from tests.conftest import booking

pytestmark = pytest.mark.usefixtures("as_guest")

URL = "/api/v1/reservations"


async def test_create_reservation(client: AsyncClient, venue: dict[str, Any]) -> None:
    response = await client.post(URL, json=booking(venue["big"]["id"]))
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "confirmed"
    # Stored and returned in UTC: 18:00 CEST == 16:00 UTC; default duration is 90 minutes.
    assert datetime.fromisoformat(body["start_at"]) == datetime(2030, 6, 10, 16, tzinfo=UTC)
    assert datetime.fromisoformat(body["end_at"]) == datetime(2030, 6, 10, 17, 30, tzinfo=UTC)

    fetched = await client.get(f"{URL}/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == body


async def test_explicit_end_is_respected(client: AsyncClient, venue: dict[str, Any]) -> None:
    payload = booking(venue["big"]["id"], end_at="2030-06-10T21:00:00+02:00")
    response = await client.post(URL, json=payload)
    assert response.status_code == 201
    assert datetime.fromisoformat(response.json()["end_at"]) == datetime(
        2030, 6, 10, 19, tzinfo=UTC
    )


async def test_identical_slot_conflicts(client: AsyncClient, venue: dict[str, Any]) -> None:
    table_id = venue["big"]["id"]
    assert (await client.post(URL, json=booking(table_id))).status_code == 201

    response = await client.post(URL, json=booking(table_id))
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "slot_conflict"


async def test_partially_overlapping_slot_conflicts(
    client: AsyncClient, venue: dict[str, Any]
) -> None:
    table_id = venue["big"]["id"]
    await client.post(URL, json=booking(table_id, "2030-06-10T18:00:00+02:00"))  # 18:00-19:30

    starts_inside = await client.post(URL, json=booking(table_id, "2030-06-10T19:00:00+02:00"))
    ends_inside = await client.post(URL, json=booking(table_id, "2030-06-10T17:00:00+02:00"))
    assert starts_inside.status_code == 409
    assert ends_inside.status_code == 409  # 17:00-18:30 overlaps 18:00-19:30


async def test_back_to_back_reservations_are_allowed(
    client: AsyncClient, venue: dict[str, Any]
) -> None:
    table_id = venue["big"]["id"]
    first = await client.post(URL, json=booking(table_id, "2030-06-10T18:00:00+02:00"))
    after = await client.post(URL, json=booking(table_id, "2030-06-10T19:30:00+02:00"))
    before = await client.post(URL, json=booking(table_id, "2030-06-10T16:30:00+02:00"))
    assert (first.status_code, after.status_code, before.status_code) == (201, 201, 201)


async def test_same_time_on_different_tables_is_allowed(
    client: AsyncClient, venue: dict[str, Any]
) -> None:
    first = await client.post(URL, json=booking(venue["big"]["id"]))
    second = await client.post(URL, json=booking(venue["small"]["id"]))
    assert (first.status_code, second.status_code) == (201, 201)


async def test_party_larger_than_table_is_rejected(
    client: AsyncClient, venue: dict[str, Any]
) -> None:
    response = await client.post(URL, json=booking(venue["small"]["id"], party_size=3))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "capacity_exceeded"


async def test_outside_opening_hours_is_rejected(
    client: AsyncClient, venue: dict[str, Any]
) -> None:
    table_id = venue["big"]["id"]
    too_early = await client.post(URL, json=booking(table_id, "2030-06-10T11:00:00+02:00"))
    too_late = await client.post(
        URL, json=booking(table_id, "2030-06-10T22:00:00+02:00")
    )  # ends 23:30
    assert too_early.status_code == 422
    assert too_early.json()["error"]["code"] == "outside_opening_hours"
    assert too_late.status_code == 422


async def test_reservation_too_soon_is_rejected(client: AsyncClient, venue: dict[str, Any]) -> None:
    soon = (datetime.now(UTC) + timedelta(minutes=5)).isoformat()
    response = await client.post(URL, json=booking(venue["big"]["id"], soon))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "reservation_too_soon"


async def test_past_reservation_is_rejected(client: AsyncClient, venue: dict[str, Any]) -> None:
    response = await client.post(URL, json=booking(venue["big"]["id"], "2020-01-01T18:00:00+01:00"))
    assert response.status_code == 422


async def test_unknown_table_is_404(client: AsyncClient, venue: dict[str, Any]) -> None:
    response = await client.post(URL, json=booking(9999))
    assert response.status_code == 404


async def test_naive_datetime_is_rejected(client: AsyncClient, venue: dict[str, Any]) -> None:
    response = await client.post(URL, json=booking(venue["big"]["id"], "2030-06-10T18:00:00"))
    assert response.status_code == 422


async def test_cancel_frees_the_slot(client: AsyncClient, venue: dict[str, Any]) -> None:
    table_id = venue["big"]["id"]
    created = (await client.post(URL, json=booking(table_id))).json()
    assert (await client.post(URL, json=booking(table_id))).status_code == 409

    cancelled = await client.post(f"{URL}/{created['id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    assert (await client.post(URL, json=booking(table_id))).status_code == 201


async def test_cancelling_twice_is_a_conflict(client: AsyncClient, venue: dict[str, Any]) -> None:
    created = (await client.post(URL, json=booking(venue["big"]["id"]))).json()
    await client.post(f"{URL}/{created['id']}/cancel")

    again = await client.post(f"{URL}/{created['id']}/cancel")
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "invalid_reservation_state"


async def test_unknown_reservation_is_404(client: AsyncClient) -> None:
    assert (await client.get(f"{URL}/999")).status_code == 404
    assert (await client.post(f"{URL}/999/cancel")).status_code == 404


async def test_every_response_names_the_table_and_restaurant(
    client: AsyncClient, venue: dict[str, Any]
) -> None:
    expected = {
        "table_label": "T1",
        "restaurant_id": venue["restaurant"]["id"],
        "restaurant_name": "Trattoria",
        "restaurant_timezone": "Europe/Warsaw",
    }

    def names(body: dict[str, Any]) -> dict[str, Any]:
        return {key: body[key] for key in expected}

    created = await client.post(URL, json=booking(venue["big"]["id"]))
    assert names(created.json()) == expected
    rid = created.json()["id"]

    assert names((await client.get(f"{URL}/{rid}")).json()) == expected
    assert names((await client.get(URL)).json()["items"][0]) == expected

    moved = await client.patch(f"{URL}/{rid}", json={"start_at": "2030-06-10T20:00:00+02:00"})
    assert names(moved.json()) == expected

    cancelled = await client.post(f"{URL}/{rid}/cancel")
    assert names(cancelled.json()) == expected
