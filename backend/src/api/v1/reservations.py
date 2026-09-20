from fastapi import APIRouter, status

from src.api.deps import CurrentUser, SessionDep, SettingsDep, StaffUser
from src.schemas import (
    Page,
    Pagination,
    ReservationCreate,
    ReservationFilterParams,
    ReservationRead,
    ReservationStatusUpdate,
    ReservationUpdate,
)
from src.services import reservation_service

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.post("", response_model=ReservationRead, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    data: ReservationCreate, session: SessionDep, settings: SettingsDep, user: CurrentUser
) -> ReservationRead:
    reservation = await reservation_service.create_reservation(
        session, user, data, min_lead_time_minutes=settings.reservation_min_lead_time_minutes
    )
    return ReservationRead.model_validate(reservation)


@router.get("", response_model=Page[ReservationRead])
async def list_reservations(
    session: SessionDep,
    user: CurrentUser,
    filters: ReservationFilterParams,
    page: Pagination,
) -> Page[ReservationRead]:
    """Guests see their own reservations, staff those of their restaurant, admins all."""
    items, total = await reservation_service.list_reservations(
        session, user, filters, limit=page.limit, offset=page.offset
    )
    return Page(
        items=[ReservationRead.model_validate(r) for r in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get("/{reservation_id}", response_model=ReservationRead)
async def get_reservation(
    reservation_id: int, session: SessionDep, user: CurrentUser
) -> ReservationRead:
    reservation = await reservation_service.get_reservation(session, user, reservation_id)
    return ReservationRead.model_validate(reservation)


@router.post("/{reservation_id}/cancel", response_model=ReservationRead)
async def cancel_reservation(
    reservation_id: int, session: SessionDep, user: CurrentUser
) -> ReservationRead:
    reservation = await reservation_service.cancel_reservation(session, user, reservation_id)
    return ReservationRead.model_validate(reservation)


@router.patch("/{reservation_id}", response_model=ReservationRead)
async def update_reservation(
    reservation_id: int,
    data: ReservationUpdate,
    session: SessionDep,
    settings: SettingsDep,
    user: CurrentUser,
) -> ReservationRead:
    """Reschedule, change party size or notes; staff may also move it to another table."""
    reservation = await reservation_service.update_reservation(
        session,
        user,
        reservation_id,
        data,
        min_lead_time_minutes=settings.reservation_min_lead_time_minutes,
    )
    return ReservationRead.model_validate(reservation)


@router.patch("/{reservation_id}/status", response_model=ReservationRead)
async def change_status(
    reservation_id: int, data: ReservationStatusUpdate, session: SessionDep, user: StaffUser
) -> ReservationRead:
    """Staff lifecycle changes: confirm, seat, complete, no-show, cancel."""
    reservation = await reservation_service.change_status(
        session, user, reservation_id, data.status
    )
    return ReservationRead.model_validate(reservation)
