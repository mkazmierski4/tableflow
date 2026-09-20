class DomainError(Exception):
    """Base class for business-rule errors; mapped to HTTP in `api/errors.py`."""

    code = "domain_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(DomainError):
    code = "not_found"


class SlotConflictError(DomainError):
    """The table is already booked for an overlapping time range."""

    code = "slot_conflict"


class CapacityExceededError(DomainError):
    code = "capacity_exceeded"


class OutsideOpeningHoursError(DomainError):
    code = "outside_opening_hours"


class ReservationInPastError(DomainError):
    code = "reservation_too_soon"


class InvalidReservationStateError(DomainError):
    code = "invalid_reservation_state"
