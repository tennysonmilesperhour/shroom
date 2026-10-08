"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { EntityResult } from "@/components/EntityForm";
import { parseBagCsv } from "@/lib/bag-csv";

async function prepare(form: FormData) {
  const file = form.get("csv");
  if (!(file instanceof File) || !file.size || file.size > 1_000_000) throw new Error("Choose a CSV under 1 MB.");
  const text = await file.text();
  const rows = parseBagCsv(text);
  const db = createServiceClient();
  const [strains, existing] = await Promise.all([
    db.from("strains").select("id,name"),
    db.from("batches").select("lot_code,strain_id").in("lot_code", rows.map((r) => r.lot_code)),
  ]);
  if (strains.error || existing.error) throw new Error(strains.error?.message ?? existing.error?.message);
  const batches = rows.map((row) => {
    const matches = (strains.data ?? []).filter((s) => s.name.toLowerCase() === row.strain.toLowerCase());
    if (matches.length !== 1) throw new Error(`Unknown or ambiguous strain: ${row.strain}`);
    const stored = existing.data?.find((b) => b.lot_code === row.lot_code);
    if (stored && stored.strain_id !== matches[0].id) throw new Error(`Lot ${row.lot_code} already belongs to another strain. Resolve the ID conflict first.`);
    return { lot_code: row.lot_code, strain_id: matches[0].id, inoculated_on: row.inoculated_on, stage: "inoculation", container_type: "grain_bag", block_count: 1, notes: row.notes };
  });
  return { db, batches, digest: createHash("sha256").update(text).digest("hex"), existing: (existing.data ?? []).map((r) => r.lot_code) };
}

function sign(body: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Import connection is unavailable.");
  return createHmac("sha256", key).update(body).digest("hex");
}

export async function previewBags(form: FormData) {
  try {
    const { batches, digest, existing } = await prepare(form);
    const body = `${digest}:${Date.now() + 15 * 60_000}`;
    return { ok: true, message: "Review the bags before importing.", receipt: `${body}:${sign(body)}`, existing,
      rows: batches.map((b) => ({ lot_code: b.lot_code, date: b.inoculated_on, existing: existing.includes(b.lot_code) })) };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Preview failed." }; }
}

export async function importBags(form: FormData): Promise<EntityResult> {
  try {
    const { db, batches, digest } = await prepare(form);
    const [hash, expires, signature] = String(form.get("receipt") ?? "").split(":");
    const expected = sign(`${hash}:${expires}`);
    if (hash !== digest || !Number.isFinite(Number(expires)) || Number(expires) <= Date.now() || !signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
      throw new Error("Preview this file again before importing.");
    // One statement; conflict-ignore preserves existing histories on retries.
    const { data, error } = await db.from("batches").upsert(batches, { onConflict: "lot_code", ignoreDuplicates: true }).select("id");
    if (error) throw new Error(error.message);
    revalidatePath("/batches"); revalidatePath("/");
    return { ok: true, message: `${data?.length ?? 0} grain bags created. Existing lots and histories preserved.` };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "CSV import failed." }; }
}
