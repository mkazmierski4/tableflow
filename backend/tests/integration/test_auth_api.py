from datetime import UTC, datetime, timedelta
from typing import Any

from httpx import AsyncClient

from src.core.config import Settings
from src.core.security import create_access_token
from tests.conftest import MakeUser, TestUser

AUTH = "/api/v1/auth"


def register_payload(**overrides: Any) -> dict[str, Any]:
    return {
        "email": "New.User@Example.com",
        "password": "a-decent-password",
        "full_name": "New User",
        **overrides,
    }


class TestRegister:
    async def test_creates_a_guest_with_normalised_email(self, client: AsyncClient) -> None:
        response = await client.post(f"{AUTH}/register", json=register_payload())
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["email"] == "new.user@example.com"
        assert body["role"] == "guest"
        assert body["is_active"] is True
        assert body["restaurant_id"] is None
        assert "password" not in body
        assert "password_hash" not in body

    async def test_cannot_choose_a_role(self, client: AsyncClient) -> None:
        response = await client.post(
            f"{AUTH}/register", json=register_payload(role="admin", restaurant_id=1)
        )
        assert response.status_code == 201
        assert response.json()["role"] == "guest"

    async def test_duplicate_email_is_a_conflict_regardless_of_case(
        self, client: AsyncClient
    ) -> None:
        await client.post(f"{AUTH}/register", json=register_payload())
        again = await client.post(
            f"{AUTH}/register", json=register_payload(email="new.user@EXAMPLE.com")
        )
        assert again.status_code == 409
        assert again.json()["error"]["code"] == "email_taken"

    async def test_invalid_input_is_rejected(self, client: AsyncClient) -> None:
        for override in ({"password": "short"}, {"email": "nope"}, {"full_name": "  "}):
            response = await client.post(f"{AUTH}/register", json=register_payload(**override))
            assert response.status_code == 422, override


class TestLogin:
    async def login(self, client: AsyncClient, email: str, password: str) -> Any:
        return await client.post(f"{AUTH}/login", data={"username": email, "password": password})

    async def test_returns_a_working_token(self, client: AsyncClient, guest: TestUser) -> None:
        response = await self.login(client, guest.email, guest.password)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["token_type"] == "bearer"

        me = await client.get(
            f"{AUTH}/me", headers={"Authorization": f"Bearer {body['access_token']}"}
        )
        assert me.status_code == 200
        assert me.json()["email"] == guest.email

    async def test_email_is_case_insensitive(self, client: AsyncClient, guest: TestUser) -> None:
        response = await self.login(client, guest.email.upper(), guest.password)
        assert response.status_code == 200

    async def test_registered_user_can_log_in(self, client: AsyncClient) -> None:
        await client.post(f"{AUTH}/register", json=register_payload())
        response = await self.login(client, "new.user@example.com", "a-decent-password")
        assert response.status_code == 200

    async def test_wrong_password_and_unknown_email_look_identical(
        self, client: AsyncClient, guest: TestUser
    ) -> None:
        wrong_password = await self.login(client, guest.email, "wrong-password")
        unknown_email = await self.login(client, "nobody@example.com", "wrong-password")
        assert wrong_password.status_code == unknown_email.status_code == 401
        assert wrong_password.json() == unknown_email.json()
        assert wrong_password.headers["www-authenticate"] == "Bearer"

    async def test_inactive_user_cannot_log_in(
        self, client: AsyncClient, make_user: MakeUser
    ) -> None:
        inactive = await make_user(is_active=False)
        response = await self.login(client, inactive.email, inactive.password)
        assert response.status_code == 401


class TestMe:
    async def test_requires_a_token(self, client: AsyncClient) -> None:
        response = await client.get(f"{AUTH}/me")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "not_authenticated"
        assert response.headers["www-authenticate"] == "Bearer"

    async def test_rejects_garbage_token(self, client: AsyncClient) -> None:
        response = await client.get(f"{AUTH}/me", headers={"Authorization": "Bearer nope"})
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "invalid_token"

    async def test_rejects_expired_token(
        self, client: AsyncClient, guest: TestUser, settings: Settings
    ) -> None:
        past = datetime.now(UTC) - timedelta(minutes=settings.access_token_expire_minutes + 1)
        token = create_access_token(guest.id, settings, now=past)
        response = await client.get(f"{AUTH}/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401

    async def test_rejects_token_signed_with_another_key(
        self, client: AsyncClient, guest: TestUser
    ) -> None:
        forged = create_access_token(
            guest.id, Settings(secret_key="attacker-key-0123456789-0123456789")
        )
        response = await client.get(f"{AUTH}/me", headers={"Authorization": f"Bearer {forged}"})
        assert response.status_code == 401

    async def test_rejects_token_of_unknown_user(
        self, client: AsyncClient, settings: Settings
    ) -> None:
        token = create_access_token(99999, settings)
        response = await client.get(f"{AUTH}/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401

    async def test_deactivation_revokes_existing_tokens(
        self, client: AsyncClient, admin: TestUser, guest: TestUser
    ) -> None:
        assert (await client.get(f"{AUTH}/me", headers=guest.headers)).status_code == 200

        patched = await client.patch(
            f"/api/v1/users/{guest.id}", json={"is_active": False}, headers=admin.headers
        )
        assert patched.status_code == 200

        assert (await client.get(f"{AUTH}/me", headers=guest.headers)).status_code == 401
