from datetime import datetime, time
from typing import Annotated, Self
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Name = Annotated[str, Field(min_length=1, max_length=120)]


class RestaurantCreate(BaseModel):
    name: Name
    timezone: str = "UTC"
    opens_at: time
    closes_at: time
    default_duration_minutes: Annotated[int, Field(ge=15, le=480)] = 90

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name must not be blank")
        return value

    @field_validator("timezone")
    @classmethod
    def _valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError(f"unknown IANA timezone: {value!r}") from exc
        return value

    @field_validator("opens_at", "closes_at")
    @classmethod
    def _naive_time(cls, value: time) -> time:
        if value.tzinfo is not None:
            raise ValueError("opening hours are local times and must not carry a timezone")
        return value

    @model_validator(mode="after")
    def _opens_before_closes(self) -> Self:
        if self.opens_at >= self.closes_at:
            raise ValueError("opens_at must be earlier than closes_at")
        return self


class RestaurantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    timezone: str
    opens_at: time
    closes_at: time
    default_duration_minutes: int
    created_at: datetime
