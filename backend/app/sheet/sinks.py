"""Persist parsed workbook records into the two data stores.

``SqliteSink`` writes through the SQLAlchemy models into the FastAPI reference
DB. ``SupabaseSink`` upserts via PostgREST into the live Postgres the web app
reads. Both are idempotent: re-running an import updates rows in place (keyed on
natural keys / content hashes) instead of duplicating them, which is what makes
the sheet a *live* source of truth rather than a one-shot seed.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

import httpx
from sqlalchemy.orm import Session

from .. import models
from .parse import ParsedWorkbook


def _iso(value: date | None) -> str | None:
    return value.isoformat() if value else None


def _prune(payload: dict) -> dict:
    """Drop keys whose value is None so DB column defaults apply."""
    return {k: v for k, v in payload.items() if v is not None}


# --------------------------------------------------------------------------- #
# SQLite (FastAPI reference backend)
# --------------------------------------------------------------------------- #
class SqliteSink:
    """Upsert into the SQLAlchemy models. Covers the entities the FastAPI model
    represents: strains, customers, and the batch -> harvest cultivation spine.
    """

    def __init__(self, session: Session):
        self.db = session

    def run(self, parsed: ParsedWorkbook) -> dict[str, int]:
        counts = {
            "strains": self._strains(parsed.strains),
            "customers": self._customers(parsed.customers),
            "batches": self._batches(parsed.batches),
            "harvests": self._harvests(parsed.harvests),
        }
        self.db.commit()
        return counts

    # -- strains ------------------------------------------------------------ #
    def _get_strain(self, name: str) -> models.Strain | None:
        return (
            self.db.query(models.Strain)
            .filter(models.Strain.name.ilike(name))
            .first()
        )

    def _strains(self, rows) -> int:
        n = 0
        for r in rows:
            obj = self._get_strain(r.name)
            if obj is None:
                obj = models.Strain(name=r.name)
                self.db.add(obj)
            obj.mushroom_type = r.mushroom_type or obj.mushroom_type
            if r.species:
                obj.species = r.species
            if r.vendor:
                obj.vendor = r.vendor
            if r.potency:
                obj.potency = r.potency
            if r.ease_rating is not None:
                obj.ease_rating = r.ease_rating
            if r.grow_again is not None:
                obj.grow_again = r.grow_again
            if r.notes:
                obj.notes = r.notes
            obj.active = r.library_status not in ("ordered", "awaiting")
            n += 1
        self.db.flush()
        return n

    def _ensure_strain(self, name: str) -> models.Strain:
        obj = self._get_strain(name)
        if obj is None:
            obj = models.Strain(name=name)
            self.db.add(obj)
            self.db.flush()
        return obj

    # -- customers ---------------------------------------------------------- #
    def _customers(self, rows) -> int:
        n = 0
        for r in rows:
            obj = (
                self.db.query(models.Customer)
                .filter(models.Customer.name.ilike(r.name))
                .first()
            )
            if obj is None:
                obj = models.Customer(name=r.name)
                self.db.add(obj)
            obj.channel = r.channel or obj.channel
            note = " · ".join(p for p in [r.role, r.price_tier, r.notes] if p)
            if note:
                obj.notes = note
            n += 1
        self.db.flush()
        return n

    # -- batches + harvests ------------------------------------------------- #
    def _batches(self, rows) -> int:
        n = 0
        for r in rows:
            strain = self._ensure_strain(r.strain)
            obj = (
                self.db.query(models.Batch)
                .filter(models.Batch.lot_code == r.lot_code)
                .first()
            )
            if obj is None:
                obj = models.Batch(lot_code=r.lot_code, strain_id=strain.id)
                self.db.add(obj)
            obj.strain_id = strain.id
            obj.stage = r.stage
            obj.inoculated_on = r.inoculated_on
            obj.colonized_on = r.transferred_on
            obj.fruiting_on = r.first_pins_on
            obj.contamination_flag = r.contamination_flag
            obj.notes = " · ".join(p for p in [r.issues, r.notes] if p)
            n += 1
        self.db.flush()
        return n

    def _get_or_create_batch(self, lot_code: str, strain_name: str) -> models.Batch:
        obj = (
            self.db.query(models.Batch)
            .filter(models.Batch.lot_code == lot_code)
            .first()
        )
        if obj is None:
            strain = self._ensure_strain(strain_name)
            obj = models.Batch(lot_code=lot_code, strain_id=strain.id, stage="harvesting")
            self.db.add(obj)
            self.db.flush()
        return obj

    def _harvests(self, rows) -> int:
        n = 0
        for r in rows:
            if r.harvested_on is None:
                continue  # harvested_on is required; an undated row isn't a harvest yet
            # Batches are keyed by container, so a flush resolves to its tub.
            batch = self._get_or_create_batch(r.tub or r.lot_code, r.strain)
            obj = (
                self.db.query(models.Harvest)
                .filter(
                    models.Harvest.batch_id == batch.id,
                    models.Harvest.flush_number == r.flush_number,
                )
                .first()
            )
            if obj is None:
                obj = models.Harvest(batch_id=batch.id, flush_number=r.flush_number,
                                     harvested_on=r.harvested_on)
                self.db.add(obj)
            obj.harvested_on = r.harvested_on
            obj.weight_kg = round(r.fresh_g / 1000, 4)
            obj.dry_weight_kg = round(r.dry_g / 1000, 4)
            if r.notes:
                obj.notes = r.notes
            n += 1
        self.db.flush()
        return n


# --------------------------------------------------------------------------- #
# Supabase (PostgREST) — the live store the web app reads
# --------------------------------------------------------------------------- #
class SupabaseSink:
    """Upsert into Supabase over PostgREST. Each table is upserted on a natural
    key (declared unique in migration 15) so re-imports merge rather than dupe.
    """

    def __init__(self, url: str, service_key: str, *, timeout: float = 30.0):
        self.base = url.rstrip("/") + "/rest/v1"
        self.client = httpx.Client(
            timeout=timeout,
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
            },
        )

    def close(self) -> None:
        self.client.close()

    def __enter__(self) -> "SupabaseSink":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def _upsert(self, table: str, rows: list[dict], on_conflict: str) -> int:
        rows = [_prune(r) for r in rows if r]
        if not rows:
            return 0
        resp = self.client.post(
            f"{self.base}/{table}",
            params={"on_conflict": on_conflict},
            headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
            json=rows,
        )
        resp.raise_for_status()
        return len(rows)

    def _strain_id_map(self) -> dict[str, int]:
        resp = self.client.get(f"{self.base}/strains", params={"select": "id,name"})
        resp.raise_for_status()
        return {row["name"].lower(): row["id"] for row in resp.json()}

    def _batch_id_map(self) -> dict[str, int]:
        resp = self.client.get(f"{self.base}/batches", params={"select": "id,lot_code"})
        resp.raise_for_status()
        return {row["lot_code"]: row["id"] for row in resp.json()}

    def run(self, parsed: ParsedWorkbook, *, source: str = "drive", request_id: str | None = None) -> dict[str, int]:
        from uuid import uuid4
        plan = build_import_plan(parsed)
        response = self.client.post(f"{self.base}/rpc/import_workbook", json={
            "p_tables": plan, "p_source": source[:255],
            "p_request_id": request_id or str(uuid4()),
        })
        response.raise_for_status()
        return response.json()

    def _run_tables(self, parsed: ParsedWorkbook) -> dict[str, int]:
        counts: dict[str, int] = {}

        counts["strains"] = self._upsert("strains", [
            _prune({
                "name": s.name, "mushroom_type": s.mushroom_type, "species": s.species,
                "vendor": s.vendor, "potency": s.potency, "ease_rating": s.ease_rating,
                "grow_again": s.grow_again, "library_status": s.library_status,
                "priority": s.priority, "syringes_on_hand": s.syringes_on_hand,
                "acquired_on": _iso(s.acquired_on), "notes": s.notes,
            }) for s in parsed.strains
        ], on_conflict="name")

        counts["vendors"] = self._upsert("vendors", [{
            "name": v.name, "category": v.category, "products": v.products,
            "url": v.url, "rating": v.rating, "contact_priority": v.contact_priority,
            "notes": v.notes,
        } for v in parsed.vendors], on_conflict="name")

        counts["equipment"] = self._upsert("equipment", [{
            "name": e.name, "spec_notes": e.spec_notes, "status": e.status,
            "last_checked": e.last_checked,
        } for e in parsed.equipment], on_conflict="name")

        counts["customers"] = self._upsert("customers", [{
            "name": c.name, "channel": c.channel, "status": c.status, "role": c.role,
            "price_tier": c.price_tier, "volume_est": c.volume_est,
            "last_contact": _iso(c.last_contact), "notes": c.notes,
        } for c in parsed.customers], on_conflict="name")

        counts["price_tiers"] = self._upsert("price_tiers", [{
            "tier": t.tier, "product_class": t.product_class,
            "min_per_gram": t.min_per_gram, "max_per_gram": t.max_per_gram,
            "notes": t.notes,
        } for t in parsed.price_tiers], on_conflict="tier,product_class")

        counts["protocols"] = self._upsert("protocols", [{
            "name": p.name, "category": p.category, "steps": p.steps,
        } for p in parsed.protocols], on_conflict="name")

        counts["reference_guides"] = self._upsert("reference_guides", [{
            "guide_type": g.guide_type, "label": g.label, "appearance": g.appearance,
            "cause": g.cause, "action": g.action,
        } for g in parsed.guides], on_conflict="guide_type,label")

        counts["issue_log"] = self._upsert("issue_log", [{
            "log_date": _iso(i.log_date), "issue": i.issue, "root_cause": i.root_cause,
            "resolution": i.resolution,
        } for i in parsed.incidents], on_conflict="log_date,issue")

        counts["sourced_finished_goods"] = self._upsert("sourced_finished_goods", [{
            "strain": s.strain, "on_hand_g": s.on_hand_g, "used_g": s.used_g,
            "incoming": s.incoming, "last_updated": _iso(s.last_updated), "notes": s.notes,
        } for s in parsed.sourced_goods], on_conflict="strain")

        counts["sales_log"] = self._upsert("sales_log", [{
            "sale_date": _iso(s.sale_date), "buyer": s.buyer, "strains": s.strains,
            "grams": s.grams, "amount": s.amount, "tier": s.tier,
            "source_notes": s.source_notes, "payment": s.payment,
        } for s in parsed.sales], on_conflict="sale_date,buyer,strains,amount")

        # Cultivation spine needs FK resolution: strains -> batches -> harvests.
        strain_ids = self._strain_id_map()
        counts["batches"] = self._upsert("batches", [
            _prune({
                "lot_code": b.lot_code, "strain_id": strain_ids.get(b.strain.lower()),
                "stage": b.stage, "container_id": b.container_id, "container_type": "tub",
                "inoculated_on": _iso(b.inoculated_on), "transferred_on": _iso(b.transferred_on),
                "first_pins_on": _iso(b.first_pins_on), "contamination_flag": b.contamination_flag,
                "issues": b.issues, "notes": b.notes,
            }) for b in parsed.batches if strain_ids.get(b.strain.lower())
        ], on_conflict="lot_code")

        batch_ids = self._batch_id_map()
        counts["dry_inventory"] = self._upsert("dry_inventory", [
            _prune({
                "jar_id": j.jar_id, "strain_id": strain_ids.get(j.strain.lower()),
                "flush_number": j.flush_number, "dry_weight_g": j.dry_weight_g,
                "used_g": j.used_g, "notes": j.notes,
            }) for j in parsed.jars
        ], on_conflict="jar_id")

        # A harvest hangs off the tub (batches are one-per-container); its own
        # tub+flush code stays the source_ref so re-imports still merge in place.
        counts["harvests"] = self._upsert("harvests", [
            _prune({
                "batch_id": batch_ids.get(h.tub), "harvested_on": _iso(h.harvested_on),
                "flush_number": h.flush_number, "weight_kg": round(h.fresh_g / 1000, 4),
                "dry_weight_kg": round(h.dry_g / 1000, 4), "notes": h.notes,
                "source_ref": h.lot_code,
            }) for h in parsed.harvests
            if batch_ids.get(h.tub) and h.harvested_on
        ], on_conflict="source_ref")

        self._log_run(counts)
        return counts

    def _log_run(self, counts: dict[str, int]) -> None:
        """Record the run in sheet_imports. Best-effort: a logging failure must
        not fail an otherwise-successful import."""
        try:
            self.client.post(
                f"{self.base}/sheet_imports",
                headers={"Prefer": "return=minimal"},
                json={
                    "source": "drive",
                    "status": "ok",
                    "rows_upserted": counts,
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        except httpx.HTTPError:
            pass


class _PlanSink(SupabaseSink):
    """Reuse the canonical field mapping without performing network requests."""
    def __init__(self, parsed: ParsedWorkbook):
        self.tables: dict[str, list[dict]] = {}
        self.strain_names = {i + 1: s.name for i, s in enumerate(parsed.strains)}
        self.batch_codes = {i + 1: b.lot_code for i, b in enumerate(parsed.batches)}

    def _upsert(self, table: str, rows: list[dict], on_conflict: str) -> int:
        output = []
        for row in rows:
            row = _prune(row)
            if "strain_id" in row:
                row["_strain_name"] = self.strain_names[row.pop("strain_id")]
            if "batch_id" in row:
                row["_batch_lot_code"] = self.batch_codes[row.pop("batch_id")]
            output.append(row)
        self.tables[table] = output
        return len(output)

    def _strain_id_map(self):
        return {name.lower(): i for i, name in self.strain_names.items()}

    def _batch_id_map(self):
        return {code: i for i, code in self.batch_codes.items()}

    def _log_run(self, counts):
        pass


def build_import_plan(parsed: ParsedWorkbook) -> dict[str, list[dict]]:
    """Resolve sheet relationships by natural key inside one DB transaction.

    A workbook containing only a Harvest Tracker still creates its referenced
    batch and strain. Inferred rows never overwrite an existing app record.
    """
    from copy import deepcopy
    from .parse import Strain, Batch
    parsed = deepcopy(parsed)
    known_strains = {s.name.lower() for s in parsed.strains}
    inferred_strains = set()
    for name in [b.strain for b in parsed.batches] + [h.strain for h in parsed.harvests] + [j.strain for j in parsed.jars]:
        if name and name.lower() not in known_strains:
            parsed.strains.append(Strain(name=name))
            known_strains.add(name.lower())
            inferred_strains.add(name)
    known_batches = {b.lot_code for b in parsed.batches}
    inferred_batches = set()
    for h in parsed.harvests:
        if h.tub and h.strain and h.harvested_on and h.tub not in known_batches:
            parsed.batches.append(Batch(lot_code=h.tub, strain=h.strain, container_id=h.tub, stage="harvesting"))
            known_batches.add(h.tub)
            inferred_batches.add(h.tub)
    sink = _PlanSink(parsed)
    sink._run_tables(parsed)
    for row in sink.tables["strains"]:
        if row["name"] in inferred_strains:
            name = row["name"]
            row.clear()
            row.update({"name": name, "_ensure_only": True})
    for row in sink.tables["batches"]:
        if row["lot_code"] in inferred_batches:
            row["_ensure_only"] = True
    return sink.tables
