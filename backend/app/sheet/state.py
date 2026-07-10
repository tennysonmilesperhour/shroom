"""Read/update the singleton SyncState row.

Kept tiny and side-effect-explicit so both the request path (create endpoints
bumping the dirty counter) and the background auto-push (resetting it) can share
one definition of "how far behind is the sheet".
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models


def get_state(db: Session) -> models.SyncState:
    """The singleton state row, created on first access."""
    state = db.get(models.SyncState, 1)
    if state is None:
        state = models.SyncState(id=1, dirty_count=0)
        db.add(state)
        db.flush()
    return state


def mark_dirty(db: Session, n: int = 1) -> None:
    """Record that ``n`` owned rows changed since the last push."""
    state = get_state(db)
    state.dirty_count = (state.dirty_count or 0) + n
    db.commit()


def mark_pushed(db: Session) -> None:
    """A push succeeded: the app and sheet are in sync as of now."""
    state = get_state(db)
    state.dirty_count = 0
    state.last_pushed_at = datetime.now(timezone.utc)
    db.commit()


def mark_pulled(db: Session) -> None:
    state = get_state(db)
    state.last_pulled_at = datetime.now(timezone.utc)
    db.commit()


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def snapshot(db: Session) -> dict:
    """State for the /api/sync/status payload."""
    state = get_state(db)
    return {
        "dirty_count": state.dirty_count or 0,
        "last_pushed_at": _iso(state.last_pushed_at),
        "last_pulled_at": _iso(state.last_pulled_at),
    }
