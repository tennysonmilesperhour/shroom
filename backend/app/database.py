"""Database engine, session management, and declarative base.

Uses SQLite for zero-config portability. The path can be overridden with the
SHROOM_DB_URL environment variable (e.g. to point at Postgres in production).
"""
from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DB_URL = os.environ.get("SHROOM_DB_URL", "sqlite:///./shroom.db")

# check_same_thread is only relevant for SQLite + the dev server.
connect_args = {"check_same_thread": False} if DB_URL.startswith("sqlite") else {}

engine = create_engine(DB_URL, connect_args=connect_args, future=True)

if DB_URL.startswith("sqlite"):
    # SQLite ships with foreign-key enforcement OFF per connection; without
    # this, every FK column in the schema silently accepts invalid ids.
    @event.listens_for(engine, "connect")
    def _enable_sqlite_fks(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Declarative base shared by all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a scoped session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Idempotent — safe to call on every startup."""
    # Importing models registers them on the Base metadata before create_all.
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
