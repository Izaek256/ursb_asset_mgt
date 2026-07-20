"""
Time utilities for the backend.

All DB DateTime columns are naive UTC (no tzinfo).
Use utcnow() from this module everywhere instead of datetime.utcnow()
so values stored in the DB are always naive UTC and the JSON serializer
can stamp them with 'Z' correctly.
"""
from datetime import datetime, timezone


def utcnow() -> datetime:
    """Return current UTC time as a naive datetime (no tzinfo).

    Naive UTC is what SQLite/SQLAlchemy stores in DateTime columns.
    Using this avoids 'offset-naive vs offset-aware' comparison errors
    when reading values back from the DB.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
