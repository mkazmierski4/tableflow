from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from src.core.exceptions import (
    CapacityExceededError,
    DomainError,
    DuplicateTableError,
    InvalidReservationStateError,
    NotFoundError,
    OutsideOpeningHoursError,
    ReservationInPastError,
    SlotConflictError,
)

STATUS_BY_ERROR: dict[type[DomainError], int] = {
    NotFoundError: status.HTTP_404_NOT_FOUND,
    SlotConflictError: status.HTTP_409_CONFLICT,
    InvalidReservationStateError: status.HTTP_409_CONFLICT,
    DuplicateTableError: status.HTTP_409_CONFLICT,
    CapacityExceededError: status.HTTP_422_UNPROCESSABLE_ENTITY,
    OutsideOpeningHoursError: status.HTTP_422_UNPROCESSABLE_ENTITY,
    ReservationInPastError: status.HTTP_422_UNPROCESSABLE_ENTITY,
}


async def domain_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, DomainError)
    return JSONResponse(
        status_code=STATUS_BY_ERROR.get(type(exc), status.HTTP_400_BAD_REQUEST),
        content={"error": {"code": exc.code, "message": exc.message}},
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, domain_error_handler)
