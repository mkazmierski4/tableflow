from typing import Annotated

from fastapi import APIRouter, Query, status

from src.api.deps import SessionDep
from src.schemas import (
    AvailabilityQuery,
    AvailabilityRead,
    RestaurantCreate,
    RestaurantRead,
    TableCreate,
    TableRead,
)
from src.services import availability_service, restaurant_service

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


@router.post("", response_model=RestaurantRead, status_code=status.HTTP_201_CREATED)
async def create_restaurant(data: RestaurantCreate, session: SessionDep) -> RestaurantRead:
    restaurant = await restaurant_service.create_restaurant(session, data)
    return RestaurantRead.model_validate(restaurant)


@router.get("/{restaurant_id}", response_model=RestaurantRead)
async def get_restaurant(restaurant_id: int, session: SessionDep) -> RestaurantRead:
    restaurant = await restaurant_service.get_restaurant(session, restaurant_id)
    return RestaurantRead.model_validate(restaurant)


@router.post(
    "/{restaurant_id}/tables", response_model=TableRead, status_code=status.HTTP_201_CREATED
)
async def create_table(restaurant_id: int, data: TableCreate, session: SessionDep) -> TableRead:
    table = await restaurant_service.create_table(session, restaurant_id, data)
    return TableRead.model_validate(table)


@router.get("/{restaurant_id}/tables", response_model=list[TableRead])
async def list_tables(restaurant_id: int, session: SessionDep) -> list[TableRead]:
    tables = await restaurant_service.list_tables(session, restaurant_id)
    return [TableRead.model_validate(t) for t in tables]


@router.get("/{restaurant_id}/availability", response_model=AvailabilityRead)
async def get_availability(
    restaurant_id: int,
    query: Annotated[AvailabilityQuery, Query()],
    session: SessionDep,
) -> AvailabilityRead:
    start_at, end_at, tables = await availability_service.find_available_tables(
        session,
        restaurant_id,
        start_at=query.start_at,
        end_at=query.end_at,
        party_size=query.party_size,
    )
    return AvailabilityRead(
        start_at=start_at,
        end_at=end_at,
        party_size=query.party_size,
        tables=[TableRead.model_validate(t) for t in tables],
    )
