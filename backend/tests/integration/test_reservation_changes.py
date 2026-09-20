import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient, Response
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.models import Reservation, ReservationStatus, UserRole
from tests.conftest import MakeUser, TestUser, booking, create_restaurant, create_table

API = "/api/v1"
X = "2030-06-10T18:00:00+02:00"  # 18:00-19:30 local (16:00-17:30 UTC)
Y = "2030-06-10T20:00:00+02:00"  # 20:00-21:30 local


@dataclass
class Scene:
    """Restaurant A (`big` 4 seats, `small` 2 seats) and a guest reservation on `big` at X."""

    admin: TestUser
    staff: TestUser  # works at A
    outsider_staff: TestUser  # works at another restaurant
    guest: TestUser  # owns `reservation`
    other_guest: TestUser
    big: dict[str, Any]
    small: dict[str, Any]
    foreign_table: dict[str, Any]  # belongs to the other restaurant
    reservation: dict[str, Any]


@pytest.fixture
async def scene(
    client: AsyncClient, admin: TestUser, venue: dict[str, Any], make_user: MakeUser
) -> Scene:
    other = await create_restaurant(client, headers=admin.headers, name="Elsewhere")
    foreign_table = await create_table(client, other["id"], "F1", 6, headers=admin.headers)
    guest = await make_user(UserRole.GUEST)
    response = await client.post(
        f"{API}/reservations", json=booking(venue["big"]["id"], X), headers=guest.headers
    )
    assert response.status_code == 201, response.text
    return Scene(
        admin=admin,
        staff=await make_user(UserRole.STAFF, restaurant_id=venue["restaurant"]["id"]),
        outsider_staff=await make_user(UserRole.STAFF, restaurant_id=other["id"]),
        guest=guest,
        other_guest=await make_user(UserRole.GUEST),
        big=venue["big"],
        small=venue["small"],
        foreign_table=foreign_table,
        reservation=response.json(),
    )


async def patch(
    client: AsyncClient, user: TestUser, reservation: dict[str, Any], **body: Any
) -> Response:
    return await client.patch(
        f"{API}/reservations/{reservation['id']}", json=body, headers=user.headers
    )


async def set_status(
    client: AsyncClient, user: TestUser, reservation: dict[str, Any], status: str
) -> Response:
    return await client.patch(
        f"{API}/reservations/{reservation['id']}/status",
        json={"status": status},
        headers=user.headers,
    )


async def book(client: AsyncClient, user: TestUser, table: dict[str, Any], start: str) -> Response:
    return await client.post(
        f"{API}/reservations", json=booking(table["id"], start), headers=user.headers
    )


def utc(value: str) -> datetime:
    return datetime.fromisoformat(value).astimezone(UTC)


class TestStatusEndpoint:
    async def test_staff_walks_a_reservation_through_the_lifecycle(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        seated = await set_status(client, scene.staff, scene.reservation, "seated")
        assert seated.status_code == 200, seated.text
        assert seated.json()["status"] == "seated"

        completed = await set_status(client, scene.admin, scene.reservation, "completed")
        assert completed.json()["status"] == "completed"

    async def test_guests_and_anonymous_are_refused(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        url = f"{API}/reservations/{scene.reservation['id']}/status"
        assert (await client.patch(url, json={"status": "seated"})).status_code == 401
        owner = await set_status(client, scene.guest, scene.reservation, "seated")
        assert owner.status_code == 403
        assert owner.json()["error"]["code"] == "forbidden"

    async def test_staff_of_another_venue_gets_not_found(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        response = await set_status(client, scene.outsider_staff, scene.reservation, "seated")
        assert response.status_code == 404

    async def test_illegal_transitions_are_conflicts(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        skip = await set_status(client, scene.staff, scene.reservation, "completed")
        assert skip.status_code == 409
        assert skip.json()["error"]["code"] == "invalid_reservation_state"

        await set_status(client, scene.staff, scene.reservation, "cancelled")
        revive = await set_status(client, scene.staff, scene.reservation, "confirmed")
        assert revive.status_code == 409

    async def test_unknown_status_is_422(self, client: AsyncClient, scene: Scene) -> None:
        assert (
            await set_status(client, scene.staff, scene.reservation, "bogus")
        ).status_code == 422

    async def test_cancelling_through_the_status_endpoint_frees_the_slot(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        assert (await book(client, scene.other_guest, scene.big, X)).status_code == 409
        await set_status(client, scene.staff, scene.reservation, "cancelled")
        assert (await book(client, scene.other_guest, scene.big, X)).status_code == 201

    async def test_no_show_is_only_possible_after_the_start(
        self,
        client: AsyncClient,
        scene: Scene,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        early = await set_status(client, scene.staff, scene.reservation, "no_show")
        assert early.status_code == 409  # starts in 2030

        past = datetime.now(UTC) - timedelta(hours=2)
        async with session_factory() as session:
            started = Reservation(
                table_id=scene.small["id"],
                start_at=past,
                end_at=past + timedelta(minutes=90),
                party_size=2,
                status=ReservationStatus.CONFIRMED,
                guest_name="Late",
                guest_email="late@example.com",
            )
            session.add(started)
            await session.commit()
            started_id = started.id

        late = await set_status(client, scene.staff, {"id": started_id}, "no_show")
        assert late.status_code == 200
        assert late.json()["status"] == "no_show"


class TestReschedule:
    async def test_moving_the_start_keeps_the_duration(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        response = await patch(client, scene.guest, scene.reservation, start_at=Y)
        assert response.status_code == 200, response.text
        body = response.json()
        assert utc(body["start_at"]) == utc(Y)
        assert utc(body["end_at"]) == utc(Y) + timedelta(minutes=90)

    async def test_the_old_slot_is_freed_and_the_new_one_taken(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        await patch(client, scene.guest, scene.reservation, start_at=Y)
        assert (await book(client, scene.other_guest, scene.big, X)).status_code == 201
        assert (await book(client, scene.other_guest, scene.big, Y)).status_code == 409

    async def test_explicit_end_party_size_and_notes(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        response = await patch(
            client,
            scene.guest,
            scene.reservation,
            end_at="2030-06-10T21:00:00+02:00",
            party_size=4,
            notes="window seat",
        )
        body = response.json()
        assert utc(body["end_at"]) == utc("2030-06-10T21:00:00+02:00")
        assert (body["party_size"], body["notes"]) == (4, "window seat")

        cleared = await patch(client, scene.guest, scene.reservation, notes=None)
        assert cleared.json()["notes"] is None

    async def test_a_reservation_may_overlap_its_own_old_slot(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        response = await patch(
            client, scene.guest, scene.reservation, start_at="2030-06-10T18:30:00+02:00"
        )
        assert response.status_code == 200, response.text

    async def test_moving_onto_another_reservation_conflicts(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        await book(client, scene.other_guest, scene.big, Y)
        response = await patch(
            client, scene.guest, scene.reservation, start_at="2030-06-10T19:00:00+02:00"
        )  # 19:00-20:30 overlaps 20:00-21:30
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "slot_conflict"

    @pytest.mark.parametrize(
        ("changes", "code"),
        [
            ({"party_size": 5}, "capacity_exceeded"),
            ({"start_at": "2030-06-10T11:00:00+02:00"}, "outside_opening_hours"),
            ({"start_at": "2030-06-10T22:30:00+02:00"}, "outside_opening_hours"),
            ({"end_at": "2030-06-10T17:00:00+02:00"}, "invalid_time_range"),
        ],
    )
    async def test_rejects_invalid_results(
        self, client: AsyncClient, scene: Scene, changes: dict[str, Any], code: str
    ) -> None:
        response = await patch(client, scene.guest, scene.reservation, **changes)
        assert response.status_code == 422, response.text
        assert response.json()["error"]["code"] == code

    async def test_guests_may_not_move_too_close_to_now(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        soon = (datetime.now(UTC) + timedelta(minutes=5)).isoformat()
        guest = await patch(client, scene.guest, scene.reservation, start_at=soon)
        assert guest.status_code == 422
        assert guest.json()["error"]["code"] == "reservation_too_soon"

    @pytest.mark.parametrize(
        "body", [{}, {"start_at": None}, {"party_size": 0}, {"table_id": None}]
    )
    async def test_rejects_malformed_bodies(
        self, client: AsyncClient, scene: Scene, body: dict[str, Any]
    ) -> None:
        assert (await patch(client, scene.guest, scene.reservation, **body)).status_code == 422

    async def test_end_must_follow_start_in_the_same_body(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        response = await patch(
            client, scene.guest, scene.reservation, start_at=Y, end_at="2030-06-10T19:00:00+02:00"
        )
        assert response.status_code == 422

    async def test_only_upcoming_reservations_can_change(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        await set_status(client, scene.staff, scene.reservation, "seated")
        response = await patch(client, scene.staff, scene.reservation, party_size=3)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "invalid_reservation_state"

    async def test_access_rules(self, client: AsyncClient, scene: Scene) -> None:
        assert (
            await client.patch(f"{API}/reservations/1", json={"party_size": 2})
        ).status_code == 401
        for stranger in (scene.other_guest, scene.outsider_staff):
            response = await patch(client, stranger, scene.reservation, party_size=3)
            assert response.status_code == 404, stranger.role
        for allowed in (scene.staff, scene.admin):
            assert (
                await patch(client, allowed, scene.reservation, party_size=3)
            ).status_code == 200


class TestMoveToAnotherTable:
    async def test_staff_can_move_a_reservation(self, client: AsyncClient, scene: Scene) -> None:
        response = await patch(client, scene.staff, scene.reservation, table_id=scene.small["id"])
        assert response.status_code == 200, response.text
        assert response.json()["table_id"] == scene.small["id"]
        assert (await book(client, scene.other_guest, scene.big, X)).status_code == 201

    async def test_guests_cannot(self, client: AsyncClient, scene: Scene) -> None:
        response = await patch(client, scene.guest, scene.reservation, table_id=scene.small["id"])
        assert response.status_code == 403

    async def test_a_guest_may_repeat_the_current_table(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        response = await patch(
            client, scene.guest, scene.reservation, table_id=scene.big["id"], party_size=3
        )
        assert response.status_code == 200

    async def test_other_restaurants_and_unknown_tables_are_not_found(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        for table_id in (scene.foreign_table["id"], 9999):
            response = await patch(client, scene.staff, scene.reservation, table_id=table_id)
            assert response.status_code == 404

    async def test_target_table_must_be_free_and_large_enough(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        await book(client, scene.other_guest, scene.small, X)
        busy = await patch(client, scene.staff, scene.reservation, table_id=scene.small["id"])
        assert busy.status_code == 409

        await patch(client, scene.staff, scene.reservation, party_size=4)
        too_small = await patch(
            client, scene.staff, scene.reservation, table_id=scene.small["id"], start_at=Y
        )
        assert too_small.status_code == 422
        assert too_small.json()["error"]["code"] == "capacity_exceeded"


class TestConcurrency:
    async def test_two_reschedules_into_the_same_slot_one_wins(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        other = (
            await book(client, scene.other_guest, scene.big, "2030-06-10T13:00:00+02:00")
        ).json()
        responses = await asyncio.gather(
            patch(client, scene.guest, scene.reservation, start_at=Y),
            patch(client, scene.other_guest, other, start_at=Y),
        )
        assert sorted(r.status_code for r in responses) == [200, 409]

    async def test_a_reschedule_and_a_new_booking_race_for_one_slot(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        responses = await asyncio.gather(
            patch(client, scene.guest, scene.reservation, start_at=Y),
            book(client, scene.other_guest, scene.big, Y),
        )
        codes = sorted(r.status_code for r in responses)
        assert codes in ([200, 409], [201, 409]), codes  # exactly one of them got the slot
        # Whatever the order: at most one of them holds the slot afterwards.
        listed = await client.get(
            f"{API}/reservations", params={"table_id": scene.big["id"]}, headers=scene.admin.headers
        )
        starts = [r["start_at"] for r in listed.json()["items"] if r["status"] == "confirmed"]
        assert len(starts) == len(set(starts))

    async def test_opposite_moves_between_two_tables_do_not_deadlock(
        self, client: AsyncClient, scene: Scene
    ) -> None:
        on_small = (await book(client, scene.other_guest, scene.small, Y)).json()
        responses = await asyncio.wait_for(
            asyncio.gather(
                patch(client, scene.staff, scene.reservation, table_id=scene.small["id"]),
                patch(client, scene.staff, on_small, table_id=scene.big["id"]),
            ),
            timeout=30,
        )
        assert [r.status_code for r in responses] == [200, 200]
        assert responses[0].json()["table_id"] == scene.small["id"]
        assert responses[1].json()["table_id"] == scene.big["id"]
