"""Export the app's database back into the Master Cultivation Reference layout.

This is the reverse of ``parse.py`` + ``sinks.py``: instead of reading the
workbook into the DB, it reads the DB and produces the tab rows the workbook
should contain, then hands them to a :class:`~.writer.SheetWriter`. Together
with the importer this closes the loop — the sheet and the app become two
views of the same data.

``build_tables`` returns pure data (no I/O) so it's trivial to test: round-trip
it through a writer and back through the parser and the records must match.
``push`` drives a writer to replace each owned tab with the current DB state.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models
from . import layout
from .layout import TabSpec

# Relationships each tab's row projection touches — eager-loaded so a push
# doesn't fire one query per row (N+1). Keyed by entity model.
_EAGER = {
    models.Batch: (selectinload(models.Batch.strain),
                   selectinload(models.Batch.harvests)),
    models.Harvest: (selectinload(models.Harvest.batch).selectinload(models.Batch.strain),),
}


@dataclass
class Table:
    """One worksheet's worth of data: the spec plus its rendered rows."""
    spec: TabSpec
    rows: list[list]

    @property
    def tab(self) -> str:
        return self.spec.tab

    @property
    def header(self) -> list[str]:
        return self.spec.header


def build_table(db: Session, spec: TabSpec) -> Table:
    stmt = select(spec.entity).order_by(spec.order_by())
    eager = _EAGER.get(spec.entity)
    if eager:
        stmt = stmt.options(*eager)
    objects = db.scalars(stmt).all()
    rows = [spec.row(obj) for obj in objects]
    return Table(spec=spec, rows=rows)


def build_tables(db: Session) -> list[Table]:
    """Project the whole owned DB into workbook tables (in registry order)."""
    return [build_table(db, spec) for spec in layout.TABS]


def push(db: Session, writer) -> dict[str, dict]:
    """Upsert every owned tab through ``writer`` (non-destructive: rows are
    matched on the tab's natural key and updated in place, new ones appended,
    unmanaged rows/columns left intact).

    Returns per-tab ``{"updated", "appended", "rows"}``. The writer decides the
    destination (a local .xlsx, an .xlsx re-uploaded to Drive, or a Google Sheet).
    """
    counts: dict[str, dict] = {}
    for table in build_tables(db):
        result = writer.upsert_tab(
            table.tab, table.header, table.rows, table.spec.key_cols
        )
        counts[table.spec.key] = {**result, "rows": len(table.rows)}
    writer.commit()
    return counts
