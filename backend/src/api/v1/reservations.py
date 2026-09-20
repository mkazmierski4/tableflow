from fastapi import APIRouter, status

from src.api.deps import SessionDep, SettingsDep
from src.schemas import ReservationCreate, ReservationRead
from src.services import reservation_service

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.post("", response_model=ReservationRead, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    data: ReservationCreate, session: SessionDep, settings: SettingsDep
) -> ReservationRead:
    reservation = await reservation_service.create_reservation(
        session, data, min_lead_time_minutes=settings.reservation_min_lead_time_minutes
    )
    return ReservationRead.model_validate(reservation)


@router.get("/{reservation_id}", response_model=ReservationRead)
async def get_reservation(reservation_id: int, session: SessionDep) -> ReservationRead:
    reservation = await reservation_service.get_reservation(session, reservation_id)
    return ReservationRead.model_validate(reservation)


@router.post("/{reservation_id}/cancel", response_model=ReservationRead)
async def cancel_reservation(reservation_id: int, session: SessionDep) -> ReservationRead:
    reservation = await reservation_service.cancel_reservation(session, reservation_id)
    return ReservationRead.model_validate(reservation)
