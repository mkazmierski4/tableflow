import asyncio
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src import cli
from src.core.config import Settings
from src.models import UserRole
from tests.conftest import MakeUser, TestUser, get_user_row


def url(user_id: int) -> str:
    return f"/api/v1/users/{user_id}"


async def test_only_admins_may_update_users(
    client: AsyncClient, guest: TestUser, make_user: MakeUser, venue: dict[str, Any]
) -> None:
    staff = await make_user(UserRole.STAFF, restaurant_id=venue["restaurant"]["id"])
    body = {"is_active": False}

    assert (await client.patch(url(guest.id), json=body)).status_code == 401
    guest_attempt = await client.patch(url(guest.id), json=body, headers=guest.headers)
    staff_attempt = await client.patch(url(guest.id), json=body, headers=staff.headers)
    assert guest_attempt.status_code == 403
    assert guest_attempt.json()["error"]["code"] == "forbidden"
    assert staff_attempt.status_code == 403


async def test_admin_promotes_guest_to_staff(
    client: AsyncClient, admin: TestUser, guest: TestUser, venue: dict[str, Any]
) -> None:
    rid = venue["restaurant"]["id"]
    response = await client.patch(
        url(guest.id), json={"role": "staff", "restaurant_id": rid}, headers=admin.headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["role"] == "staff"
    assert response.json()["restaurant_id"] == rid


async def test_staff_requires_an_existing_restaurant(
    client: AsyncClient, admin: TestUser, guest: TestUser
) -> None:
    missing = await client.patch(url(guest.id), json={"role": "staff"}, headers=admin.headers)
    assert missing.status_code == 422
    assert missing.json()["error"]["code"] == "invalid_user_update"

    unknown = await client.patch(
        url(guest.id), json={"role": "staff", "restaurant_id": 999}, headers=admin.headers
    )
    assert unknown.status_code == 404


async def test_leaving_the_staff_role_clears_the_restaurant(
    client: AsyncClient, admin: TestUser, make_user: MakeUser, venue: dict[str, Any]
) -> None:
    staff = await make_user(UserRole.STAFF, restaurant_id=venue["restaurant"]["id"])
    response = await client.patch(url(staff.id), json={"role": "guest"}, headers=admin.headers)
    assert response.status_code == 200
    assert response.json()["role"] == "guest"
    assert response.json()["restaurant_id"] is None


async def test_staff_can_be_moved_to_another_restaurant(
    client: AsyncClient, admin: TestUser, make_user: MakeUser, venue: dict[str, Any]
) -> None:
    other = (
        await client.post(
            "/api/v1/restaurants",
            json={"name": "Other", "opens_at": "10:00", "closes_at": "20:00"},
            headers=admin.headers,
        )
    ).json()
    staff = await make_user(UserRole.STAFF, restaurant_id=venue["restaurant"]["id"])

    response = await client.patch(
        url(staff.id), json={"restaurant_id": other["id"]}, headers=admin.headers
    )
    assert response.status_code == 200
    assert response.json()["restaurant_id"] == other["id"]
    assert response.json()["role"] == "staff"


async def test_admin_cannot_demote_or_deactivate_self(client: AsyncClient, admin: TestUser) -> None:
    demote = await client.patch(url(admin.id), json={"role": "guest"}, headers=admin.headers)
    deactivate = await client.patch(url(admin.id), json={"is_active": False}, headers=admin.headers)
    assert demote.status_code == deactivate.status_code == 422


async def test_unknown_user_is_404(client: AsyncClient, admin: TestUser) -> None:
    response = await client.patch(url(9999), json={"is_active": False}, headers=admin.headers)
    assert response.status_code == 404


class TestCreateAdminCli:
    async def run_cli(self, *argv: str) -> int:
        # cli.main() owns its event loop, so run it off the test's loop.
        return await asyncio.to_thread(cli.main, list(argv))

    async def test_creates_an_admin_who_can_log_in(
        self,
        client: AsyncClient,
        settings: Settings,
        session_factory: async_sessionmaker[AsyncSession],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv("DATABASE_URL", settings.database_url)
        monkeypatch.setenv("TABLEFLOW_ADMIN_PASSWORD", "cli-admin-password")

        code = await self.run_cli("create-admin", "--email", "Root@Example.com", "--name", "Root")
        assert code == 0

        login = await client.post(
            "/api/v1/auth/login",
            data={"username": "root@example.com", "password": "cli-admin-password"},
        )
        assert login.status_code == 200
        me = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"}
        )
        assert me.json()["role"] == "admin"
        assert (await get_user_row(session_factory, me.json()["id"])).role == UserRole.ADMIN

    async def test_duplicate_email_fails_cleanly(
        self,
        settings: Settings,
        admin: TestUser,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        monkeypatch.setenv("DATABASE_URL", settings.database_url)
        monkeypatch.setenv("TABLEFLOW_ADMIN_PASSWORD", "cli-admin-password")

        code = await self.run_cli("create-admin", "--email", admin.email, "--name", "Dup")
        assert code == 1
        assert "already exists" in capsys.readouterr().err

    async def test_short_password_is_refused(
        self, settings: Settings, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DATABASE_URL", settings.database_url)
        monkeypatch.setenv("TABLEFLOW_ADMIN_PASSWORD", "short")
        with pytest.raises(SystemExit):
            await self.run_cli("create-admin", "--email", "a@b.co", "--name", "A")
