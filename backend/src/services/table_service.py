from datetime import datetime

from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import DuplicateTableError, NotFoundError, TableHasReservationsError
from src.models import ACTIVE_STATUSES, DiningTable, Reservation
from src.models.base import utcnow
from src.schemas import TableUpdate
from src.services.locking import lock_table


async def update_table(
    session: AsyncSession, table_id: int, data: TableUpdate, *, now: datetime | None = None
) -> DiningTable:
    """Change a table while holding its booking lock, so no reservation can slip in mid-change.

    Expects a session with no transaction started yet (see `lock_table`).
    """
    now = now or utcnow()
    try:
        await lock_table(session, table_id)
        table = await session.get(DiningTable, table_id)
        if table is None:
            raise NotFoundError(f"Table {table_id} not found")

        changes = data.model_dump(exclude_unset=True)
        new_capacity = changes.get("capacity", table.capacity)
        deactivating = table.is_active and changes.get("is_active") is False

        if deactivating:
            await _ensure_no_upcoming_reservations(session, table_id, now=now)
        elif new_capacity < table.capacity:
            await _ensure_no_upcoming_reservations(
                session, table_id, now=now, larger_than=new_capacity
            )

        for field, value in changes.items():
            setattr(table, field, value)
        await session.commit()
        return table
    except IntegrityError as exc:
        await session.rollback()
        raise DuplicateTableError(f"Table label {data.label!r} already exists") from exc
    except BaseException:
        await session.rollback()
        raise


async def delete_table(
    session: AsyncSession, table_id: int, *, now: datetime | None = None
) -> None:
    """Soft delete: the table is deactivated so reservation history stays intact."""
    await update_table(session, table_id, TableUpdate(is_active=False), now=now)


async def _ensure_no_upcoming_reservations(
    session: AsyncSession, table_id: int, *, now: datetime, larger_than: int | None = None
) -> None:
    """Refuse if an active reservation that has not ended yet would be affected."""
    conditions = [
        Reservation.table_id == table_id,
        Reservation.status.in_(ACTIVE_STATUSES),
        Reservation.end_at > now,
    ]
    if larger_than is not None:
        conditions.append(Reservation.party_size > larger_than)
    if await session.scalar(select(exists().where(*conditions))):
        raise TableHasReservationsError(
            "Table has upcoming reservations; cancel or move them first"
        )
