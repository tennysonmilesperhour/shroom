"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Preview { counts: Record<string, number>; total: number; warnings: string[]; receipt: string }
const LABELS: Record<string, string> = { strains: "Strains", vendors: "Vendors", equipment: "Equipment", customers: "Customers", price_tiers: "Price tiers", protocols: "Protocols", reference_guides: "Reference guides", issue_log: "Issue notes", sourced_finished_goods: "Finished goods", sales_log: "Sales", batches: "Batches", dry_inventory: "Inventory jars", harvests: "Harvests / flushes" };

export default function WorkbookUpload() {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [phase, setPhase] = useState<"idle" | "previewing" | "importing" | "done">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [dragging, setDragging] = useState(false);
  const router = useRouter();
  const busy = phase === "previewing" || phase === "importing";

  function choose(next: File | null) {
    if (busy) return;
    setPreview(null); setResult(""); setError(""); setPhase("idle");
    if (next && (!next.name.toLowerCase().endsWith(".xlsx") || !next.size || next.size > 4 * 1024 * 1024)) {
      setFile(null); setError("Choose an .xlsx workbook up to 4 MB. Export Google Sheets or older Excel files as .xlsx first.");
      if (input.current) input.current.value = "";
      return;
    }
    setFile(next);
  }

  async function run(mode: "preview" | "import") {
    if (!file || busy) return;
    setError(""); setPhase(mode === "preview" ? "previewing" : "importing");
    try {
      const response = await fetch(`/api/workbook?mode=${mode}`, {
        method: "POST", headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "X-Workbook-Name": encodeURIComponent(file.name), ...(preview ? { "X-Import-Receipt": preview.receipt } : {}) }, body: file,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.message || (response.status === 413 ? "This workbook exceeds the upload limit. Use an .xlsx file up to 4 MB." : "The import service is unavailable. Your file is still selected; try again."));
      if (mode === "preview") { setPreview(data); setPhase("idle"); }
      else {
        setResult(`${data.total} records imported. Batches, flushes, and their notes stay linked.`);
        setPreview(null); setFile(null); setPhase("done");
        if (input.current) input.current.value = "";
        router.refresh();
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Connection interrupted. Please try again."); setPhase("idle"); }
  }

  return (
    <section className="workbook-import" aria-labelledby={`${id}-title`} aria-busy={busy}>
      <div className="import-heading"><span className="import-icon" aria-hidden="true">↥</span><div><div className="eyebrow">From your device</div><h2 id={`${id}-title`}>Bring your workbook</h2><p className="muted">Choose a file, review what’s inside, then import.</p></div></div>
      <ol className="import-steps" aria-label="Import progress">
        {["Choose file", "Review records", "Import"].map((label, index) => <li key={label} className={(index === 0 && !preview && phase !== "done") || (index === 1 && preview && !busy) || (index === 2 && (phase === "importing" || phase === "done")) ? "active" : ""}><span>{index + 1}</span>{label}</li>)}
      </ol>
      <label className={`workbook-drop${dragging ? " dragging" : ""}`} htmlFor={id}
        onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length !== 1) { setError("Choose one workbook at a time."); return; } choose(event.dataTransfer.files[0] ?? null); }}>
        <span className="workbook-file-icon" aria-hidden="true">▤</span>
        <strong>{file?.name || "Choose an Excel workbook"}</strong>
        <span>{file ? `${(file.size / 1024).toFixed(0)} KB · Ready to preview` : "Drop it here or tap to browse"}</span>
        <input ref={input} id={id} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(event) => choose(event.target.files?.[0] ?? null)} />
        <small>Master Cultivation Reference layout · .xlsx · up to 4 MB</small>
      </label>
      {preview && <div className="import-preview">
        <h3>{preview.total} records ready to review</h3>
        <dl className="import-counts">{Object.entries(preview.counts).map(([table, count]) => <div key={table}><dt>{LABELS[table] || table}</dt><dd>{count}</dd></div>)}</dl>
        {preview.warnings.map((warning) => <p key={warning} className="import-warning">{warning}</p>)}
        <p className="muted">Matching spreadsheet fields update existing records. Other app details are kept. Each container stays one batch, with its flushes attached. No records are deleted.</p>
      </div>}
      {error && <p className="import-message error" role="alert">{error}</p>}
      {result && <div className="import-message success" role="status"><strong>Import complete</strong><p>{result}</p><Link href="/batches">Open batches →</Link></div>}
      <div className="import-actions">
        {preview ? <><button type="button" className="primary" disabled={busy} onClick={() => void run("import")}>{phase === "importing" ? "Importing…" : `Import ${preview.total} records`}</button><button type="button" className="ghost" disabled={busy} onClick={() => { setPreview(null); setError(""); }}>Back to file</button></> : <button type="button" className="primary" disabled={!file || busy} onClick={() => void run("preview")}>{phase === "previewing" ? "Reading workbook…" : "Preview import"}</button>}
        <span className="muted" role="status">{busy ? "Keep this page open while your workbook is processed." : "Your file is checked before anything is saved."}</span>
      </div>
    </section>
  );
}
