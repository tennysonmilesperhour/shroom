"""AI grow advisor.

This is the server-side, hardened evolution of the grow_ops.jsx "Advisor" tab.
Two key differences from the artifact version:

  1. Context is assembled LIVE from the database on every call, not hardcoded
     into a system prompt — so the advisor always reflects current reality.
  2. The API key is read from the ANTHROPIC_API_KEY environment variable on the
     server, never shipped to the browser. If no key is configured the endpoint
     still returns the full assembled grow context so the UI degrades gracefully.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(tags=["advisor"])

ADVISOR_MODEL = os.environ.get("SHROOM_ADVISOR_MODEL", "claude-sonnet-4-5")


def build_grow_context(db: Session) -> str:
    """Serialize the current state of the operation into a compact briefing."""
    lines: list[str] = []

    active = db.scalars(
        select(models.Batch).where(
            models.Batch.stage.in_(["colonization", "spawn_to_bulk", "fruiting", "harvesting"])
        )
    ).all()
    lines.append("ACTIVE BATCHES:")
    for b in active:
        lines.append(
            f"  - {b.lot_code} | {b.strain.name if b.strain else '?'} | stage={b.stage} "
            f"| {b.block_count} units | room={b.room.name if b.room else '—'}"
        )

    lines.append("\nRECENT HARVESTS (fresh g / dry g / ratio):")
    for h in db.scalars(
        select(models.Harvest).order_by(models.Harvest.harvested_on.desc()).limit(8)
    ).all():
        flag = " ⚠ LOW DRY RATIO" if h.below_dry_floor else ""
        lines.append(
            f"  - {h.harvested_on} {h.batch.strain.name if h.batch and h.batch.strain else '?'} "
            f"F{h.flush_number}: {round(h.weight_kg*1000)}g / {round(h.dry_weight_kg*1000)}g "
            f"= {h.dry_ratio_pct}%{flag}"
        )

    lines.append("\nENVIRONMENT (latest per room):")
    for room in db.scalars(select(models.Room)).all():
        latest = db.scalar(
            select(models.EnvironmentReading)
            .where(models.EnvironmentReading.room_id == room.id)
            .order_by(models.EnvironmentReading.recorded_at.desc())
            .limit(1)
        )
        if latest:
            lines.append(
                f"  - {room.name}: {latest.temp_c}°C / {latest.humidity}%RH / "
                f"{latest.co2_ppm}ppm CO₂ / FAE {latest.fae_per_hr}/hr "
                f"(targets {room.target_temp_c}°C, {room.target_humidity}%, "
                f"{room.target_co2_ppm}ppm, {room.target_fae_per_hr}/hr)"
            )

    low = [i.name for i in db.scalars(select(models.InventoryItem)).all() if i.needs_reorder]
    if low:
        lines.append("\nLOW STOCK: " + ", ".join(low))

    return "\n".join(lines)


SYSTEM_PROMPT = (
    "You are the grow advisor for a dual-track psychedelic + functional mushroom "
    "cultivation operation running a grain-bag-to-tub workflow. Give specific, "
    "practical guidance grounded in the live operation data provided. Common "
    "recurring issues to watch for: CO₂-driven flush stalls, low dry ratios from "
    "wet substrate, humidity loss from heater condensation. Be concise and concrete."
)


class AdvisorQuery(BaseModel):
    question: str


@router.get("/advisor/context")
def advisor_context(db: Session = Depends(get_db)):
    """Expose the assembled live context (useful for debugging / transparency)."""
    return {"model": ADVISOR_MODEL, "context": build_grow_context(db)}


@router.post("/advisor/ask")
def advisor_ask(query: AdvisorQuery, db: Session = Depends(get_db)):
    context = build_grow_context(db)
    api_key = os.environ.get("ANTHROPIC_API_KEY")

    if not api_key:
        return {
            "answered": False,
            "reason": "ANTHROPIC_API_KEY not configured on the server.",
            "model": ADVISOR_MODEL,
            "context_preview": context,
            "question": query.question,
        }

    try:
        import httpx

        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": ADVISOR_MODEL,
                "max_tokens": 1024,
                "system": f"{SYSTEM_PROMPT}\n\n--- LIVE OPERATION STATE ---\n{context}",
                "messages": [{"role": "user", "content": query.question}],
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        text = "".join(block.get("text", "") for block in data.get("content", []))
        return {"answered": True, "model": ADVISOR_MODEL, "answer": text}
    except Exception as exc:  # noqa: BLE001 - surface any upstream/API failure to the UI
        return {"answered": False, "reason": f"Advisor call failed: {exc}", "model": ADVISOR_MODEL}
