from datetime import time
from typing import Any, ClassVar

import pytest
from pydantic import ValidationError

from src.schemas import AvailabilityQuery, ReservationCreate, RestaurantCreate, TableCreate

VALID_RESERVATION: dict[str, Any] = {
    "table_id": 1,
    "start_at": "2030-06-10T18:00:00Z",
    "party_size": 2,
    "guest_name": "Ann",
    "guest_email": "ann@example.com",
}


class TestReservationCreate:
    def test_valid_payload(self) -> None:
        data = ReservationCreate.model_validate(VALID_RESERVATION)
        assert data.end_at is None
        assert data.start_at.tzinfo is not None

    def test_guest_name_is_stripped(self) -> None:
        data = ReservationCreate.model_validate({**VALID_RESERVATION, "guest_name": "  Ann  "})
        assert data.guest_name == "Ann"

    @pytest.mark.parametrize(
        "override",
        [
            {"start_at": "2030-06-10T18:00:00"},  # naive datetime
            {"end_at": "2030-06-10T17:00:00Z"},  # end before start
            {"end_at": "2030-06-10T18:00:00Z"},  # end equals start
            {"party_size": 0},
            {"party_size": 101},
            {"party_size": "4"},  # strict: no coercion from strings
            {"guest_email": "not-an-email"},
            {"guest_name": "   "},
        ],
    )
    def test_invalid_payloads(self, override: dict[str, Any]) -> None:
        with pytest.raises(ValidationError):
            ReservationCreate.model_validate({**VALID_RESERVATION, **override})


class TestAvailabilityQuery:
    def test_party_size_is_coerced_from_query_string(self) -> None:
        query = AvailabilityQuery.model_validate(
            {"start_at": "2030-06-10T18:00:00Z", "party_size": "3"}
        )
        assert query.party_size == 3


class TestRestaurantCreate:
    base: ClassVar[dict[str, Any]] = {
        "name": "Bistro",
        "city": "Kraków",
        "opens_at": "10:00",
        "closes_at": "22:00",
    }

    def test_defaults(self) -> None:
        data = RestaurantCreate.model_validate(self.base)
        assert data.timezone == "UTC"
        assert data.default_duration_minutes == 90
        assert data.opens_at == time(10)

    @pytest.mark.parametrize(
        "override",
        [
            {"timezone": "Mars/Olympus"},
            {"opens_at": "22:00", "closes_at": "10:00"},
            {"opens_at": "10:00", "closes_at": "10:00"},
            {"default_duration_minutes": 5},
            {"name": "   "},
            {"city": "   "},
            {"city": ""},
        ],
    )
    def test_invalid(self, override: dict[str, Any]) -> None:
        with pytest.raises(ValidationError):
            RestaurantCreate.model_validate({**self.base, **override})


class TestTableCreate:
    @pytest.mark.parametrize("capacity", [0, -1, 51, "4"])
    def test_invalid_capacity(self, capacity: object) -> None:
        with pytest.raises(ValidationError):
            TableCreate.model_validate({"label": "T1", "capacity": capacity})
