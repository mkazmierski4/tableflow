class DomainError(Exception):
    """Base class for business-rule errors; mapped to HTTP in `api/errors.py`."""

    code = "domain_error"

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code


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


class DuplicateTableError(DomainError):
    code = "duplicate_table_label"


class AuthenticationError(DomainError):
    """Missing, invalid or expired credentials (HTTP 401)."""

    code = "invalid_credentials"


class PermissionDeniedError(DomainError):
    """Authenticated, but the role is not allowed to do this (HTTP 403)."""

    code = "forbidden"


class EmailAlreadyRegisteredError(DomainError):
    code = "email_taken"


class TableHasReservationsError(DomainError):
    code = "table_has_reservations"


class InvalidUserUpdateError(DomainError):
    code = "invalid_user_update"


class InvalidRestaurantUpdateError(DomainError):
    code = "invalid_restaurant_update"


class InvalidReservationTimeError(DomainError):
    code = "invalid_time_range"
