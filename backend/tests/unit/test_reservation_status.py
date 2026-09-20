from datetime import UTC, datetime, timedelta

import pytest

from src.core.exceptions import InvalidReservationStateError
from src.models import ReservationStatus
from src.services.reservation_status import EDITABLE_STATUSES, TRANSITIONS, validate_transition

S = ReservationStatus
START = datetime(2030, 6, 10, 16, 0, tzinfo=UTC)
LONG_AFTER_START = START + timedelta(hours=3)

ALLOWED = {
    (S.PENDING, S.CONFIRMED),
    (S.PENDING, S.CANCELLED),
    (S.CONFIRMED, S.SEATED),
    (S.CONFIRMED, S.CANCELLED),
    (S.CONFIRMED, S.NO_SHOW),
    (S.SEATED, S.COMPLETED),
}
ALL_PAIRS = [(a, b) for a in S for b in S]


@pytest.mark.parametrize(("current", "target"), ALL_PAIRS)
def test_every_pair_is_allowed_or_rejected_as_specified(
    current: ReservationStatus, target: ReservationStatus
) -> None:
    if (current, target) in ALLOWED:
        validate_transition(current, target, start_at=START, now=LONG_AFTER_START)
    else:
        with pytest.raises(InvalidReservationStateError):
            validate_transition(current, target, start_at=START, now=LONG_AFTER_START)


@pytest.mark.parametrize("final", [S.COMPLETED, S.CANCELLED, S.NO_SHOW])
def test_final_statuses_have_no_way_out(final: ReservationStatus) -> None:
    assert TRANSITIONS[final] == frozenset()


def test_no_show_only_after_the_start_time() -> None:
    with pytest.raises(InvalidReservationStateError, match="before it starts"):
        validate_transition(
            S.CONFIRMED, S.NO_SHOW, start_at=START, now=START - timedelta(minutes=1)
        )
    validate_transition(S.CONFIRMED, S.NO_SHOW, start_at=START, now=START)  # at the start: fine


def test_every_status_is_covered_by_the_table() -> None:
    assert set(TRANSITIONS) == set(S)


def test_only_upcoming_reservations_are_editable() -> None:
    assert {S.PENDING, S.CONFIRMED} == EDITABLE_STATUSES


def test_the_error_lists_what_is_allowed() -> None:
    with pytest.raises(InvalidReservationStateError) as info:
        validate_transition(S.CONFIRMED, S.COMPLETED, start_at=START, now=START)
    assert "cancelled, no_show, seated" in info.value.message


def test_no_transition_reactivates_an_inactive_reservation() -> None:
    """Guards the lock-free status endpoint: leaving an inactive status could cause overlaps."""
    inactive = {S.COMPLETED, S.CANCELLED, S.NO_SHOW}
    active = {S.PENDING, S.CONFIRMED, S.SEATED}
    for source in inactive:
        assert not (TRANSITIONS[source] & active)
