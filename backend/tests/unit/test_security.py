from datetime import UTC, datetime, timedelta

import jwt
import pytest
from pydantic import ValidationError

from src.core.config import Settings
from src.core.exceptions import AuthenticationError
from src.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

SETTINGS = Settings(secret_key="unit-test-secret-of-sufficient-length-0123456789")


class TestPasswords:
    def test_hash_is_salted_and_verifiable(self) -> None:
        first, second = hash_password("s3cret-pass"), hash_password("s3cret-pass")
        assert first != second
        assert first.startswith("$argon2")
        assert verify_password("s3cret-pass", first)

    def test_wrong_password_is_rejected(self) -> None:
        assert not verify_password("wrong", hash_password("s3cret-pass"))

    def test_unknown_user_is_rejected(self) -> None:
        assert not verify_password("anything", None)


class TestTokens:
    def test_round_trip(self) -> None:
        token = create_access_token(42, SETTINGS)
        assert decode_access_token(token, SETTINGS) == 42

    def test_expired_token_is_rejected(self) -> None:
        past = datetime.now(UTC) - timedelta(minutes=SETTINGS.access_token_expire_minutes + 1)
        token = create_access_token(1, SETTINGS, now=past)
        with pytest.raises(AuthenticationError) as info:
            decode_access_token(token, SETTINGS)
        assert info.value.code == "invalid_token"

    def test_token_lifetime_matches_settings(self) -> None:
        token = create_access_token(1, SETTINGS)
        payload = jwt.decode(token, options={"verify_signature": False})
        assert payload["exp"] - payload["iat"] == SETTINGS.access_token_expire_minutes * 60

    def test_wrong_secret_is_rejected(self) -> None:
        token = create_access_token(1, Settings(secret_key="another-secret-0123456789-0123456789"))
        with pytest.raises(AuthenticationError):
            decode_access_token(token, SETTINGS)

    def test_tampered_token_is_rejected(self) -> None:
        header, payload, signature = create_access_token(1, SETTINGS).split(".")
        with pytest.raises(AuthenticationError):
            decode_access_token(f"{header}.{payload}.{signature[:-2]}xx", SETTINGS)

    def test_none_algorithm_is_rejected(self) -> None:
        forged = jwt.encode({"sub": "1", "exp": 9999999999}, key=None, algorithm="none")
        with pytest.raises(AuthenticationError):
            decode_access_token(forged, SETTINGS)

    @pytest.mark.parametrize(
        "claims", [{"exp": 9999999999}, {"sub": "1"}, {"sub": "abc", "exp": 9999999999}]
    )
    def test_missing_or_malformed_claims_are_rejected(self, claims: dict[str, object]) -> None:
        token = jwt.encode(claims, SETTINGS.secret_key, algorithm=SETTINGS.jwt_algorithm)
        with pytest.raises(AuthenticationError):
            decode_access_token(token, SETTINGS)

    def test_garbage_is_rejected(self) -> None:
        with pytest.raises(AuthenticationError):
            decode_access_token("not-a-jwt", SETTINGS)


class TestSettings:
    def test_production_requires_a_real_secret(self) -> None:
        with pytest.raises(ValidationError):
            Settings(app_env="production")
        assert Settings(app_env="production", secret_key="x" * 40).app_env == "production"

    def test_development_allows_default_secret(self) -> None:
        assert Settings(app_env="development").secret_key == "change-me"
