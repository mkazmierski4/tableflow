from datetime import date, datetime

from pydantic import BaseModel

from src.schemas.reservation import PartySize, TimeRange
from src.schemas.table import TableRead


class AvailabilityQuery(TimeRange):
    party_size: PartySize


class AvailabilityRead(BaseModel):
    start_at: datetime
    end_at: datetime
    party_size: int
    tables: list[TableRead]


class SlotsQuery(BaseModel):
    """`date` is the calendar day in the restaurant's own timezone."""

    date: date
    party_size: PartySize


class SlotRead(BaseModel):
    start_at: datetime
    end_at: datetime
    # Wall-clock start in the restaurant's timezone, e.g. "18:30".
    local_time: str
    available: bool
    free_tables: int


class SlotsRead(BaseModel):
    date: date
    timezone: str
    duration_minutes: int
    party_size: int
    slots: list[SlotRead]
