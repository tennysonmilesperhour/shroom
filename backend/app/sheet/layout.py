"""Canonical tab layout for the Master Cultivation Reference workbook.

This is the *contract* between the two sync directions. The importer
(``parse.py``) reads these tabs; the exporter (``export.py``) and the live
auto-push (``autosync.py``) write them. Keeping the tab name, header row, and the
DB-row projection in one place is what guarantees a value written back by the
app lands where the parser will read it again — i.e. a true round-trip.

Each :class:`TabSpec` describes one worksheet the app owns:

* ``tab``     — worksheet title (the parser matches it fuzzily).
* ``header``  — the header row. Every token the parser scans for
  (``parse._find_header`` / ``parse._col``) must appear here, so reordering or
  renaming a column here stays in lock-step with the reader.
* ``entity``  — the ORM model the rows come from.
* ``order_by``— stable sort for deterministic output.
* ``row``     — projects one ORM instance into a list of cells, positionally
  aligned with ``header``.

Only the entities the FastAPI/SQLite model authoritatively holds are mapped
(strains, the batch→harvest cultivation spine, and customers); those are the
rows the app can create and therefore push back to the sheet.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Callable

from .. import models

# lot_code is synthesized by the importer as ``f"{tub}-F{flush}"`` (or just the
# tub when there's no flush). Reverse it so the grow-cycle / harvest tabs write
# the operator-facing Tub + Flush columns the sheet actually uses.
_LOT = re.compile(r"^(?P<tub>.+?)-F(?P<flush>\d+)$")


def split_lot(lot_code: str) -> tuple[str, int | None]:
    """('T-01-F2') -> ('T-01', 2); ('T-01') -> ('T-01', None)."""
    m = _LOT.match(lot_code or "")
    if m:
        return m.group("tub"), int(m.group("flush"))
    return lot_code or "", None


def _yn(value: bool | None) -> str:
    return "" if value is None else ("Yes" if value else "No")


def _grams(kg: float | None) -> float | None:
    # Guard on None, not falsiness: a real 0.0 weight (the column default for a
    # harvest logged before weighing) must round-trip as 0, not a blank cell.
    return round(kg * 1000, 2) if kg is not None else None


def _status_text(active: bool) -> str:
    # The parser skips any row with a blank Status cell, so this must be
    # non-empty. "Active"/"Inactive" round-trip through util.library_status.
    return "Active" if active else "Inactive"


def _norm_key(value: object) -> str:
    """Normalize a cell for key matching: dates -> ISO, everything else a
    trimmed lowercase string, and an int-valued float -> its int text so a
    Flush of 1 matches whether the sheet stored 1 or 1.0."""
    if value is None:
        return ""
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip().lower()


@dataclass(frozen=True)
class TabSpec:
    key: str
    tab: str
    header: list[str]
    entity: type
    order_by: Callable
    row: Callable[[object], list]
    # Header labels that form the natural key for a non-destructive upsert:
    # a matching row on the sheet is updated in place, a new one is appended,
    # and rows/columns the app doesn't recognize are left untouched.
    key_cols: tuple[str, ...] = ()

    def key_of(self, row: list) -> tuple:
        """The normalized natural key of a projected row (for matching)."""
        idx = [self.header.index(c) for c in self.key_cols]
        return tuple(_norm_key(row[i]) for i in idx)


# --------------------------------------------------------------------------- #
# Row projections (ORM instance -> cells aligned with the header)
# --------------------------------------------------------------------------- #
def _strain_row(s: "models.Strain") -> list:
    return [
        s.name,
        _status_text(s.active),
        s.vendor or "",
        None,                       # Inoculated/acquired — not held by the model
        s.potency or "",
        s.ease_rating,
        _yn(s.grow_again),
        "",                         # Tub/Bag ID — assigned per-batch, not per-strain
        s.notes or "",
    ]


def _batch_row(b: "models.Batch") -> list:
    tub, flush = split_lot(b.lot_code)
    # Latest harvest date, if any — lets the importer reconstruct the
    # "harvesting" stage (which it derives from dates, not a stage column).
    harvest_date = max(
        (h.harvested_on for h in b.harvests if h.harvested_on), default=None
    )
    return [
        b.strain.name if b.strain else "",
        tub,
        flush,
        b.inoculated_on,
        b.colonized_on,
        b.fruiting_on,
        harvest_date,
        "Yes" if b.contamination_flag else "",
        "",                         # Issues — folded into Notes by the importer
        b.notes or "",
    ]


def _harvest_row(h: "models.Harvest") -> list:
    batch = h.batch
    tub, _ = split_lot(batch.lot_code) if batch else ("", None)
    strain = batch.strain.name if batch and batch.strain else ""
    return [
        strain,
        tub,
        h.flush_number,
        h.harvested_on,
        _grams(h.weight_kg),
        _grams(h.dry_weight_kg),
        h.notes or "",
    ]


def _customer_row(c: "models.Customer") -> list:
    # channel round-trips via util.channel_for_tier for the common channels
    # (wholesale/distributor/restaurant/retail) when written into the Tier cell.
    return [
        c.name,
        c.channel or "",
        "",                         # Role — not held by the model
        "",                         # Volume — not held by the model
        None,                       # Last Contact — not held by the model
        "Active",
        c.notes or "",
    ]


# --------------------------------------------------------------------------- #
# The registry — ordered; drives full export and the keyed upsert push.
# --------------------------------------------------------------------------- #
TABS: list[TabSpec] = [
    TabSpec(
        key="strains",
        tab="Strain Library",
        header=["Strain", "Status", "Vendor", "Inoculated", "Potency",
                "Ease", "Grow Again", "Tub/Bag ID", "Notes"],
        entity=models.Strain,
        order_by=lambda: models.Strain.name,
        row=_strain_row,
        key_cols=("Strain",),
    ),
    TabSpec(
        key="batches",
        tab="Grow Cycle Log",
        header=["Strain", "Tub", "Flush", "Inoculated", "Transferred",
                "First Pins", "Harvest Date", "Contam", "Issues", "Notes"],
        entity=models.Batch,
        order_by=lambda: models.Batch.lot_code,
        row=_batch_row,
        key_cols=("Tub", "Flush"),
    ),
    TabSpec(
        key="harvests",
        tab="Harvest Tracker",
        header=["Strain", "Tub", "Flush", "Harvest Date",
                "Fresh (g)", "Dry (g)", "Notes"],
        entity=models.Harvest,
        order_by=lambda: models.Harvest.harvested_on,
        row=_harvest_row,
        key_cols=("Tub", "Flush"),
    ),
    TabSpec(
        key="customers",
        tab="Buyers & Pricing",
        header=["Name", "Tier", "Role", "Volume", "Last Contact", "Status", "Notes"],
        entity=models.Customer,
        order_by=lambda: models.Customer.name,
        row=_customer_row,
        key_cols=("Name",),
    ),
]

# Fast lookup by entity key -> spec.
BY_KEY: dict[str, TabSpec] = {t.key: t for t in TABS}


def cell_to_str(value: object) -> str:
    """Render a cell for a text-only backend (Google Sheets values API)."""
    if value is None:
        return ""
    if isinstance(value, date):
        return value.isoformat()
    return str(value)
