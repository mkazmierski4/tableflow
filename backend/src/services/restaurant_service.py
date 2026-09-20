from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import DuplicateTableError, InvalidRestaurantUpdateError, NotFoundError
from src.models import DiningTable, Restaurant
from src.schemas import RestaurantCreate, RestaurantUpdate, TableCreate


async def create_restaurant(session: AsyncSession, data: RestaurantCreate) -> Restaurant:
    restaurant = Restaurant(**data.model_dump())
    session.add(restaurant)
    await session.commit()
    return restaurant


async def get_restaurant(session: AsyncSession, restaurant_id: int) -> Restaurant:
    restaurant = await session.get(Restaurant, restaurant_id)
    if restaurant is None:
        raise NotFoundError(f"Restaurant {restaurant_id} not found")
    return restaurant


async def list_restaurants(
    session: AsyncSession, *, limit: int, offset: int
) -> tuple[list[Restaurant], int]:
    total = await session.scalar(select(func.count()).select_from(Restaurant)) or 0
    result = await session.scalars(
        select(Restaurant).order_by(Restaurant.name, Restaurant.id).limit(limit).offset(offset)
    )
    return list(result), total


async def update_restaurant(
    session: AsyncSession, restaurant_id: int, data: RestaurantUpdate
) -> Restaurant:
    """Existing reservations are left untouched when hours or duration change."""
    restaurant = await get_restaurant(session, restaurant_id)
    changes = data.model_dump(exclude_unset=True)

    opens_at = changes.get("opens_at", restaurant.opens_at)
    closes_at = changes.get("closes_at", restaurant.closes_at)
    if opens_at >= closes_at:
        raise InvalidRestaurantUpdateError("opens_at must be earlier than closes_at")

    for field, value in changes.items():
        setattr(restaurant, field, value)
    await session.commit()
    return restaurant


async def create_table(session: AsyncSession, restaurant_id: int, data: TableCreate) -> DiningTable:
    await get_restaurant(session, restaurant_id)
    table = DiningTable(restaurant_id=restaurant_id, **data.model_dump())
    session.add(table)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise DuplicateTableError(
            f"Table {data.label!r} already exists in restaurant {restaurant_id}"
        ) from exc
    return table


async def list_tables(session: AsyncSession, restaurant_id: int) -> list[DiningTable]:
    await get_restaurant(session, restaurant_id)
    result = await session.scalars(
        select(DiningTable)
        .where(DiningTable.restaurant_id == restaurant_id)
        .order_by(DiningTable.label)
    )
    return list(result)
