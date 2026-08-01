import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from typing import Generator


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./ursb_asset.db",
)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    # Wait up to 30 s when the DB is locked by another writer instead of
    # failing immediately.  Pair with WAL mode (set in the event listener
    # below) so readers never block writers and vice-versa.
    connect_args["timeout"] = 30
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_size=1,
        max_overflow=4,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=10,
        max_overflow=20,
    )

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    with SessionLocal() as db:
        try:
            yield db
        finally:
            db.close()


def _enforce_sqlite_fks(dbapi_conn, connection_record):
    """Enable foreign key constraints and WAL journal mode on SQLite connections."""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    # WAL allows concurrent reads alongside a single writer — prevents
    # "database is locked" when the bulk import holds a write transaction
    # while notification polling and session refresh also need to write.
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


if DATABASE_URL.startswith("sqlite"):
    from sqlalchemy import event

    event.listen(engine, "connect", _enforce_sqlite_fks)
