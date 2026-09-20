from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from src.core.exceptions import (
    AuthenticationError,
    CapacityExceededError,
    DomainError,
    DuplicateTableError,
    EmailAlreadyRegisteredError,
    InvalidReservationStateError,
    InvalidUserUpdateError,
    NotFoundError,
    OutsideOpeningHoursError,
    PermissionDeniedError,
    ReservationInPastError,
    SlotConflictError,
    TableHasReservationsError,
)

STATUS_BY_ERROR: dict[type[DomainError], int] = {
    NotFoundError: status.HTTP_404_NOT_FOUND,
    SlotConflictError: status.HTTP_409_CONFLICT,
    InvalidReservationStateError: status.HTTP_409_CONFLICT,
    DuplicateTableError: status.HTTP_409_CONFLICT,
    EmailAlreadyRegisteredError: status.HTTP_409_CONFLICT,
    TableHasReservationsError: status.HTTP_409_CONFLICT,
    AuthenticationError: status.HTTP_401_UNAUTHORIZED,
    PermissionDeniedError: status.HTTP_403_FORBIDDEN,
    InvalidUserUpdateError: status.HTTP_422_UNPROCESSABLE_CONTENT,
    CapacityExceededError: status.HTTP_422_UNPROCESSABLE_CONTENT,
    OutsideOpeningHoursError: status.HTTP_422_UNPROCESSABLE_CONTENT,
    ReservationInPastError: status.HTTP_422_UNPROCESSABLE_CONTENT,
}


async def domain_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, DomainError)
    status_code = STATUS_BY_ERROR.get(type(exc), status.HTTP_400_BAD_REQUEST)
    headers = (
        {"WWW-Authenticate": "Bearer"} if status_code == status.HTTP_401_UNAUTHORIZED else None
    )
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
        headers=headers,
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, domain_error_handler)
