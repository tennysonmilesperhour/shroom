"""Tests for the Master Cultivation Reference importer.

Builds a structurally faithful sample workbook (banner rows, section sub-tables,
total rows) and asserts the parser extracts the right records and the SQLite
sink upserts them idempotently.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))

import pytest
from openpyxl import load_workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import master_reference_sample

from backend.app import models
from backend.app.database import Base
from backend.app.sheet import parse_workbook
from backend.app.sheet.sinks import SqliteSink


@pytest.fixture(scope="module")
def parsed(tmp_path_factory):
    path = master_reference_sample.build(tmp_path_factory.mktemp("sheet") / "master.xlsx")
    wb = load_workbook(path, read_only=True, data_only=True)
    return parse_workbook(wb)


def names(records):
    return {r.name for r in records}


# --- parser ---------------------------------------------------------------- #
def test_strains_merge_across_tabs(parsed):
    by_name = {s.name: s for s in parsed.strains}
    # Strain Library + Fridge + functional-incoming all land in one list.
    assert {"Stargazer", "Illusion Weaver", "Golden Teacher", "Natalensis",
            "Penis Envy", "Blue Meanie", "Blue Oyster", "Lion's Mane"} <= set(by_name)
    # "(bag)" suffix is stripped so the fridge + library rows merge.
    assert "Golden Teacher (bag)" not in by_name
    sg = by_name["Stargazer"]
    assert sg.ease_rating == 8
    assert sg.grow_again is True
    assert sg.library_status == "active"
    assert sg.mushroom_type == "psychedelic"
    assert sg.species == "Psilocybe cubensis"
    assert by_name["Natalensis"].species == "Psilocybe natalensis"
    assert by_name["Blue Oyster"].mushroom_type == "functional"
    # Fridge row contributes the syringe count + star priority to Golden Teacher.
    assert by_name["Golden Teacher"].syringes_on_hand == 1
    assert by_name["Golden Teacher"].priority == 4


def test_bulleted_duplicate_collapses_onto_canonical(parsed):
    # "• Stargazer" must strip its bullet and merge into the one "Stargazer"
    # row rather than importing as a distinct strain.
    names = [s.name for s in parsed.strains]
    assert "• Stargazer" not in names
    assert names.count("Stargazer") == 1


def test_order_notes_are_not_imported_as_strains(parsed):
    # A shipment note sitting in the strain column is not a culture.
    for s in parsed.strains:
        assert "order #" not in s.name.lower()
        assert not s.name.lower().startswith("new spores")


def test_vendors_split_into_supply_and_sourcing(parsed):
    by_name = {v.name: v for v in parsed.vendors}
    assert by_name["Sporeworks"].category == "spores"
    assert by_name["Sporeworks"].rating == 5
    assert by_name["Inkbird"].category == "supplies"
    assert by_name["Birch Boys"].category == "sourcing"
    assert by_name["Birch Boys"].contact_priority == "1st contact"
    # The "CHAGA NOTE" footnote row is not a vendor.
    assert "CHAGA NOTE" not in by_name


def test_equipment_stops_before_targets(parsed):
    by_name = {e.name for e in parsed.equipment}
    assert {"Martha Tent", "Humidifier", "CO2 Monitor"} == by_name  # not "Parameter"/targets


def test_customers_have_crm_fields(parsed):
    by_name = {c.name: c for c in parsed.customers}
    assert by_name["Jackie Brinkerhoff"].status == "in_contact"
    assert by_name["Jackie Brinkerhoff"].channel == "distributor"
    assert by_name["Harmons Grocery"].status == "not_contacted"
    assert by_name["Daniel Childs"].channel == "retail"


def test_jars_and_price_tiers(parsed):
    jars = {j.jar_id: j for j in parsed.jars}
    assert set(jars) == {"J-01", "J-02"}  # TOTAL row skipped
    assert jars["J-02"].used_g == 15
    tiers = {t.tier: t for t in parsed.price_tiers}
    assert tiers["wholesale"].min_per_gram == 3
    assert tiers["wholesale"].max_per_gram == 5
    assert tiers["distributor"].min_per_gram == 7


def test_sales_skips_total_rows(parsed):
    assert len(parsed.sales) == 2
    buyers = {s.buyer for s in parsed.sales}
    assert buyers == {"Daniel Childs", "Adam Nugent"}


def test_sourced_goods(parsed):
    by = {s.strain: s for s in parsed.sourced_goods}
    assert by["Cosmos"].on_hand_g == 112
    assert by["White Ape"].used_g == 8


def test_protocols_group_steps(parsed):
    by = {p.name: p for p in parsed.protocols}
    assert "Inoculation Day" in by
    assert "Harvest Day" in by
    assert len(by["Inoculation Day"].steps) == 3
    assert by["Harvest Day"].steps[0] == "Gloves on or thoroughly clean hands"


def test_troubleshooting_guides_and_incidents(parsed):
    contamination = [g for g in parsed.guides if g.guide_type == "contamination"]
    symptom = [g for g in parsed.guides if g.guide_type == "symptom"]
    assert {g.label for g in contamination} == {"Green/Black Mold (Trich)", "Overlay"}
    assert {g.label for g in symptom} == {"Stalled pins 4-5 days", "Long skinny stems"}
    assert len(parsed.incidents) == 2
    assert {i.issue for i in parsed.incidents} == {
        "F2 Stargazer pins damaged", "JMF colonization stalled — 87F"}


def test_batches_and_harvests(parsed):
    batches = {b.lot_code: b for b in parsed.batches}
    assert "T-01-F1" in batches
    assert batches["T-01-F1"].stage == "harvesting"
    # A tub with no transfer/pin/harvest date starts at the head of the
    # lifecycle. That's "colonization" — inoculation is the creation event, not
    # a stage (migration 14_drop_inoculation_stage).
    assert batches["T-03-F1"].stage == "colonization"
    harvests = {h.lot_code: h for h in parsed.harvests}
    assert harvests["T-01-F1"].fresh_g == 445
    assert harvests["T-02-F1"].dry_g == 46.8


# --- SQLite sink (idempotency) -------------------------------------------- #
@pytest.fixture()
def session(tmp_path):
    """A dedicated SQLite engine per test, independent of the global one so
    collection order with the other test modules can't interfere."""
    engine = create_engine(f"sqlite:///{tmp_path/'sink.db'}", future=True)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, future=True)
    db = Session()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def test_sqlite_sink_is_idempotent(parsed, session):
    first = SqliteSink(session).run(parsed)
    count_after_first = session.query(models.Strain).count()

    second = SqliteSink(session).run(parsed)
    assert first == second  # same row counts processed each run

    # Re-import must not grow any table — every row upserts in place.
    assert session.query(models.Strain).count() == count_after_first
    # Every parsed strain landed (plus any strain referenced only by a batch).
    db_names = {s.name.lower() for s in session.query(models.Strain).all()}
    assert {s.name.lower() for s in parsed.strains} <= db_names

    sg = session.query(models.Strain).filter(models.Strain.name == "Stargazer").one()
    assert sg.ease_rating == 8
    # One harvest per (tub, flush); fresh 445 g -> 0.445 kg.
    h = (
        session.query(models.Harvest)
        .join(models.Batch)
        .filter(models.Batch.lot_code == "T-01-F1")
        .one()
    )
    assert h.weight_kg == 0.445
    assert session.query(models.Customer).filter(models.Customer.name == "Daniel Childs").count() == 1
