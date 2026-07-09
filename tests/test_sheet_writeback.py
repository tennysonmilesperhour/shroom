"""Tests for the reverse sync direction: App -> Sheet (export/writer/mirror).

The core guarantee is a *round-trip*: data the app writes into a workbook must
come back out through the same parser the importer uses. If that holds, a change
made in the app genuinely lands where the sheet reads it — which is what
two-way sync means.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app import models
from backend.app.database import Base
from backend.app.sheet import export, layout, mirror, parse, writer


# --------------------------------------------------------------------------- #
# Fixtures — a small but relationship-complete app DB
# --------------------------------------------------------------------------- #
@pytest.fixture()
def session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path/'wb.db'}", future=True)
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine, future=True)()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


@pytest.fixture()
def seeded(session):
    sg = models.Strain(
        name="Stargazer", mushroom_type="psychedelic", vendor="Sporeworks",
        potency="high", ease_rating=8, grow_again=True, active=True,
        notes="P. cubensis — reliable",
    )
    pe = models.Strain(
        name="Penis Envy", mushroom_type="psychedelic", vendor="Ravenite",
        potency="very high", ease_rating=5, grow_again=True, active=False,
        notes="slow but potent",
    )
    session.add_all([sg, pe])
    session.flush()

    batch = models.Batch(
        lot_code="T-01-F1", strain_id=sg.id, stage="harvesting",
        inoculated_on=date(2026, 5, 1), colonized_on=date(2026, 5, 12),
        fruiting_on=date(2026, 5, 20), contamination_flag=False, notes="clean run",
    )
    session.add(batch)
    session.flush()

    session.add(models.Harvest(
        batch_id=batch.id, harvested_on=date(2026, 5, 29), flush_number=1,
        weight_kg=0.445, dry_weight_kg=0.0468, notes="first flush",
    ))
    session.add(models.Customer(
        name="Daniel Childs", channel="distributor", notes="net-30",
    ))
    session.commit()
    return session


# --------------------------------------------------------------------------- #
# build_tables — DB projected into the workbook layout
# --------------------------------------------------------------------------- #
def test_build_tables_covers_owned_entities(seeded):
    tables = {t.spec.key: t for t in export.build_tables(seeded)}
    assert set(tables) == {"strains", "batches", "harvests", "customers"}
    # Headers carry every token the parser scans for.
    assert tables["strains"].header[0] == "Strain"
    assert len(tables["strains"].rows) == 2
    assert len(tables["harvests"].rows) == 1


def test_lot_code_splits_into_tub_and_flush():
    assert layout.split_lot("T-01-F2") == ("T-01", 2)
    assert layout.split_lot("T-01") == ("T-01", None)


def test_zero_weight_grams_is_not_dropped():
    # A harvest logged before weighing has weight 0.0 — it must render as 0,
    # not a blank cell, so a real zero round-trips.
    assert layout._grams(0.0) == 0.0
    assert layout._grams(None) is None
    assert layout._grams(0.445) == 445


def test_google_sheets_a1_range_is_quoted_and_encoded():
    # Sheet names with spaces / '&' must be single-quoted in A1 notation and
    # percent-encoded in the request path, or the Sheets API 400s.
    rng = writer.GoogleSheetsWriter.a1_range("Buyers & Pricing", "A1")
    # single-quoted, space -> %20, '&' -> %26, '!' -> %21
    assert rng == "%27Buyers%20%26%20Pricing%27%21A1"
    assert writer.GoogleSheetsWriter.a1_range("Grow Cycle Log") == "%27Grow%20Cycle%20Log%27"


# --------------------------------------------------------------------------- #
# Round-trip: export -> .xlsx -> parse (the whole point)
# --------------------------------------------------------------------------- #
def _roundtrip(db, path) -> parse.ParsedWorkbook:
    w = writer.XlsxWriter(str(path))
    export.push(db, w)
    w.close()
    wb = load_workbook(path, read_only=True, data_only=True)
    return parse.parse_workbook(wb)


def test_export_roundtrips_through_the_parser(seeded, tmp_path):
    parsed = _roundtrip(seeded, tmp_path / "master.xlsx")

    strains = {s.name: s for s in parsed.strains}
    assert {"Stargazer", "Penis Envy"} <= set(strains)
    sg = strains["Stargazer"]
    assert sg.ease_rating == 8
    assert sg.grow_again is True
    assert sg.vendor == "Sporeworks"
    assert sg.library_status == "active"  # "Active" status cell -> active

    batches = {b.lot_code: b for b in parsed.batches}
    assert "T-01-F1" in batches
    assert batches["T-01-F1"].stage == "harvesting"
    assert batches["T-01-F1"].inoculated_on == date(2026, 5, 1)

    harvests = {h.lot_code: h for h in parsed.harvests}
    assert harvests["T-01-F1"].fresh_g == 445
    assert harvests["T-01-F1"].dry_g == 46.8

    customers = {c.name: c for c in parsed.customers}
    assert customers["Daniel Childs"].channel == "distributor"


def test_full_loop_export_then_reimport_into_a_fresh_db(seeded, tmp_path, session):
    """Export DB #1 -> sheet -> import into DB #2. The cultivation spine and
    strains survive the whole loop."""
    from backend.app.sheet.sinks import SqliteSink

    parsed = _roundtrip(seeded, tmp_path / "loop.xlsx")

    # Fresh, independent DB stands in for "the app on another machine".
    engine = create_engine(f"sqlite:///{tmp_path/'loop.db'}", future=True)
    Base.metadata.create_all(bind=engine)
    db2 = sessionmaker(bind=engine, future=True)()
    try:
        SqliteSink(db2).run(parsed)
        names = {s.name for s in db2.query(models.Strain).all()}
        assert {"Stargazer", "Penis Envy"} <= names
        h = (
            db2.query(models.Harvest)
            .join(models.Batch)
            .filter(models.Batch.lot_code == "T-01-F1")
            .one()
        )
        assert h.weight_kg == 0.445
    finally:
        db2.close()
        engine.dispose()


# --------------------------------------------------------------------------- #
# XlsxWriter behaviour
# --------------------------------------------------------------------------- #
def test_xlsx_writer_preserves_unowned_tabs(seeded, tmp_path):
    path = tmp_path / "mixed.xlsx"
    # Seed a workbook with a tab the app doesn't own.
    from openpyxl import Workbook
    wb = Workbook()
    wb.active.title = "Protocols"
    wb["Protocols"]["A1"] = "keep me"
    wb.save(path)

    w = writer.XlsxWriter(str(path))
    export.push(seeded, w)
    w.close()

    back = load_workbook(path)
    assert "Protocols" in back.sheetnames          # untouched
    assert back["Protocols"]["A1"].value == "keep me"
    assert "Strain Library" in back.sheetnames      # newly written


def test_append_row_creates_tab_with_header(tmp_path):
    path = tmp_path / "append.xlsx"
    w = writer.XlsxWriter(str(path))
    spec = layout.BY_KEY["strains"]
    w.append_row(spec.tab, spec.header, ["Blue Meanie", "Active", "", None,
                                         "high", 7, "Yes", "", "note"])
    w.commit()
    w.close()

    wb = load_workbook(path)
    ws = wb["Strain Library"]
    assert [c.value for c in ws[1]][:2] == ["Strain", "Status"]
    assert ws.cell(row=2, column=1).value == "Blue Meanie"


# --------------------------------------------------------------------------- #
# Mirror — opt-in, best-effort, never fatal
# --------------------------------------------------------------------------- #
def test_mirror_disabled_by_default(monkeypatch, seeded):
    monkeypatch.delenv("SHEET_SYNC_MIRROR", raising=False)
    strain = seeded.query(models.Strain).first()
    assert mirror.mirror("strains", strain) == {"mirrored": False, "reason": "disabled"}


def test_mirror_appends_when_enabled(monkeypatch, seeded, tmp_path):
    path = tmp_path / "live.xlsx"
    monkeypatch.setenv("SHEET_SYNC_MIRROR", "1")
    monkeypatch.setenv("MASTER_SHEET_PATH", str(path))
    # No Drive/Google env, so resolve_writer picks the local .xlsx.
    monkeypatch.delenv("MASTER_SHEET_GOOGLE_ID", raising=False)
    monkeypatch.delenv("MASTER_SHEET_FILE_ID", raising=False)

    strain = seeded.query(models.Strain).filter_by(name="Stargazer").one()
    result = mirror.mirror("strains", strain)
    assert result["mirrored"] is True

    wb = load_workbook(path)
    ws = wb["Strain Library"]
    assert ws.cell(row=2, column=1).value == "Stargazer"


def test_mirror_never_raises_on_bad_target(monkeypatch, seeded):
    monkeypatch.setenv("SHEET_SYNC_MIRROR", "1")
    # Point at a Google Sheet with no credentials -> resolve_writer raises,
    # but mirror must swallow it and report, not blow up the request.
    monkeypatch.setenv("MASTER_SHEET_GOOGLE_ID", "does-not-matter")
    monkeypatch.delenv("GOOGLE_SERVICE_ACCOUNT_JSON", raising=False)
    monkeypatch.delenv("GOOGLE_OAUTH_TOKEN", raising=False)
    monkeypatch.delenv("GOOGLE_ACCESS_TOKEN", raising=False)

    strain = seeded.query(models.Strain).first()
    result = mirror.mirror("strains", strain)
    assert result["mirrored"] is False
    assert "error" in result


# --------------------------------------------------------------------------- #
# API — status / push / download over the real app
# --------------------------------------------------------------------------- #
@pytest.fixture()
def client(tmp_path):
    """A TestClient whose request sessions hit an isolated temp SQLite DB.

    Overriding the get_db dependency (rather than reloading modules) keeps the
    shared app object intact and side-effect free for the other test files.
    """
    from backend.app.database import get_db
    from backend.app.main import app

    engine = create_engine(f"sqlite:///{tmp_path/'api.db'}", future=True)
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, future=True)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def test_status_reports_no_target_when_unconfigured(client, monkeypatch):
    for var in ("MASTER_SHEET_GOOGLE_ID", "MASTER_SHEET_FILE_ID", "MASTER_SHEET_PATH"):
        monkeypatch.delenv(var, raising=False)
    r = client.get("/api/sync/status")
    assert r.status_code == 200
    body = r.json()
    assert body["write_target"]["configured"] is False
    assert body["mirror_enabled"] is False


def test_status_read_source_honors_google_id(client, monkeypatch):
    # Read source and pull must agree: a native Google Sheet id is a valid
    # source, so status must report it (not fall back to the default file).
    for var in ("MASTER_SHEET_PATH", "MASTER_SHEET_FILE_ID"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("MASTER_SHEET_GOOGLE_ID", "sheet-abc")
    body = client.get("/api/sync/status").json()
    assert body["read_source"] == {"configured": True, "kind": "google_sheet", "ref": "sheet-abc"}
    # resolve_workbook uses the same id (no silent fall-back to DEFAULT_FILE_ID).
    from backend.app.sheet import source
    assert source.resolve_read_file_id() == "sheet-abc"


def test_push_then_download_over_api(client, monkeypatch, tmp_path):
    # Create a strain through the real API…
    r = client.post("/api/strains", json={"name": "API Strain", "ease_rating": 6})
    assert r.status_code == 201

    # …push to a local .xlsx target…
    target = tmp_path / "api-master.xlsx"
    monkeypatch.setenv("MASTER_SHEET_PATH", str(target))
    monkeypatch.delenv("MASTER_SHEET_GOOGLE_ID", raising=False)
    monkeypatch.delenv("MASTER_SHEET_FILE_ID", raising=False)
    push = client.post("/api/sync/push")
    assert push.status_code == 200, push.text
    assert push.json()["written"]["strains"] == 1
    assert target.exists()

    # …and the download endpoint returns a real .xlsx too.
    dl = client.get("/api/sync/workbook.xlsx")
    assert dl.status_code == 200
    assert dl.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    assert dl.content[:2] == b"PK"  # xlsx is a zip
