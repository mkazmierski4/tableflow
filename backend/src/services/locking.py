from typing import Any, cast

from sqlalchemy import CursorResult, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundError
from src.models import DiningTable


async def lock_table(session: AsyncSession, table_id: int) -> None:
    """Serialise concurrent changes to one table for the rest of the transaction.

    Every operation that books, moves or removes capacity of a table must call this
    first, before any other statement of its transaction. PostgreSQL takes a row lock
    (`SELECT ... FOR UPDATE`); SQLite has no row locks, so a no-op UPDATE acquires
    the database write lock instead. Other writers wait until we commit/rollback.
    """
    if session.get_bind().dialect.name == "sqlite":
        result = await session.execute(
            text("UPDATE tables SET id = id WHERE id = :id"), {"id": table_id}
        )
        found = cast("CursorResult[Any]", result).rowcount > 0
    else:
        locked = await session.execute(
            select(DiningTable.id).where(DiningTable.id == table_id).with_for_update()
        )
        found = locked.first() is not None
    if not found:
        raise NotFoundError(f"Table {table_id} not found")
