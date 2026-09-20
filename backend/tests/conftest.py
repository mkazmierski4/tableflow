import itertools
import os
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from src.core import security
from src.core.config import Settings
from src.core.database import create_engine, create_session_factory
from src.core.security import create_access_token
from src.main import create_app
from src.models import Base, User, UserRole
from src.services import user_service

POSTGRES_URL = os.getenv("TEST_POSTGRES_URL")  # e.g. postgresql+asyncpg://u:p@localhost:5432/test
BACKENDS = ["sqlite", *(["postgres"] if POSTGRES_URL else [])]
DEFAULT_PASSWORD = "correct-horse-battery"


@pytest.fixture(autouse=True)
def cheap_password_hashing(monkeypatch: pytest.MonkeyPatch) -> None:
    """Argon2 with minimal cost: same algorithm and API, far faster tests."""
    hasher = PasswordHash((Argon2Hasher(time_cost=1, memory_cost=8, parallelism=1),))
    monkeypatch.setattr(security, "_hasher", hasher)
    monkeypatch.setattr(security, "_DUMMY_HASH", hasher.hash("placeholder"))


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
def settings(database_url: str) -> Settings:
    return Settings(
        database_url=database_url,
        secret_key="test-secret-key-0123456789-0123456789",
        reservation_min_lead_time_minutes=30,
    )


@pytest.fixture
def session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return create_session_factory(engine)


@pytest.fixture
async def client(
    engine: AsyncEngine, settings: Settings, session_factory: async_sessionmaker[AsyncSession]
) -> AsyncIterator[AsyncClient]:
    app = create_app(settings)
    # ASGITransport does not run the lifespan, so wire the state the lifespan would set.
    app.state.engine = engine
    app.state.session_factory = session_factory
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@dataclass
class TestUser:
    __test__ = False  # not a pytest test class

    id: int
    email: str
    password: str
    role: UserRole
    headers: dict[str, str]


MakeUser = Callable[..., Awaitable[TestUser]]


@pytest.fixture
def make_user(session_factory: async_sessionmaker[AsyncSession], settings: Settings) -> MakeUser:
    """Create a user directly in the DB and return it with a ready-to-use bearer header."""
    counter = itertools.count(1)

    async def _make(
        role: UserRole = UserRole.GUEST,
        *,
        restaurant_id: int | None = None,
        email: str | None = None,
        is_active: bool = True,
    ) -> TestUser:
        email = email or f"{role.value}{next(counter)}@example.com"
        async with session_factory() as session:
            user = await user_service.create_user(
                session,
                email=email,
                password=DEFAULT_PASSWORD,
                full_name=f"Test {role.value.title()}",
                role=role,
                restaurant_id=restaurant_id,
            )
            if not is_active:
                user.is_active = False
                await session.commit()
            user_id = user.id
        token = create_access_token(user_id, settings)
        return TestUser(
            id=user_id,
            email=email,
            password=DEFAULT_PASSWORD,
            role=role,
            headers={"Authorization": f"Bearer {token}"},
        )

    return _make


async def get_user_row(session_factory: async_sessionmaker[AsyncSession], user_id: int) -> User:
    async with session_factory() as session:
        user = await session.get(User, user_id)
        assert user is not None
        return user


async def create_restaurant(
    client: AsyncClient, *, headers: dict[str, str] | None = None, **overrides: Any
) -> dict[str, Any]:
    payload = {
        "name": "Trattoria",
        "timezone": "Europe/Warsaw",
        "opens_at": "12:00",
        "closes_at": "23:00",
        "default_duration_minutes": 90,
        **overrides,
    }
    response = await client.post("/api/v1/restaurants", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return dict(response.json())


async def create_table(
    client: AsyncClient,
    restaurant_id: int,
    label: str = "T1",
    capacity: int = 4,
    *,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    response = await client.post(
        f"/api/v1/restaurants/{restaurant_id}/tables",
        json={"label": label, "capacity": capacity},
        headers=headers,
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
async def admin(make_user: MakeUser) -> TestUser:
    return await make_user(UserRole.ADMIN)


@pytest.fixture
async def guest(make_user: MakeUser) -> TestUser:
    return await make_user(UserRole.GUEST)


@pytest.fixture
async def venue(client: AsyncClient, admin: TestUser) -> dict[str, Any]:
    """A restaurant (Warsaw, 12:00-23:00, 90 min slots) with a 4-seat and a 2-seat table."""
    restaurant = await create_restaurant(client, headers=admin.headers)
    big = await create_table(client, restaurant["id"], "T1", 4, headers=admin.headers)
    small = await create_table(client, restaurant["id"], "T2", 2, headers=admin.headers)
    return {"restaurant": restaurant, "big": big, "small": small}
