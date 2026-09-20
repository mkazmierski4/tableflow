from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / `.env`."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "TableFlow"
    app_env: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    database_url: str = "sqlite+aiosqlite:///./tableflow.db"

    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60

    cors_origins: list[str] = Field(default_factory=list)

    reservation_default_duration_minutes: int = Field(default=90, ge=15)
    reservation_min_lead_time_minutes: int = Field(default=30, ge=0)
