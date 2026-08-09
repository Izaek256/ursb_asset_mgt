"""
Time utilities for the backend.

All DB DateTime columns are naive UTC (no tzinfo).
Use utcnow() from this module everywhere instead of datetime.utcnow()
so values stored in the DB are always naive UTC and the JSON serializer
can stamp them with 'Z' correctly.
"""
from datetime import datetime, timezone, date
from zoneinfo import ZoneInfo


def utcnow() -> datetime:
    """Return current UTC time as a naive datetime (no tzinfo).

    Naive UTC is what SQLite/SQLAlchemy stores in DateTime columns.
    Using this avoids 'offset-naive vs offset-aware' comparison errors
    when reading values back from the DB.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def today_eat() -> date:
    """Return current date in East Africa Time (EAT, UTC+3).

    This should be used for all date fields (not datetime) that represent
    user-facing dates like assignment_date, return_date, etc.
    """
    eat_tz = ZoneInfo("Africa/Kampala")
    return datetime.now(eat_tz).date()
