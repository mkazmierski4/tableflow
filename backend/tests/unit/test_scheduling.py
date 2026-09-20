from datetime import UTC, datetime, time
from typing import Any, ClassVar

import pytest

from src.services.scheduling import intervals_overlap, resolve_end, within_opening_hours


def dt(hour: int, minute: int = 0, day: int = 10) -> datetime:
    return datetime(2030, 6, day, hour, minute, tzinfo=UTC)


class TestIntervalsOverlap:
    @pytest.mark.parametrize(
        ("a", "b", "expected"),
        [
            ((dt(18), dt(19)), (dt(18), dt(19)), True),  # identical
            ((dt(18), dt(20)), (dt(19), dt(21)), True),  # partial overlap
            ((dt(18), dt(22)), (dt(19), dt(20)), True),  # containment
            ((dt(19), dt(20)), (dt(18), dt(19)), False),  # back-to-back
            ((dt(18), dt(19)), (dt(19), dt(20)), False),  # back-to-back, reversed
            ((dt(18), dt(19)), (dt(20), dt(21)), False),  # disjoint
        ],
    )
    def test_cases(
        self, a: tuple[datetime, datetime], b: tuple[datetime, datetime], expected: bool
    ) -> None:
        assert intervals_overlap(*a, *b) is expected
        assert intervals_overlap(*b, *a) is expected  # symmetric


def test_resolve_end_uses_default_duration() -> None:
    assert resolve_end(dt(18), None, 90) == dt(19, 30)
    assert resolve_end(dt(18), dt(20), 90) == dt(20)


class TestOpeningHours:
    kwargs: ClassVar[dict[str, Any]] = {
        "timezone": "Europe/Warsaw",
        "opens_at": time(12),
        "closes_at": time(23),
    }

    def test_inside(self) -> None:
        # 16:00-17:30 UTC == 18:00-19:30 in Warsaw (CEST)
        assert within_opening_hours(dt(16), dt(17, 30), **self.kwargs)

    def test_boundaries_are_inclusive(self) -> None:
        # 12:00-13:30 and 21:30-23:00 local
        assert within_opening_hours(dt(10), dt(11, 30), **self.kwargs)
        assert within_opening_hours(dt(19, 30), dt(21), **self.kwargs)

    def test_before_opening_and_after_closing(self) -> None:
        assert not within_opening_hours(dt(9, 59), dt(11, 29), **self.kwargs)  # 11:59 local
        assert not within_opening_hours(dt(20), dt(21, 1), **self.kwargs)  # ends 23:01 local

    def test_uses_local_time_not_utc(self) -> None:
        # 20:00-21:00 UTC is 22:00-23:00 local: fine. 21:00-22:00 UTC is past closing locally.
        assert within_opening_hours(dt(20), dt(21), **self.kwargs)
        assert not within_opening_hours(dt(21), dt(22), **self.kwargs)

    def test_must_not_span_midnight(self) -> None:
        assert not within_opening_hours(dt(21), dt(23, 30), **self.kwargs)
        assert not within_opening_hours(dt(21, 30), dt(0, 30, day=11), **self.kwargs)
