from datetime import datetime
from typing import Annotated, Self

from fastapi import Depends, Query
from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from src.models.reservation import ReservationStatus

PartySize = Annotated[int, Field(ge=1, le=100)]
StrictPartySize = Annotated[int, Field(ge=1, le=100, strict=True)]  # JSON bodies only


class TimeRange(BaseModel):
    """Time range; a missing `end_at` defaults to the restaurant's reservation duration."""

    start_at: AwareDatetime
    end_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def _end_after_start(self) -> Self:
        if self.end_at is not None and self.end_at <= self.start_at:
            raise ValueError("end_at must be later than start_at")
        return self


class ReservationCreate(TimeRange):
    table_id: int
    party_size: StrictPartySize
    # Default to the booking user's profile when omitted.
    guest_name: Annotated[str | None, Field(min_length=1, max_length=120)] = None
    guest_email: EmailStr | None = None
    guest_phone: Annotated[str | None, Field(max_length=32)] = None
    notes: Annotated[str | None, Field(max_length=500)] = None

    @field_validator("guest_name")
    @classmethod
    def _strip_guest_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("guest_name must not be blank")
        return value


class ReservationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    table_id: int
    user_id: int | None
    start_at: datetime
    end_at: datetime
    party_size: int
    status: ReservationStatus
    guest_name: str
    guest_email: str
    guest_phone: str | None
    notes: str | None
    created_at: datetime


class ReservationFilters:
    """Query parameters for listing reservations; `from`/`to` bound `start_at` ([from, to))."""

    def __init__(
        self,
        restaurant_id: int | None = None,
        table_id: int | None = None,
        status: ReservationStatus | None = None,
        from_: Annotated[AwareDatetime | None, Query(alias="from")] = None,
        to: AwareDatetime | None = None,
    ) -> None:
        self.restaurant_id = restaurant_id
        self.table_id = table_id
        self.status = status
        self.from_ = from_
        self.to = to


ReservationFilterParams = Annotated[ReservationFilters, Depends()]
