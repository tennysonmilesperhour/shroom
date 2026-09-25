"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { activeSheetImport } from "@/lib/sheet-sync-status";
import { revalidatePath } from "next/cache";
import { writebackConfigured, writePendingQueue } from "@/lib/sheet-writeback";

export interface SyncActionResult {
  ok: boolean;
  message: string;
  count?: number;
}

/** Mark all currently-pending sync entries as synced.
 *
 * This is the stub for the Google Sheets bridge: once an external worker
 * actually pushes pending ops to the sheet, that worker can call this RPC
 * (or just update the rows directly with the service role) to clear them.
 * For now operators can clear the queue manually when they've reconciled.
 */
export async function markAllSynced(cutoff: string): Promise<SyncActionResult> {
  if (!Number.isFinite(Date.parse(cutoff))) return { ok: false, message: "Refresh the page before reconciling changes." };
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("sheet_sync_queue")
    .update({ synced_at: new Date().toISOString() })
    .is("synced_at", null)
    .lte("created_at", cutoff)
    .select("id");
  if (error) return { ok: false, message: error.message };
  revalidatePath("/sync");
  return {
    ok: true,
    count: data?.length ?? 0,
    message: `Marked ${data?.length ?? 0} ops as synced.`,
  };
}

/** Pull the Master Cultivation Reference sheet into the database (sheet → app).
 *
 * The parser lives in the Python importer, so this triggers its GitHub Actions
 * workflow via workflow-dispatch rather than re-implementing the parse here.
 * Track a request receipt until the importer completes it. Only a recent
 * running job disables the button; failed/stale attempts can be retried.
 */
export async function requestSheetSync(): Promise<SyncActionResult> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO ?? "tennysonmilesperhour/shroom";
  const ref = process.env.GITHUB_SYNC_REF ?? "main";
  if (!token) {
    return {
      ok: false,
      message:
        "Cloud sheet sync is not connected. Use the workbook import on this page.",
    };
  }

  const supabase = createServiceClient();
  const { data: runs, error: readError } = await supabase.from("sheet_imports").select("status,started_at").order("started_at", { ascending: false }).limit(10);
  if (readError) return { ok: false, message: "Could not check the latest import. Please retry." };
  if (activeSheetImport(runs || [])) return { ok: false, message: "An import is already running. This page will update when it finishes." };
  const requestId = crypto.randomUUID();
  const { error: logError } = await supabase.from("sheet_imports").insert({ source: "Cloud sheet", status: "running", request_id: requestId });
  if (logError) return { ok: false, message: "Could not start an import record. Please retry." };
  let resp: Response;
  try { resp = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/sheet-import.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref, inputs: { target: "supabase", request_id: requestId } }),
    },
  ); } catch {
    await supabase.from("sheet_imports").update({ status: "error", finished_at: new Date().toISOString(), detail: "Cloud connection interrupted" }).eq("request_id", requestId);
    return { ok: false, message: "Cloud connection interrupted. Please retry." };
  }
  if (!resp.ok) {
    const detail = (await resp.text()).slice(0, 500);
    await supabase.from("sheet_imports").update({
      status: "error",
      finished_at: new Date().toISOString(),
      detail,
    }).eq("request_id", requestId);
    return { ok: false, message: `Couldn't start the sync (GitHub ${resp.status}).` };
  }

  revalidatePath("/sync");
  return {
    ok: true,
    message: "Sync started — pulling the latest from the sheet. Give it about a minute.",
  };
}

/** Write pending app changes into the Master Cultivation Reference (app → sheet).
 *
 * Runs the same cell-level write-back that happens automatically after each
 * save (lib/sheet-writeback), over the whole pending backlog for the mapped
 * tabs. Only fields that were changed in the app are written; rows the sheet
 * can't represent unambiguously are reported and left pending.
 */
export async function pushToSheet(): Promise<SyncActionResult> {
  if (!writebackConfigured()) {
    return {
      ok: false,
      message: "Sheet write-back isn’t connected. Set GOOGLE_SERVICE_ACCOUNT_JSON and MASTER_SHEET_GOOGLE_ID.",
    };
  }
  const supabase = createServiceClient();
  let outcomes;
  try {
    outcomes = await writePendingQueue(supabase);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Write-back failed." };
  }
  revalidatePath("/sync");
  const count = (s: string) => outcomes.filter((o) => o.status === s).length;
  const errors = outcomes.filter((o) => o.status === "error");
  if (errors.length > 0 && count("written") === 0) {
    return { ok: false, message: errors[0].detail ?? "Write-back failed." };
  }
  const skipped = outcomes.filter((o) => o.status === "skipped");
  const parts = [
    `${count("written")} record${count("written") === 1 ? "" : "s"} written to the sheet`,
    count("unchanged") ? `${count("unchanged")} already matched` : "",
    skipped.length ? `${skipped.length} left pending (e.g. ${skipped[0].detail})` : "",
    errors.length ? `${errors.length} failed (${errors[0].detail})` : "",
  ].filter(Boolean);
  return { ok: true, count: count("written"), message: parts.join(" · ") };
}
