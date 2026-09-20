from typing import Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_SECRET_KEY = "change-me"
API_V1_PREFIX = "/api/v1"


class Settings(BaseSettings):
    """Application settings loaded from environment variables / `.env`."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "TableFlow"
    app_env: str = "development"
    debug: bool = False
    api_v1_prefix: str = API_V1_PREFIX

    database_url: str = "sqlite+aiosqlite:///./tableflow.db"

    secret_key: str = INSECURE_SECRET_KEY
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=60, ge=1)

    cors_origins: list[str] = Field(default_factory=list)

    reservation_default_duration_minutes: int = Field(default=90, ge=15)
    reservation_min_lead_time_minutes: int = Field(default=30, ge=0)

    @model_validator(mode="after")
    def _require_real_secret_in_production(self) -> Self:
        if self.app_env == "production" and self.secret_key == INSECURE_SECRET_KEY:
            raise ValueError("SECRET_KEY must be set to a strong random value in production")
        return self
