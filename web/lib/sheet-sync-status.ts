export interface ImportStatus { status: string; started_at: string }
export function activeSheetImport(runs: ImportStatus[], now = Date.now()): boolean {
  return runs.some((run) => run.status === "running" && now - Date.parse(run.started_at) >= 0 && now - Date.parse(run.started_at) < 15 * 60_000);
}
export function displayImportStatus(run: ImportStatus, now = Date.now()): string {
  return run.status === "running" && now - Date.parse(run.started_at) >= 15 * 60_000 ? "stalled" : run.status;
}

export function importHealth(runs: ImportStatus[], now = Date.now()): { state: string; message: string } {
  const success = runs.find((run) => run.status === "ok");
  const latest = runs[0];
  if (latest && (latest.status === "error" || displayImportStatus(latest, now) === "stalled"))
    return { state: "attention", message: "The latest import failed or stalled. The app may be showing older Sheet data." };
  if (!success) return { state: "attention", message: "No successful import is recorded. Verify the Sheet connection before relying on these records." };
  if (!Number.isFinite(Date.parse(success.started_at)) || now - Date.parse(success.started_at) > 36 * 60 * 60_000)
    return { state: "attention", message: "The last successful import is overdue (more than 36 hours). Check the Sheet connection." };
  return { state: "healthy", message: "The Sheet imported successfully within the last 36 hours." };
}
