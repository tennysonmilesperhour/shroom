"""Live, best-effort mirroring of a single app change into the sheet.

When the operator creates a strain / batch / harvest / customer in the app, the
matching create endpoint calls :func:`mirror` to append that one row to the
right worksheet — so a change made in the UI *also* shows up on the
spreadsheet, in the same layout the importer reads back.

Design rules:

* **Opt-in.** Does nothing unless ``SHEET_SYNC_MIRROR`` is truthy *and* a write
  target is configured. A dev machine with no target set pays nothing.
* **Never fatal.** A network hiccup or an unconfigured target must not fail the
  user's create request, so every failure is swallowed and returned as a status
  dict (the caller may log it, but the 201 still succeeds).
* **Append, not upsert.** A single change is one appended row. Use the full
  ``POST /api/sync/push`` to rewrite tabs and collapse duplicates.
"""
from __future__ import annotations

import logging
import os

from . import layout, writer

log = logging.getLogger("shroom.sheet.mirror")

# Truthy values for the opt-in flag.
_TRUE = {"1", "true", "yes", "on"}


def enabled() -> bool:
    return os.environ.get("SHEET_SYNC_MIRROR", "").strip().lower() in _TRUE


def mirror(entity_key: str, obj) -> dict:
    """Append ``obj`` to its worksheet. Best-effort; never raises.

    Returns a small status dict: ``{"mirrored": bool, "reason"/"error": str}``.
    """
    if not enabled():
        return {"mirrored": False, "reason": "disabled"}

    spec = layout.BY_KEY.get(entity_key)
    if spec is None:
        return {"mirrored": False, "reason": f"no layout for '{entity_key}'"}

    w = None
    try:
        row = spec.row(obj)
        w = writer.resolve_writer()
        w.append_row(spec.tab, spec.header, row)
        w.commit()
        return {"mirrored": True, "tab": spec.tab}
    except Exception as exc:  # best-effort: log and report, don't propagate
        log.warning("sheet mirror failed for %s: %s", entity_key, exc)
        return {"mirrored": False, "error": str(exc)}
    finally:
        if w is not None:
            try:
                w.close()
            except Exception:
                pass
