import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SheetClient, sheetWritebackConfig } from "./google";
import {
  BATCH_TAB,
  CUSTOMER_TAB,
  HARVEST_TAB,
  STRAIN_TAB,
  findTab,
  planBatch,
  planCustomer,
  planHarvest,
  planStrain,
  type Plan,
} from "./plan";

// App → sheet write-back. Every app write already lands in sheet_sync_queue
// (lib/sync.ts); this turns a queue entry into the matching cell edits on the
// Master Cultivation Reference and marks it synced.
//
// Only the tabs the importer reads back are touched (Strain Library, Grow
// Cycle Log, Harvest Tracker, Buyers & Pricing). Updates change only the
// fields that were edited in the app; inserts append a row; deletes never
// remove sheet rows (they stay pending for a person to reconcile).

export const MAPPED_ENTITIES = new Set(["strain", "customer", "batch", "harvest"]);

export interface QueueRow {
  id: number;
  entity: string;
  entity_id: number;
  op: "insert" | "update" | "delete";
  payload: Record<string, unknown> | null;
}

export interface WritebackOutcome {
  entity: string;
  entityId: number;
  status: "written" | "unchanged" | "skipped" | "unmapped" | "error";
  detail?: string;
}

export function writebackConfigured(): boolean {
  return sheetWritebackConfig() !== null;
}

// Fields each tab can represent. An update only syncs the intersection of
// these with what the app actually changed, so an unrelated edit never
// overwrites a sheet cell someone changed by hand.
const SYNCED_FIELDS: Record<string, string[]> = {
  strain: ["vendor", "potency", "ease_rating", "grow_again", "notes", "mushroom_type", "species", "library_status", "acquired_on"],
  customer: ["price_tier", "role", "volume_est", "last_contact", "status", "notes"],
  batch: ["strain_id", "inoculated_on", "transferred_on", "first_pins_on", "contamination_flag", "issues", "notes"],
  harvest: ["weight_kg", "dry_weight_kg", "notes", "fresh_g", "dry_g"],
};

function only<T extends object>(record: T, changed: Set<string> | null, fields: (keyof T & string)[]): T {
  if (!changed) return record;
  const out = { ...record };
  for (const f of fields) if (!changed.has(f)) (out as Record<string, unknown>)[f] = undefined;
  return out;
}

type Tab = { candidates: string[] };
const TABS: Record<string, Tab> = {
  strain: { candidates: STRAIN_TAB },
  customer: { candidates: CUSTOMER_TAB },
  batch: { candidates: BATCH_TAB },
  harvest: { candidates: HARVEST_TAB },
};

async function planFor(
  supabase: SupabaseClient,
  sheet: SheetClient,
  entity: string,
  id: number,
  changed: Set<string> | null,
  previousName: string | undefined,
  allowAppend: boolean,
): Promise<{ tab: string; plan: Plan } | { skipped: string }> {
  const tab = findTab(await sheet.tabTitles(), ...TABS[entity].candidates);
  if (!tab) return { skipped: `No “${TABS[entity].candidates[0]}” tab in the sheet` };
  const grid = await sheet.grid(tab);

  if (entity === "strain") {
    const { data, error } = await supabase
      .from("strains")
      .select("name,vendor,potency,ease_rating,grow_again,notes,mushroom_type,species,library_status,acquired_on")
      .eq("id", id)
      .single();
    if (error || !data) return { skipped: "Strain no longer exists" };
    const rec = only(data, changed, ["vendor", "potency", "ease_rating", "grow_again", "notes", "mushroom_type", "species", "library_status", "acquired_on"]);
    return { tab, plan: planStrain(grid, rec, { previousName, allowAppend }) };
  }

  if (entity === "customer") {
    const { data, error } = await supabase
      .from("customers")
      .select("name,price_tier,role,volume_est,last_contact,status,notes")
      .eq("id", id)
      .single();
    if (error || !data) return { skipped: "Customer no longer exists" };
    const rec = only(data, changed, ["price_tier", "role", "volume_est", "last_contact", "status", "notes"]);
    return { tab, plan: planCustomer(grid, rec, { previousName, allowAppend }) };
  }

  if (entity === "batch") {
    const { data, error } = await supabase
      .from("batches")
      .select("lot_code,inoculated_on,transferred_on,first_pins_on,contamination_flag,issues,notes, strains(name)")
      .eq("id", id)
      .single<{
        lot_code: string;
        inoculated_on: string | null;
        transferred_on: string | null;
        first_pins_on: string | null;
        contamination_flag: boolean | null;
        issues: string | null;
        notes: string | null;
        strains: { name: string } | null;
      }>();
    if (error || !data) return { skipped: "Batch no longer exists" };
    const rec = only(
      {
        tub: data.lot_code,
        strain: changed && !changed.has("strain_id") ? null : data.strains?.name ?? null,
        inoculated_on: data.inoculated_on,
        transferred_on: data.transferred_on,
        first_pins_on: data.first_pins_on,
        contamination_flag: data.contamination_flag,
        issues: data.issues,
        notes: data.notes,
      },
      changed,
      ["inoculated_on", "transferred_on", "first_pins_on", "contamination_flag", "issues", "notes"],
    );
    // Appending needs the strain even when it wasn't the changed field.
    if (allowAppend) rec.strain = data.strains?.name ?? null;
    return { tab, plan: planBatch(grid, rec, { allowAppend }) };
  }

  const { data, error } = await supabase
    .from("harvests")
    .select("flush_number,harvested_on,weight_kg,dry_weight_kg,notes,source_ref, batches(lot_code, strains(name))")
    .eq("id", id)
    .single<{
      flush_number: number | null;
      harvested_on: string | null;
      weight_kg: number | null;
      dry_weight_kg: number | null;
      notes: string | null;
      source_ref: string | null;
      batches: { lot_code: string; strains: { name: string } | null } | null;
    }>();
  if (error || !data) return { skipped: "Harvest no longer exists" };
  if (!data.batches) return { skipped: "Harvest has no batch" };
  const weightChanged = !changed || changed.has("weight_kg") || changed.has("fresh_g");
  const dryChanged = !changed || changed.has("dry_weight_kg") || changed.has("dry_g");
  const plan = planHarvest(
    grid,
    {
      tub: data.batches.lot_code,
      strain: data.batches.strains?.name ?? null,
      flush_number: data.flush_number ?? 1,
      harvested_on: data.harvested_on,
      weight_kg: weightChanged ? Number(data.weight_kg ?? 0) : null,
      dry_weight_kg: dryChanged ? Number(data.dry_weight_kg ?? 0) : null,
      notes: !changed || changed.has("notes") ? data.notes : undefined,
      source_ref: data.source_ref,
    },
    { allowAppend },
  );
  // Record the importer's key so the next sheet import updates this harvest
  // instead of creating a duplicate.
  if (plan.sourceRef && plan.sourceRef !== data.source_ref && plan.skipped.length === 0) {
    const { error: refError } = await supabase.from("harvests").update({ source_ref: plan.sourceRef }).eq("id", id);
    if (refError) return { skipped: `Couldn’t link the harvest to its sheet row (${refError.message})` };
  }
  return { tab, plan };
}

/**
 * Write every queued change for one record in a single pass. The record's
 * current state is what gets written; the queued payloads only decide which
 * fields count as changed and whether it's new.
 */
async function writeRecord(supabase: SupabaseClient, sheet: SheetClient, rows: QueueRow[]): Promise<WritebackOutcome> {
  const { entity, entity_id: entityId } = rows[0];
  if (!MAPPED_ENTITIES.has(entity)) {
    return { entity, entityId, status: "unmapped", detail: `${entity} isn’t a column set on the reference sheet` };
  }
  if (rows.every((r) => r.op === "delete")) {
    return { entity, entityId, status: "skipped", detail: "Deleted in the app; sheet rows are never removed automatically" };
  }
  const inserted = rows.some((r) => r.op === "insert");
  const changed = inserted ? null : new Set<string>();
  let previousName: string | undefined;
  for (const r of rows) {
    const payload = r.payload ?? {};
    if (changed) for (const k of Object.keys(payload)) changed.add(k);
    if (!previousName && typeof payload.previous_name === "string") previousName = payload.previous_name;
  }
  if (changed && ![...changed].some((k) => SYNCED_FIELDS[entity].includes(k) || k === "name" || k === "strain_id")) {
    return { entity, entityId, status: "unchanged", detail: "No sheet columns changed" };
  }

  const result = await planFor(supabase, sheet, entity, entityId, changed, previousName, inserted);
  if ("skipped" in result) return { entity, entityId, status: "skipped", detail: result.skipped };
  const { tab, plan } = result;
  if (plan.writes.length === 0 && plan.append.length === 0) {
    return plan.skipped.length > 0
      ? { entity, entityId, status: "skipped", detail: plan.skipped.join("; ") }
      : { entity, entityId, status: "unchanged" };
  }
  await sheet.write(tab, plan.writes, plan.append);
  const cells = plan.writes.length + plan.append.reduce((s, r) => s + r.filter((v) => v !== "").length, 0);
  return {
    entity,
    entityId,
    status: "written",
    detail: `${cells} cell${cells === 1 ? "" : "s"} on ${tab}${plan.skipped.length ? ` (${plan.skipped.join("; ")})` : ""}`,
  };
}

async function markSynced(supabase: SupabaseClient, ids: number[]) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("sheet_sync_queue")
    .update({ synced_at: new Date().toISOString() })
    .in("id", ids)
    .is("synced_at", null);
  if (error) console.error("[sheet-writeback] mark synced failed", error);
}

/** Write a set of queue rows (grouped per record) and mark the ones that landed. */
export async function writeQueueRows(supabase: SupabaseClient, rows: QueueRow[]): Promise<WritebackOutcome[]> {
  const config = sheetWritebackConfig();
  if (!config) return [];
  const sheet = new SheetClient(config.id, config.account);
  const groups = new Map<string, QueueRow[]>();
  for (const r of rows) {
    const key = `${r.entity}:${r.entity_id}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const outcomes: WritebackOutcome[] = [];
  for (const group of groups.values()) {
    let outcome: WritebackOutcome;
    try {
      outcome = await writeRecord(supabase, sheet, group);
    } catch (e) {
      outcome = {
        entity: group[0].entity,
        entityId: group[0].entity_id,
        status: "error",
        detail: e instanceof Error ? e.message : String(e),
      };
    }
    outcomes.push(outcome);
    if (outcome.status === "written" || outcome.status === "unchanged") {
      await markSynced(supabase, group.map((r) => r.id));
    }
    // A config/permission failure will fail every record the same way.
    if (outcome.status === "error" && /service account|sign-in|not found/i.test(outcome.detail ?? "")) break;
  }
  return outcomes;
}

/** Drain the pending backlog for the mapped tabs. */
export async function writePendingQueue(supabase: SupabaseClient, limit = 400): Promise<WritebackOutcome[]> {
  const { data, error } = await supabase
    .from("sheet_sync_queue")
    .select("id,entity,entity_id,op,payload")
    .is("synced_at", null)
    .in("entity", [...MAPPED_ENTITIES])
    .order("id")
    .limit(limit)
    .returns<QueueRow[]>();
  if (error) throw new Error(error.message);
  return writeQueueRows(supabase, data ?? []);
}

/**
 * Write-through for fresh edits: everything queued in the last few minutes,
 * including rows enqueued by database functions (batch workflows). Older
 * backlog is left for the explicit "Write pending changes" action on /sync,
 * because the sheet may have been edited by hand since those were queued.
 */
export async function writeRecentQueue(supabase: SupabaseClient, minutes = 15): Promise<WritebackOutcome[]> {
  if (!writebackConfigured()) return [];
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from("sheet_sync_queue")
    .select("id,entity,entity_id,op,payload")
    .is("synced_at", null)
    .in("entity", [...MAPPED_ENTITIES])
    .gte("created_at", since)
    .order("id")
    .limit(100)
    .returns<QueueRow[]>();
  if (error) throw new Error(error.message);
  return writeQueueRows(supabase, data ?? []);
}

// One drain at a time per server instance: a request that enqueues several
// changes schedules several drains, and two running together could both
// append the same new row. Chained, the second sees the first's rows synced.
let drainChain: Promise<unknown> = Promise.resolve();
let drainQueued = false;

export function scheduleRecentWrite(supabase: SupabaseClient): Promise<WritebackOutcome[]> {
  if (drainQueued) return Promise.resolve([]);
  drainQueued = true;
  const run = drainChain.then(() => {
    drainQueued = false;
    return writeRecentQueue(supabase);
  });
  drainChain = run.catch(() => undefined);
  return run;
}
