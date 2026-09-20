from collections.abc import AsyncIterator
from typing import Any

from fastapi import Request
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

SQLITE_BUSY_TIMEOUT_SECONDS = 30


def create_engine(url: str, *, echo: bool = False) -> AsyncEngine:
    """Create the async engine; SQLite gets pragmas and explicit transaction control."""
    is_sqlite = url.startswith("sqlite")
    connect_args: dict[str, Any] = {"timeout": SQLITE_BUSY_TIMEOUT_SECONDS} if is_sqlite else {}
    engine = create_async_engine(url, echo=echo, connect_args=connect_args)

    if is_sqlite:
        _configure_sqlite(engine, in_memory=":memory:" in url or url.endswith("://"))
    return engine


def _configure_sqlite(engine: AsyncEngine, *, in_memory: bool) -> None:
    """Enable FK enforcement and make pysqlite emit BEGIN itself.

    By default pysqlite delays BEGIN until the first DML statement, which breaks
    the "lock first, then check" flow. Disabling its implicit handling and
    emitting BEGIN on the SQLAlchemy `begin` event gives predictable transactions.
    """

    @event.listens_for(engine.sync_engine, "connect")
    def _on_connect(dbapi_connection: Any, _record: Any) -> None:
        dbapi_connection.isolation_level = None
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        if not in_memory:
            cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    @event.listens_for(engine.sync_engine, "begin")
    def _on_begin(connection: Any) -> None:
        connection.exec_driver_sql("BEGIN")


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding a session bound to the app's session factory."""
    async with request.app.state.session_factory() as session:
        yield session
