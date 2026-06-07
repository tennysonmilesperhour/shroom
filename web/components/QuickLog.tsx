"use client";

import { useEffect, useState, useTransition } from "react";
import { addHarvest } from "@/app/(app)/harvests/actions";
import { useToast } from "@/components/ToastProvider";
import { DRY_FLOOR } from "@/lib/format";

export interface QuickLogBatch {
  id: number;
  lot_code: string;
  strain: string | null;
  stage: string;
}

interface QuickLogProps {
  batches: QuickLogBatch[];
}

// Fast path to log a harvest straight from the dashboard. Reuses the existing
// addHarvest server action (same validation, sync queue, revalidation as the
// full harvests form). The dry ratio computes live as you type and is checked
// against the real DRY_FLOOR; submit raises a toast and resets.
export default function QuickLog({ batches }: QuickLogProps) {
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [batchId, setBatchId] = useState<string>(batches[0]?.id.toString() ?? "");
  const [flush, setFlush] = useState("1");
  const [fresh, setFresh] = useState("");
  const [dry, setDry] = useState("");
  const [today, setToday] = useState("");

  // Set the default date client-side to avoid an SSR/CSR mismatch.
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);

  const freshN = parseFloat(fresh);
  const dryN = parseFloat(dry);
  const hasRatio = freshN > 0 && dryN >= 0;
  const ratio = hasRatio ? (dryN / freshN) * 100 : 0;
  const clears = ratio >= DRY_FLOOR;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!batchId) {
      push({ title: "Pick a batch first", tone: "ember" });
      return;
    }
    const fd = new FormData();
    fd.set("batch_id", batchId);
    fd.set("harvested_on", today || new Date().toISOString().slice(0, 10));
    fd.set("flush_number", flush);
    fd.set("fresh_g", fresh || "0");
    fd.set("dry_g", dry || "0");
    fd.set("grade", "A");

    const batch = batches.find((b) => b.id.toString() === batchId);
    startTransition(async () => {
      const result = await addHarvest(fd);
      if (result.ok) {
        push({
          title: "Harvest logged",
          body: `${batch?.lot_code ?? "lot"}${batch?.strain ? ` · ${batch.strain}` : ""} · ${
            hasRatio ? `${ratio.toFixed(1)}% dry` : "logged"
          }${hasRatio ? (clears ? " · clears floor" : " · below floor") : ""}`,
          tone: hasRatio && !clears ? "spore" : "moss",
        });
        setFresh("");
        setDry("");
        setFlush("1");
      } else {
        push({ title: "Couldn’t log harvest", body: result.message, tone: "ember" });
      }
    });
  }

  if (batches.length === 0) {
    return <p className="muted">No active batches to log against.</p>;
  }

  return (
    <form className="quicklog" onSubmit={onSubmit}>
      <div className="ql-grid">
        <label className="ql-field">
          <span>Batch</span>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.lot_code}
                {b.strain ? ` · ${b.strain}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="ql-field ql-narrow">
          <span>Flush #</span>
          <input type="number" min={1} max={6} value={flush} onChange={(e) => setFlush(e.target.value)} />
        </label>
        <label className="ql-field">
          <span>Fresh (g)</span>
          <input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="2140"
            value={fresh}
            onChange={(e) => setFresh(e.target.value)}
          />
        </label>
        <label className="ql-field">
          <span>Dry (g)</span>
          <input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="198"
            value={dry}
            onChange={(e) => setDry(e.target.value)}
          />
        </label>
      </div>

      <div className="ql-foot">
        <div className={`ql-ratio ${!hasRatio ? "idle" : clears ? "good" : "bad"}`} aria-live="polite">
          <b>{hasRatio ? `${ratio.toFixed(1)}%` : "—"}</b>
          <span>
            {hasRatio
              ? clears
                ? `dry ratio · clears ${DRY_FLOOR}% floor`
                : `dry ratio · below ${DRY_FLOOR}% floor`
              : "enter fresh + dry weight"}
          </span>
        </div>
        <button type="submit" className="primary" data-ripple disabled={pending}>
          {pending ? "Logging…" : "Log harvest"}
        </button>
      </div>
    </form>
  );
}
