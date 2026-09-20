from datetime import datetime

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
