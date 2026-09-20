import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from src.core.config import Settings
from src.core.database import create_engine, create_session_factory
from src.main import create_app
from src.models import Base

POSTGRES_URL = os.getenv("TEST_POSTGRES_URL")  # e.g. postgresql+asyncpg://u:p@localhost:5432/test
BACKENDS = ["sqlite", *(["postgres"] if POSTGRES_URL else [])]


@pytest.fixture(params=BACKENDS)
def database_url(request: pytest.FixtureRequest, tmp_path: Path) -> str:
    if request.param == "postgres":
        assert POSTGRES_URL is not None
        return POSTGRES_URL
    # A file database (not :memory:) so concurrent connections share real locking behaviour.
    return f"sqlite+aiosqlite:///{tmp_path / 'test.db'}"


@pytest.fixture
async def engine(database_url: str) -> AsyncIterator[AsyncEngine]:
    engine = create_engine(database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def client(engine: AsyncEngine, database_url: str) -> AsyncIterator[AsyncClient]:
    settings = Settings(database_url=database_url, reservation_min_lead_time_minutes=30)
    app = create_app(settings)
    # ASGITransport does not run the lifespan, so wire the state the lifespan would set.
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def create_restaurant(client: AsyncClient, **overrides: Any) -> dict[str, Any]:
    payload = {
        "name": "Trattoria",
        "timezone": "Europe/Warsaw",
        "opens_at": "12:00",
        "closes_at": "23:00",
        "default_duration_minutes": 90,
        **overrides,
    }
    response = await client.post("/api/v1/restaurants", json=payload)
    assert response.status_code == 201, response.text
    return dict(response.json())


async def create_table(
    client: AsyncClient, restaurant_id: int, label: str = "T1", capacity: int = 4
) -> dict[str, Any]:
    response = await client.post(
        f"/api/v1/restaurants/{restaurant_id}/tables", json={"label": label, "capacity": capacity}
    )
    assert response.status_code == 201, response.text
    return dict(response.json())


def booking(
    table_id: int, start: str = "2030-06-10T18:00:00+02:00", **overrides: Any
) -> dict[str, Any]:
    """A valid reservation payload; the year 2030 keeps it clear of the lead-time rule."""
    return {
        "table_id": table_id,
        "start_at": start,
        "party_size": 2,
        "guest_name": "Ann Nowak",
        "guest_email": "ann@example.com",
        **overrides,
    }


@pytest.fixture
async def venue(client: AsyncClient) -> dict[str, Any]:
    """A restaurant (Warsaw, 12:00-23:00, 90 min slots) with a 4-seat and a 2-seat table."""
    restaurant = await create_restaurant(client)
    big = await create_table(client, restaurant["id"], "T1", 4)
    small = await create_table(client, restaurant["id"], "T2", 2)
    return {"restaurant": restaurant, "big": big, "small": small}
