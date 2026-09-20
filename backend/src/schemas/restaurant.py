from datetime import datetime, time
from typing import Annotated, Self
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Name = Annotated[str, Field(min_length=1, max_length=120)]
City = Annotated[str, Field(min_length=1, max_length=80)]
DefaultDuration = Annotated[int, Field(ge=15, le=480)]


def _valid_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError(f"unknown IANA timezone: {value!r}") from exc
    return value


def _naive_time(value: time) -> time:
    if value.tzinfo is not None:
        raise ValueError("opening hours are local times and must not carry a timezone")
    return value


def _non_blank(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("must not be blank")
    return value


class RestaurantCreate(BaseModel):
    name: Name
    city: City
    timezone: str = "UTC"
    opens_at: time
    closes_at: time
    default_duration_minutes: DefaultDuration = 90

    _name = field_validator("name", "city")(_non_blank)
    _timezone = field_validator("timezone")(_valid_timezone)
    _hours = field_validator("opens_at", "closes_at")(_naive_time)

    @model_validator(mode="after")
    def _opens_before_closes(self) -> Self:
        if self.opens_at >= self.closes_at:
            raise ValueError("opens_at must be earlier than closes_at")
        return self


class RestaurantUpdate(BaseModel):
    """Partial update: only the fields that are sent change; `null` is not a valid value."""

    name: Name | None = None
    city: City | None = None
    timezone: str | None = None
    opens_at: time | None = None
    closes_at: time | None = None
    default_duration_minutes: DefaultDuration | None = None

    @field_validator("name", "city")
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return None if value is None else _non_blank(value)

    @field_validator("timezone")
    @classmethod
    def _timezone(cls, value: str | None) -> str | None:
        return None if value is None else _valid_timezone(value)

    @field_validator("opens_at", "closes_at")
    @classmethod
    def _hours(cls, value: time | None) -> time | None:
        return None if value is None else _naive_time(value)

    @model_validator(mode="after")
    def _no_explicit_nulls(self) -> Self:
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} must not be null")
        return self


class RestaurantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    timezone: str
    opens_at: time
    closes_at: time
    default_duration_minutes: int
    created_at: datetime
