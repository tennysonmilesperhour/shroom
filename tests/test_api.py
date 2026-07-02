"""End-to-end API tests against an in-memory SQLite database."""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Use a throwaway DB file for the test run, isolated from the dev shroom.db.
os.environ["SHROOM_DB_URL"] = "sqlite:///./test_shroom.db"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from backend.app import seed as seed_module
from backend.app.main import app


@pytest.fixture(scope="module")
def client():
    seed_module.seed()  # builds the Quantum Blue demo dataset
    with TestClient(app) as c:
        yield c
    Path("test_shroom.db").unlink(missing_ok=True)


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_seed_loaded(client):
    assert len(client.get("/api/strains").json()) == 5
    assert len(client.get("/api/batches").json()) == 5
    assert len(client.get("/api/orders").json()) == 2


def test_dashboard_kpis(client):
    d = client.get("/api/analytics/dashboard").json()
    assert d["active_batches"] >= 1
    assert d["blocks_in_production"] > 0
    assert d["revenue_period"] > 0


def test_dry_ratio_flag(client):
    """Stargazer F1 (445g/31.2g = 7%) must be flagged below the 7.5% floor."""
    dry = client.get("/api/analytics/dry-ratio").json()
    assert dry["dry_ratio_floor_pct"] == 7.5
    assert dry["flagged_below_floor"] >= 1
    f1 = next(r for r in dry["rows"] if r["lot_code"] == "STG-2605" and r["flush_number"] == 1)
    assert f1["below_floor"] is True
    assert f1["dry_ratio_pct"] == 7.0


def test_yield_forecast(client):
    yf = client.get("/api/analytics/batches/1/yield-forecast").json()
    assert yf["predicted_total_kg"] > yf["harvested_kg"]
    assert 0 <= yf["forecast_confidence"] <= 1


def test_environment_alerts(client):
    env = client.get("/api/environment/status").json()
    tent = next(e for e in env if e["room"] == "Fruiting Tent A")
    assert tent["in_spec"] is False
    assert any("CO" in a for a in tent["alerts"])


def test_recall_trace(client):
    t = client.get("/api/analytics/recall/STG-2605").json()
    assert t["affected_customer_count"] == 1
    assert t["affected_order_count"] == 1
    assert t["total_units_distributed"] == 28


def test_recall_unknown_lot_404(client):
    assert client.get("/api/analytics/recall/NOPE-9999").status_code == 404


def test_create_and_advance_batch(client):
    strain_id = client.get("/api/strains").json()[0]["id"]
    created = client.post("/api/batches", json={
        "lot_code": "TEST-0001", "strain_id": strain_id, "block_count": 5,
        "substrate_weight_kg": 12.0, "stage": "inoculation",
    })
    assert created.status_code == 201
    bid = created.json()["id"]
    adv = client.post(f"/api/batches/{bid}/advance", json={"stage": "fruiting", "note": "pinning"})
    assert adv.status_code == 200
    assert adv.json()["stage"] == "fruiting"
    assert adv.json()["fruiting_on"] is not None
    timeline = client.get(f"/api/batches/{bid}/timeline").json()
    assert len(timeline) == 2  # create + advance


def test_duplicate_lot_rejected(client):
    strain_id = client.get("/api/strains").json()[0]["id"]
    r = client.post("/api/batches", json={"lot_code": "STG-2605", "strain_id": strain_id})
    assert r.status_code == 409


def test_advisor_graceful_without_key(client):
    """With no ANTHROPIC_API_KEY, advisor returns live context, not an error."""
    saved = os.environ.pop("ANTHROPIC_API_KEY", None)
    try:
        r = client.post("/api/advisor/ask", json={"question": "status?"}).json()
        assert r["answered"] is False
        assert "ACTIVE BATCHES" in r["context_preview"]
    finally:
        if saved:
            os.environ["ANTHROPIC_API_KEY"] = saved


def test_circular_economy(client):
    ce = client.get("/api/analytics/circular-economy").json()
    assert ce["spent_substrate_kg"] > 0
    assert ce["estimated_co2e_diverted_kg"] > 0


def test_task_patch_is_partial(client):
    """A PATCH with a single field must not reset the task's other fields."""
    created = client.post(
        "/api/tasks",
        json={"title": "Dunk & reset SG F2", "description": "note", "priority": "high"},
    )
    assert created.status_code == 201
    tid = created.json()["id"]
    patched = client.patch(f"/api/tasks/{tid}", json={"status": "done"})
    assert patched.status_code == 200
    body = patched.json()
    assert body["status"] == "done"
    # These must survive the partial update rather than revert to schema defaults.
    assert body["priority"] == "high"
    assert body["description"] == "note"


def test_recall_units_by_uom(client):
    """Recall reports distributed quantity bucketed by unit of measure."""
    t = client.get("/api/analytics/recall/STG-2605").json()
    assert t["units_distributed_by_uom"].get("g") == 28


def test_strain_lineage_and_bad_parent(client):
    """Lineage walk works, and an unknown lineage parent is rejected (which also
    forecloses the self-referential infinite-loop path)."""
    parent = client.post("/api/strains", json={"name": "Lineage Parent"})
    assert parent.status_code == 201
    pid = parent.json()["id"]
    child = client.post(
        "/api/strains", json={"name": "Lineage Child", "lineage_parent_id": pid}
    )
    assert child.status_code == 201
    cid = child.json()["id"]
    lineage = client.get(f"/api/strains/{cid}/lineage").json()
    assert any(a["id"] == pid for a in lineage["ancestors"])

    bad = client.post(
        "/api/strains", json={"name": "Orphan", "lineage_parent_id": 999999}
    )
    assert bad.status_code == 400
