export interface ImportStatus { status: string; started_at: string }
export function activeSheetImport(runs: ImportStatus[], now = Date.now()): boolean {
  return runs.some((run) => run.status === "running" && now - Date.parse(run.started_at) >= 0 && now - Date.parse(run.started_at) < 15 * 60_000);
}
export function displayImportStatus(run: ImportStatus, now = Date.now()): string {
  return run.status === "running" && now - Date.parse(run.started_at) >= 15 * 60_000 ? "stalled" : run.status;
}
