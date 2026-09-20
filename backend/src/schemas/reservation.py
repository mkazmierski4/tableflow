from datetime import datetime
from typing import Annotated, Self

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
    guest_name: Annotated[str, Field(min_length=1, max_length=120)]
    guest_email: EmailStr
    guest_phone: Annotated[str | None, Field(max_length=32)] = None
    notes: Annotated[str | None, Field(max_length=500)] = None

    @field_validator("guest_name")
    @classmethod
    def _strip_guest_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("guest_name must not be blank")
        return value


class ReservationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    table_id: int
    start_at: datetime
    end_at: datetime
    party_size: int
    status: ReservationStatus
    guest_name: str
    guest_email: str
    guest_phone: str | None
    notes: str | None
    created_at: datetime
