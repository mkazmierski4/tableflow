"""Pure scheduling rules (no I/O), shared by services and unit tests."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo


def intervals_overlap(
    a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime
) -> bool:
    """Half-open intervals [start, end): back-to-back ranges do not overlap."""
    return a_start < b_end and a_end > b_start


def resolve_end(start_at: datetime, end_at: datetime | None, default_minutes: int) -> datetime:
    return end_at if end_at is not None else start_at + timedelta(minutes=default_minutes)


def within_opening_hours(
    start_at: datetime, end_at: datetime, *, timezone: str, opens_at: time, closes_at: time
) -> bool:
    """The whole reservation must fit into one local day's opening window."""
    tz = ZoneInfo(timezone)
    local_start = start_at.astimezone(tz)
    local_end = end_at.astimezone(tz)
    if local_start.date() != local_end.date():
        return False
    return opens_at <= local_start.time() and local_end.time() <= closes_at
