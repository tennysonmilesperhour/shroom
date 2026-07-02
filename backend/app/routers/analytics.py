"""Analytics & intelligence layer.

This is where the app goes beyond record-keeping into the capabilities that
define the industry leaders (forecasting, yield projection, traceability) plus
the innovation modules described in the README.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(tags=["analytics"])

KG_TO_LB = 2.20462


def _biological_efficiency(fresh_kg: float, substrate_kg: float, moisture: float = 0.70) -> float:
    """BE% = fresh yield / substrate DRY weight * 100.

    Substrate is assumed ~70% moisture by default, so dry weight = wet * 0.30.
    """
    dry = substrate_kg * (1 - moisture)
    return round((fresh_kg / dry) * 100, 1) if dry > 0 else 0.0


# --------------------------------------------------------------------------- #
# Executive dashboard
# --------------------------------------------------------------------------- #
@router.get("/analytics/dashboard")
def dashboard(period_days: int = 30, db: Session = Depends(get_db)):
    since = date.today() - timedelta(days=period_days)

    active_batches = db.scalar(
        select(func.count(models.Batch.id)).where(
            models.Batch.stage.in_(["colonization", "fruiting", "harvesting"])
        )
    )
    blocks_in_production = db.scalar(
        select(func.coalesce(func.sum(models.Batch.block_count), 0)).where(
            models.Batch.stage.in_(["inoculation", "colonization", "fruiting", "harvesting"])
        )
    )
    harvested_kg = db.scalar(
        select(func.coalesce(func.sum(models.Harvest.weight_kg), 0)).where(
            models.Harvest.harvested_on >= since
        )
    )
    # Contamination rate over the period. A batch counts as contaminated if it
    # carries the flag (set on stage→contaminated or a high-severity log) OR has
    # any contamination log against it — low/medium sightings never set the flag
    # but are still contamination events. Denominator is period batches, so the
    # rate tracks the same window as the rest of the dashboard.
    period_batch_ids = set(
        db.scalars(select(models.Batch.id).where(models.Batch.created_at >= since)).all()
    )
    total_batches = len(period_batch_ids)
    flagged_ids = set(
        db.scalars(
            select(models.Batch.id).where(
                models.Batch.created_at >= since,
                models.Batch.contamination_flag.is_(True),
            )
        ).all()
    )
    logged_ids = set(
        db.scalars(
            select(models.ContaminationLog.batch_id).where(
                models.ContaminationLog.observed_on >= since
            )
        ).all()
    )
    contaminated = len(flagged_ids | (logged_ids & period_batch_ids))
    open_tasks = db.scalar(
        select(func.count(models.Task.id)).where(models.Task.status != "done")
    )
    low_stock = [i for i in db.scalars(select(models.InventoryItem)).all() if i.needs_reorder]

    # Revenue from fulfilled/paid orders in the period.
    revenue = 0.0
    for order in db.scalars(
        select(models.Order).where(
            models.Order.order_date >= since,
            models.Order.status.in_(["fulfilled", "paid", "confirmed"]),
        )
    ).all():
        revenue += order.total

    return {
        "period_days": period_days,
        "active_batches": active_batches or 0,
        "blocks_in_production": blocks_in_production or 0,
        "harvested_kg": round(harvested_kg or 0, 1),
        "harvested_lb": round((harvested_kg or 0) * KG_TO_LB, 1),
        "contamination_rate_pct": round((contaminated / total_batches * 100), 1) if total_batches else 0.0,
        "open_tasks": open_tasks or 0,
        "low_stock_count": len(low_stock),
        "low_stock_items": [i.name for i in low_stock],
        "revenue_period": round(revenue, 2),
    }


# --------------------------------------------------------------------------- #
# Yield: actuals by strain + per-batch biological efficiency
# --------------------------------------------------------------------------- #
@router.get("/analytics/yield-by-strain")
def yield_by_strain(db: Session = Depends(get_db)):
    rows: dict[int, dict] = {}
    for batch in db.scalars(select(models.Batch)).all():
        fresh = sum(h.weight_kg for h in batch.harvests)
        entry = rows.setdefault(
            batch.strain_id,
            {"strain": batch.strain.name if batch.strain else "?", "fresh_kg": 0.0,
             "substrate_kg": 0.0, "batches": 0},
        )
        entry["fresh_kg"] += fresh
        # Only count substrate from batches that have actually harvested, so
        # realized biological efficiency isn't diluted by in-progress batches
        # (colonizing/fruiting) that carry substrate but no yield yet.
        if batch.harvests:
            entry["substrate_kg"] += batch.substrate_weight_kg
        entry["batches"] += 1

    out = []
    for sid, e in rows.items():
        out.append(
            {
                "strain_id": sid,
                "strain": e["strain"],
                "batches": e["batches"],
                "fresh_kg": round(e["fresh_kg"], 1),
                "fresh_lb": round(e["fresh_kg"] * KG_TO_LB, 1),
                "biological_efficiency_pct": _biological_efficiency(e["fresh_kg"], e["substrate_kg"]),
            }
        )
    return sorted(out, key=lambda r: r["fresh_kg"], reverse=True)


# --------------------------------------------------------------------------- #
# Dry-ratio quality monitor (Isaac's 7.5% rule) + fresh/dry totals
# --------------------------------------------------------------------------- #
@router.get("/analytics/dry-ratio")
def dry_ratio_report(db: Session = Depends(get_db)):
    """Flush-by-flush fresh/dry ratios with low-ratio flags and rollups.

    Replaces the hardcoded HARVESTS array + yellow-flag logic from grow_ops.jsx
    with a live, queryable equivalent.
    """
    harvests = db.scalars(
        select(models.Harvest).order_by(models.Harvest.harvested_on.desc())
    ).all()
    rows, total_fresh, total_dry, flagged = [], 0.0, 0.0, 0
    for h in harvests:
        total_fresh += h.weight_kg
        total_dry += h.dry_weight_kg
        if h.below_dry_floor:
            flagged += 1
        rows.append(
            {
                "harvest_id": h.id,
                "lot_code": h.batch.lot_code if h.batch else None,
                "strain": h.batch.strain.name if h.batch and h.batch.strain else None,
                "harvested_on": h.harvested_on,
                "flush_number": h.flush_number,
                "fresh_g": round(h.weight_kg * 1000, 1),
                "dry_g": round(h.dry_weight_kg * 1000, 1),
                "dry_ratio_pct": h.dry_ratio_pct,
                "below_floor": h.below_dry_floor,
            }
        )
    overall = round((total_dry / total_fresh) * 100, 1) if total_fresh else 0.0
    return {
        "dry_ratio_floor_pct": models.DRY_RATIO_FLOOR,
        "total_fresh_g": round(total_fresh * 1000, 1),
        "total_dry_g": round(total_dry * 1000, 1),
        "overall_dry_ratio_pct": overall,
        "flushes": len(rows),
        "flagged_below_floor": flagged,
        "rows": rows,
    }


# --------------------------------------------------------------------------- #
# INNOVATION #2 — Predictive yield / digital-twin projection
# --------------------------------------------------------------------------- #
@router.get("/analytics/batches/{batch_id}/yield-forecast")
def yield_forecast(batch_id: int, db: Session = Depends(get_db)):
    """Project a batch's remaining yield from strain priors + actuals so far.

    predicted_total = substrate_dry * typical_BE%   (the biological ceiling)
    remaining       = predicted_total - harvested_so_far
    Confidence rises as more flushes come in versus the strain's typical count.
    """
    batch = db.get(models.Batch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found")
    strain = batch.strain

    dry = batch.substrate_weight_kg * 0.30
    predicted_total = round(dry * (strain.typical_be / 100), 2) if strain else 0.0
    harvested = round(sum(h.weight_kg for h in batch.harvests), 2)
    flushes_done = len({h.flush_number for h in batch.harvests})
    typical_flushes = strain.typical_flushes if strain else 3
    confidence = round(min(flushes_done / typical_flushes, 1.0), 2) if typical_flushes else 0.0

    return {
        "batch_id": batch.id,
        "lot_code": batch.lot_code,
        "strain": strain.name if strain else None,
        "substrate_weight_kg": batch.substrate_weight_kg,
        "predicted_total_kg": predicted_total,
        "harvested_kg": harvested,
        "remaining_kg": round(max(predicted_total - harvested, 0), 2),
        "realized_be_pct": _biological_efficiency(harvested, batch.substrate_weight_kg),
        "target_be_pct": strain.typical_be if strain else None,
        "flushes_done": flushes_done,
        "typical_flushes": typical_flushes,
        "forecast_confidence": confidence,
    }


# --------------------------------------------------------------------------- #
# Labor: picker productivity (lbs / hour) — MycoSense-style workforce metric
# --------------------------------------------------------------------------- #
@router.get("/analytics/picker-productivity")
def picker_productivity(db: Session = Depends(get_db)):
    agg: dict[int, dict] = defaultdict(lambda: {"kg": 0.0, "minutes": 0.0, "name": "?"})
    for h in db.scalars(select(models.Harvest).where(models.Harvest.picker_id.isnot(None))).all():
        a = agg[h.picker_id]
        a["kg"] += h.weight_kg
        a["minutes"] += h.labor_minutes
        a["name"] = h.picker.name if h.picker else "?"

    out = []
    for pid, a in agg.items():
        hours = a["minutes"] / 60 if a["minutes"] else 0
        out.append(
            {
                "picker_id": pid,
                "picker": a["name"],
                "total_kg": round(a["kg"], 1),
                "total_lb": round(a["kg"] * KG_TO_LB, 1),
                "hours": round(hours, 1),
                "lb_per_hour": round((a["kg"] * KG_TO_LB) / hours, 1) if hours else None,
            }
        )
    return sorted(out, key=lambda r: r["lb_per_hour"] or 0, reverse=True)


# --------------------------------------------------------------------------- #
# Sales breakdown by channel
# --------------------------------------------------------------------------- #
@router.get("/analytics/sales-by-channel")
def sales_by_channel(period_days: int = 90, db: Session = Depends(get_db)):
    since = date.today() - timedelta(days=period_days)
    agg: dict[str, float] = defaultdict(float)
    for order in db.scalars(
        select(models.Order).where(
            models.Order.order_date >= since,
            models.Order.status != "cancelled",
        )
    ).all():
        agg[order.channel] += order.total
    total = sum(agg.values())
    return {
        "period_days": period_days,
        "total_revenue": round(total, 2),
        "channels": [
            {"channel": ch, "revenue": round(v, 2), "share_pct": round(v / total * 100, 1) if total else 0}
            for ch, v in sorted(agg.items(), key=lambda kv: kv[1], reverse=True)
        ],
    }


# --------------------------------------------------------------------------- #
# INNOVATION #5 — One-click FSMA-204 style recall trace
# --------------------------------------------------------------------------- #
@router.get("/analytics/recall/{lot_code}")
def recall_trace(lot_code: str, db: Session = Depends(get_db)):
    """Forward-trace a lot to every affected customer & shipment in seconds.

    lot_code -> batch -> harvests -> order lines -> orders -> customers
    """
    batch = db.scalar(select(models.Batch).where(models.Batch.lot_code == lot_code))
    if not batch:
        raise HTTPException(404, f"No batch with lot code '{lot_code}'")

    harvest_ids = [h.id for h in batch.harvests]
    affected_orders, affected_customers = [], {}
    # Quantities can be in different units per product (g dried vs lb fresh), so
    # a single scalar total is misleading — bucket by unit instead.
    units_by_uom: dict[str, float] = defaultdict(float)

    if harvest_ids:
        lines = db.scalars(
            select(models.OrderLine).where(models.OrderLine.harvest_id.in_(harvest_ids))
        ).all()
        for line in lines:
            order = line.order
            cust = order.customer
            uom = (line.product.unit if line.product and line.product.unit else "unit")
            units_by_uom[uom] += line.quantity
            affected_orders.append(
                {
                    "order_number": order.order_number,
                    "order_date": order.order_date,
                    "customer": cust.name if cust else None,
                    "channel": order.channel,
                    "product": line.product.name if line.product else None,
                    "quantity": line.quantity,
                    "fulfillment_date": order.fulfillment_date,
                }
            )
            if cust:
                affected_customers[cust.id] = {
                    "name": cust.name,
                    "channel": cust.channel,
                    "contact_email": cust.contact_email,
                    "phone": cust.phone,
                }

    return {
        "lot_code": lot_code,
        "strain": batch.strain.name if batch.strain else None,
        "stage": batch.stage,
        "harvests": len(harvest_ids),
        # Distributed quantity bucketed by unit of measure. Summing across units
        # (g dried vs lb fresh vs each) is not physically meaningful, so the
        # breakdown is authoritative; total_units_distributed is retained as a
        # raw line-quantity sum for backward compatibility only.
        "units_distributed_by_uom": {u: round(q, 2) for u, q in sorted(units_by_uom.items())},
        "total_units_distributed": round(sum(units_by_uom.values()), 2),
        "affected_order_count": len(affected_orders),
        "affected_customer_count": len(affected_customers),
        "affected_orders": affected_orders,
        "affected_customers": list(affected_customers.values()),
    }


# --------------------------------------------------------------------------- #
# INNOVATION #3 — Spent-substrate circular economy & carbon ledger
# --------------------------------------------------------------------------- #
@router.get("/analytics/circular-economy")
def circular_economy(db: Session = Depends(get_db)):
    """Quantify spent mushroom substrate (SMS) available for resale/reuse.

    Each spent block becomes feedstock for compost, biochar, animal feed, or
    secondary crops — a revenue stream and a sequestered-carbon line item.
    """
    spent_batches = db.scalars(
        select(models.Batch).where(models.Batch.stage == "spent")
    ).all()
    total_sms_kg = sum(b.substrate_weight_kg for b in spent_batches)
    # Rough public factors: ~0.18 kg CO2e diverted per kg SMS composted; SMS
    # sells to growers/landscapers around $0.10/kg as a soil amendment.
    return {
        "spent_batches": len(spent_batches),
        "spent_substrate_kg": round(total_sms_kg, 1),
        "estimated_co2e_diverted_kg": round(total_sms_kg * 0.18, 1),
        "estimated_resale_value_usd": round(total_sms_kg * 0.10, 2),
        "suggested_offtakes": ["compost / vermicompost", "biochar feedstock", "livestock feed", "secondary oyster flush"],
    }
