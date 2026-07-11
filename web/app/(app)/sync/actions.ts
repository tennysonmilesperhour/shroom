"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";

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
export async function markAllSynced(): Promise<SyncActionResult> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("sheet_sync_queue")
    .update({ synced_at: new Date().toISOString() })
    .is("synced_at", null)
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
 * On a successful trigger we record a `running` row in `sheet_imports` so the
 * button can grey out for the rest of the day; the importer appends its own
 * `ok` row when it finishes (~a minute later).
 */
export async function requestSheetSync(): Promise<SyncActionResult> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO ?? "tennysonmilesperhour/shroom";
  const ref = process.env.GITHUB_SYNC_REF ?? "main";
  if (!token) {
    return {
      ok: false,
      message:
        "Sheet sync isn't wired up yet — set GITHUB_DISPATCH_TOKEN and the workflow secrets (see supabase/SHEET_MAPPING.md).",
    };
  }

  const resp = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/sheet-import.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref, inputs: { target: "supabase" } }),
    },
  );

  const supabase = createServiceClient();
  if (!resp.ok) {
    const detail = (await resp.text()).slice(0, 500);
    await supabase.from("sheet_imports").insert({
      source: "web button",
      status: "error",
      finished_at: new Date().toISOString(),
      detail,
    });
    return { ok: false, message: `Couldn't start the sync (GitHub ${resp.status}).` };
  }

  await supabase.from("sheet_imports").insert({ source: "web button", status: "running" });
  revalidatePath("/sync");
  return {
    ok: true,
    message: "Sync started — pulling the latest from the sheet. Give it about a minute.",
  };
}

/** Push the app's data back into the Master Cultivation Reference (app → sheet).
 *
 * The write itself runs in the Python exporter (a non-destructive keyed upsert),
 * so this triggers the `sheet-export.yml` GitHub Actions workflow rather than
 * re-implementing the workbook write here — the same dispatch pattern the pull
 * button uses. The workflow, on success, clears the pending queue, so the
 * "Pending ops" counter settles on its own once the job finishes (~a minute).
 */
export async function pushToSheet(): Promise<SyncActionResult> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO ?? "tennysonmilesperhour/shroom";
  const ref = process.env.GITHUB_SYNC_REF ?? "main";
  if (!token) {
    return {
      ok: false,
      message:
        "Write-back isn't wired up yet — set GITHUB_DISPATCH_TOKEN plus the sheet-export secrets (SHROOM_DB_URL, GOOGLE_SERVICE_ACCOUNT_JSON with write scope, and a MASTER_SHEET_* target). See .github/workflows/sheet-export.yml.",
    };
  }

  const resp = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/sheet-export.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref, inputs: { mark_synced: true } }),
    },
  );

  if (!resp.ok) {
    const detail = (await resp.text()).slice(0, 300);
    return {
      ok: false,
      message: `Couldn't start the push (GitHub ${resp.status}). ${detail}`.trim(),
    };
  }

  return {
    ok: true,
    message:
      "Push started — writing the app's data back to the sheet. The pending queue clears itself when it finishes (~a minute).",
  };
}
