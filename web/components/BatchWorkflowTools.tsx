"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cloneBatch, mergeBatches, splitBatch } from "@/app/(app)/batches/workflow-actions";
import { StepperField } from "@/components/TapFields";
import { useToast } from "@/components/ToastProvider";

export interface CompatibleBatch {
  id: number;
  lotCode: string;
  containerId: string | null;
  units: number;
}

type Mode = "clone" | "split" | "merge";

export default function BatchWorkflowTools({
  batchId,
  lotCode,
  blockCount,
  compatible,
}: {
  batchId: number;
  lotCode: string;
  blockCount: number;
  compatible: CompatibleBatch[];
}) {
  const [mode, setMode] = useState<Mode>("clone");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (
      mode === "merge" &&
      !window.confirm(
        "Merge the selected batches into this one? Their histories and traceability records will move here, and the source batch records will be removed.",
      )
    ) return;
    startTransition(async () => {
      try {
        const result = mode === "clone"
          ? await cloneBatch(batchId, String(data.get("lot_code") ?? ""), String(data.get("container_id") ?? ""))
          : mode === "split"
            ? await splitBatch(
                batchId,
                String(data.get("lot_code") ?? ""),
                String(data.get("container_id") ?? ""),
                Number(data.get("units")),
              )
            : await mergeBatches(batchId, data.getAll("source_ids").map(Number));
        push({ title: result.ok ? "Batch workflow complete" : "Couldn’t update batches", body: result.message, tone: result.ok ? "moss" : "ember" });
        if (result.ok) {
          if ("batchId" in result && result.batchId) router.push(`/batches/${result.batchId}`);
          else router.refresh();
        }
      } catch {
        push({ title: "Couldn’t update batches", body: "Check the connection and try again.", tone: "ember" });
      }
    });
  }

  return (
    <div className="batch-workflow-tools">
      <div className="workflow-mode-buttons" role="group" aria-label="Batch workflow">
        {(["clone", "split", "merge"] as const).map((value) => {
          const label = value === "clone" ? "Clone setup" : value === "split" ? "Split batch" : "Merge into this";
          return (
            <button type="button" key={value} aria-pressed={mode === value} disabled={value === "split" && blockCount < 2} onClick={() => setMode(value)} className={mode === value ? "active" : ""}>
              {label}
            </button>
          );
        })}
      </div>
      <form className="form-grid" onSubmit={submit}>
        {mode !== "merge" ? (
          <>
            <div>
              <label htmlFor={`workflow-lot-${batchId}`}>New lot code</label>
              <input id={`workflow-lot-${batchId}`} name="lot_code" required placeholder={`${lotCode}-${mode === "clone" ? "COPY" : "B"}`} />
            </div>
            <div>
              <label htmlFor={`workflow-container-${batchId}`}>New container ID</label>
              <input id={`workflow-container-${batchId}`} name="container_id" placeholder="T-13 / GB-05" />
            </div>
            {mode === "split" && (
              <div className="full">
                <label htmlFor={`workflow-units-${batchId}`}>Units to move</label>
                <StepperField id={`workflow-units-${batchId}`} name="units" defaultValue={1} min={1} max={Math.max(1, blockCount - 1)} />
                <p className="muted form-help">Materials and substrate weight are divided proportionally. Existing harvests remain with this batch.</p>
              </div>
            )}
          </>
        ) : compatible.length === 0 ? (
          <p className="muted full">No other batches share this strain and stage, so nothing can safely merge into it.</p>
        ) : (
          <fieldset className="full merge-options">
            <legend>Compatible source batches</legend>
            {compatible.map((batch) => (
              <label key={batch.id}>
                <input type="checkbox" name="source_ids" value={batch.id} />
                <span><b>{batch.containerId || batch.lotCode}</b> · {batch.lotCode} · {batch.units} units</span>
              </label>
            ))}
          </fieldset>
        )}
        <div className="actions full">
          <button type="submit" className="primary" disabled={pending || (mode === "merge" && compatible.length === 0)}>
            {pending ? "Working…" : mode === "clone" ? "Create cloned batch" : mode === "split" ? "Split batch" : "Merge selected"}
          </button>
        </div>
      </form>
    </div>
  );
}
