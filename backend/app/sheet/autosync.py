"""Keep the sheet current as the app changes — without a per-request round-trip.

When an owned entity is created/updated, the endpoint calls :func:`notify`,
which always bumps the dirty counter (so the UI can show "N unsynced changes")
and, when auto-push is enabled, schedules a **debounced, coalescing** push in
the background. Debouncing is what stops a burst of edits from firing a
full-workbook reupload per row: rapid changes collapse into one push a few
seconds after the last one.

Everything here is best-effort: a missing target or a network error is logged,
never raised into the request. Auto-push is opt-in (``SHEET_SYNC_AUTO``); with
it off, changes still mark the app dirty and the operator pushes manually.
"""
from __future__ import annotations

import logging
import os
import threading

from sqlalchemy.orm import Session

from . import export, state, writer

log = logging.getLogger("shroom.sheet.autosync")

_TRUE = {"1", "true", "yes", "on"}

_lock = threading.Lock()
_timer: threading.Timer | None = None
_pushing = False
_pending = False


def enabled() -> bool:
    return os.environ.get("SHEET_SYNC_AUTO", "").strip().lower() in _TRUE


def _debounce_seconds() -> float:
    try:
        return max(0.0, float(os.environ.get("SHEET_SYNC_DEBOUNCE", "3")))
    except ValueError:
        return 3.0


def notify(db: Session, n: int = 1) -> None:
    """Record ``n`` owned changes and, if auto-push is on, schedule a push.
    Best-effort — never raises into the caller's request."""
    try:
        state.mark_dirty(db, n)
    except Exception as exc:  # a bookkeeping failure must not fail the request
        log.warning("sync dirty-mark failed: %s", exc)
    if enabled():
        try:
            _schedule()
        except Exception as exc:  # e.g. thread exhaustion starting the timer
            log.warning("auto-push schedule failed: %s", exc)


def _schedule() -> None:
    global _timer
    with _lock:
        if _timer is not None:
            _timer.cancel()
        _timer = threading.Timer(_debounce_seconds(), _fire)
        _timer.daemon = True
        _timer.start()


def _fire() -> None:
    global _pushing, _pending
    with _lock:
        if _pushing:
            _pending = True  # coalesce: run again once the current push finishes
            return
        _pushing = True
    try:
        run_push()
    finally:
        with _lock:
            _pushing = False
            again = _pending
            _pending = False
    if again:
        _schedule()


def run_push(session_factory=None) -> dict | None:
    """Push the current DB state to the configured sheet. Opens its own session
    (the caller may be a background thread). Returns the per-tab result, or None
    when there's no target / the push failed. Best-effort."""
    if session_factory is None:
        from ..database import SessionLocal
        session_factory = SessionLocal
    try:
        w = writer.resolve_writer()
    except RuntimeError as exc:
        log.info("auto-push skipped: %s", exc)
        return None
    except Exception as exc:
        log.warning("auto-push could not open target: %s", exc)
        return None

    db = None
    try:
        db = session_factory()
        counts = export.push(db, w)
        state.mark_pushed(db)
        return counts
    except Exception as exc:
        log.warning("auto-push failed: %s", exc)
        return None
    finally:
        # Close the writer even if opening the session raised, so a Drive/Sheets
        # client is never leaked.
        w.close()
        if db is not None:
            db.close()
