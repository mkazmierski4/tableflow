"""Reservation lifecycle rules (pure, no I/O).

    pending ──► confirmed ──► seated ──► completed
       │            │  └────► no_show   (only once the start time has passed)
       └────────────┴───────► cancelled

`completed`, `cancelled` and `no_show` are final. No transition leads from a final
(inactive) status back to an active one, so a status change can never make a
reservation overlap another and needs no table lock.
"""

from datetime import datetime

from src.core.exceptions import InvalidReservationStateError
from src.models import ReservationStatus

S = ReservationStatus

TRANSITIONS: dict[ReservationStatus, frozenset[ReservationStatus]] = {
    S.PENDING: frozenset({S.CONFIRMED, S.CANCELLED}),
    S.CONFIRMED: frozenset({S.SEATED, S.CANCELLED, S.NO_SHOW}),
    S.SEATED: frozenset({S.COMPLETED}),
    S.COMPLETED: frozenset(),
    S.CANCELLED: frozenset(),
    S.NO_SHOW: frozenset(),
}

# A reservation can only be edited (moved, resized) while it is still upcoming.
EDITABLE_STATUSES: frozenset[ReservationStatus] = frozenset({S.PENDING, S.CONFIRMED})


def validate_transition(
    current: ReservationStatus, target: ReservationStatus, *, start_at: datetime, now: datetime
) -> None:
    if target not in TRANSITIONS[current]:
        allowed = ", ".join(sorted(s.value for s in TRANSITIONS[current])) or "none (final status)"
        raise InvalidReservationStateError(
            f"Cannot change status from '{current.value}' to '{target.value}'; allowed: {allowed}"
        )
    if target == S.NO_SHOW and now < start_at:
        raise InvalidReservationStateError("A reservation cannot be a no-show before it starts")
