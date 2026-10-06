"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importBags, previewBags } from "./import-actions";

export default function ImportBags() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewBags>> | null>(null);
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  function run(commit: boolean) {
    if (!file) return;
    start(async () => {
      try {
        const form = new FormData(); form.set("csv", file);
        if (commit && preview?.receipt) form.set("receipt", preview.receipt);
        const result = commit ? await importBags(form) : await previewBags(form);
        setMessage(result.message ?? "");
        if (!commit) setPreview(result as Awaited<ReturnType<typeof previewBags>>);
        else if (result.ok) { setPreview(null); router.refresh(); }
      } catch { setMessage("Connection interrupted. Preview again before retrying."); setPreview(null); }
    });
  }
  return <div>
    <p>One row per grain bag. Columns: lot_code,strain,inoculated_on,notes. Dates use YYYY-MM-DD. Existing lots and their histories are preserved. Keep these IDs in the Master Sheet too.</p>
    <label>Grain bag CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setMessage(""); }} /></label>
    <button type="button" disabled={!file || busy} onClick={() => run(false)}>Preview bags</button>
    {preview?.ok && preview.rows && <>
      <p>{preview.rows.filter((r) => !r.existing).length} new bags; {preview.existing?.length ?? 0} existing lots will be kept unchanged.</p>
      <table><thead><tr><th>Bag ID</th><th>Inoculated</th><th>Action</th></tr></thead><tbody>{preview.rows.map((r) => <tr key={r.lot_code}><td>{r.lot_code}</td><td>{r.date ?? "Not recorded"}</td><td>{r.existing ? "Keep existing" : "Create bag"}</td></tr>)}</tbody></table>
      <button type="button" disabled={busy} onClick={() => run(true)}>Import reviewed bags</button>
    </>}
    <p role="status">{message}</p>
  </div>;
}
