"use server";

// Generic update/delete server actions, driven by the entity registry
// (lib/entities). Every table listed there becomes editable and deletable
// from any list it appears in, without bespoke per-entity actions.

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/utils/supabase/service";
import { enqueueSync } from "@/lib/sync";
import { getEntity, type EntityDef } from "@/lib/entities";
import type { EntityResult } from "@/components/EntityForm";

function buildPatch(entity: EntityDef, formData: FormData): Record<string, unknown> {
  // The dialog reports which fields it actually rendered, so a partial edit
  // surface never blanks columns it didn't show.
  const raw__fields = formData.get("__fields");
  const present =
    raw__fields == null ? null : new Set(String(raw__fields).split(",").filter(Boolean));

  const patch: Record<string, unknown> = {};
  for (const f of entity.fields) {
    if (present && !present.has(f.name)) continue;
    if (f.type === "checkbox") {
      // Unchecked boxes are absent from the payload.
      patch[f.name] = formData.get(f.name) != null;
      continue;
    }
    const raw = formData.get(f.name);
    if (raw == null) continue;
    const val = String(raw);

    if (f.type === "number") {
      // Blank numeric input preserves the existing value rather than nulling
      // a NOT NULL column.
      if (val.trim() === "") continue;
      const n = Number(val);
      if (Number.isFinite(n)) patch[f.name] = n;
      continue;
    }
    if (f.type === "date") {
      patch[f.name] = val.trim() === "" ? null : val;
      continue;
    }
    if (f.type === "select" && f.fk) {
      patch[f.name] = val.trim() === "" ? null : Number(val);
      continue;
    }
    if (f.type === "select") {
      // Enum select. If the stored value isn't among this form's options, the
      // browser renders the empty "—" fallback; submitting that would blank a
      // column the user never intended to change. Treat empty as "unchanged".
      if (val.trim() === "") continue;
      patch[f.name] = val;
      continue;
    }
    patch[f.name] = val;
  }
  return patch;
}

export async function updateEntity(
  key: string,
  id: number,
  formData: FormData,
): Promise<EntityResult> {
  let entity: EntityDef;
  try {
    entity = getEntity(key);
  } catch {
    return { ok: false, message: "Unknown record type." };
  }
  if (!Number.isFinite(id)) return { ok: false, message: "Invalid record." };

  const patch = buildPatch(entity, formData);
  if (Object.keys(patch).length === 0) {
    return { ok: false, message: "Nothing to update." };
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from(entity.table).update(patch).eq("id", id);
  if (error) return { ok: false, message: error.message };

  if (entity.sync) await enqueueSync(supabase, entity.sync, id, "update", patch);
  revalidatePath(entity.listPath);
  return { ok: true, message: `${cap(entity.label)} updated ✓` };
}

export async function deleteEntity(key: string, id: number): Promise<EntityResult> {
  let entity: EntityDef;
  try {
    entity = getEntity(key);
  } catch {
    return { ok: false, message: "Unknown record type." };
  }
  if (!Number.isFinite(id)) return { ok: false, message: "Invalid record." };

  if (key === "batch") return deleteBatchEntity(id, entity);

  const supabase = createServiceClient();
  const { error } = await supabase.from(entity.table).delete().eq("id", id);
  if (error) {
    // Most failures here are FK constraints (e.g. a strain still has batches).
    return {
      ok: false,
      message: /foreign key|violates/i.test(error.message)
        ? `Can’t delete this ${entity.label} — other records still reference it.`
        : error.message,
    };
  }

  if (entity.sync) await enqueueSync(supabase, entity.sync, id, "delete", {});
  revalidatePath(entity.listPath);
  return { ok: true, message: `${cap(entity.label)} deleted` };
}

async function deleteBatchEntity(id: number, entity: EntityDef): Promise<EntityResult> {
  const supabase = createServiceClient();
  const { data: batch, error: batchErr } = await supabase
    .from("batches")
    .select("id,lot_code")
    .eq("id", id)
    .single();
  if (batchErr || !batch) {
    return { ok: false, message: batchErr?.message ?? "Batch not found." };
  }

  const { data: harvests, error: harvestErr } = await supabase
    .from("harvests")
    .select("id")
    .eq("batch_id", id);
  if (harvestErr) return { ok: false, message: harvestErr.message };

  const harvestIds = (harvests ?? []).map((h) => h.id).filter((h): h is number => Number.isFinite(h));
  if (harvestIds.length > 0) {
    const { count: orderLineCount, error: orderErr } = await supabase
      .from("order_lines")
      .select("id", { count: "exact", head: true })
      .in("harvest_id", harvestIds);
    if (orderErr) return { ok: false, message: orderErr.message };
    if ((orderLineCount ?? 0) > 0) {
      return {
        ok: false,
        message:
          "Can’t delete this batch because one or more harvests are linked to orders. Unlink those order lines first to preserve traceability.",
      };
    }

    // dry_inventory references harvests without ON DELETE CASCADE in the
    // current schema, so remove the batch-owned jar rows before deleting the
    // batch and letting harvests cascade.
    const { error: dryErr } = await supabase
      .from("dry_inventory")
      .delete()
      .in("harvest_id", harvestIds);
    if (dryErr) return { ok: false, message: dryErr.message };
  }

  const { error } = await supabase.from("batches").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      message: /foreign key|violates/i.test(error.message)
        ? "Can’t delete this batch — other records still reference it."
        : error.message,
    };
  }

  if (entity.sync) await enqueueSync(supabase, entity.sync, id, "delete", { lot_code: batch.lot_code });
  revalidatePath(entity.listPath);
  revalidatePath(`/batches/${id}`);
  revalidatePath("/");
  return { ok: true, message: `Batch ${batch.lot_code} deleted` };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
