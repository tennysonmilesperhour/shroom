"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordTimingNote } from "@/app/(app)/timing-actions";
import { TIMING_FACTORS } from "@/lib/stage-timing";

export interface TimingPromptData {
  fromStage: string;
  /** e.g. "Colonization → Fruiting took 23 days" or "Colonization is on day 23". */
  headline: string;
  /** e.g. "Golden Teacher tubs usually take 14 days (13–15, 8 runs)." */
  expected: string;
  direction: "slow" | "fast";
  /** Factors where this batch differs from the cohort's usual setup. */
  suggested: { factor: string; hint: string }[];
  /** Reasons recorded on earlier runs of this strain with the same direction. */
  likely: { label: string; runs: number; avgShift: number }[];
}

/**
 * A slim, dismissible callout: "this step was unusual — did anything change?"
 * Answering "yes" records which parameters moved, which keeps that run out of
 * the strain's averages and builds the list of likely reasons.
 */
export default function StageTimingPrompt({ batchId, prompt, more = 0 }: { batchId: number; prompt: TimingPromptData; more?: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [factors, setFactors] = useState<Set<string>>(() => new Set(prompt.suggested.map((s) => s.factor)));
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hints = new Map(prompt.suggested.map((s) => [s.factor, s.hint]));

  function answer(response: "changed" | "unchanged" | "dismissed") {
    setMessage(null);
    startTransition(async () => {
      const result = await recordTimingNote({ batchId, fromStage: prompt.fromStage, response, factors: [...factors], note });
      if (result.ok) router.refresh();
      else setMessage(result.message ?? "Could not save.");
    });
  }

  function toggle(factor: string) {
    setFactors((current) => {
      const next = new Set(current);
      if (next.has(factor)) next.delete(factor);
      else next.add(factor);
      return next;
    });
  }

  return (
    <div className={`timing-prompt ${prompt.direction}`} role="status">
      <div className="timing-prompt-head">
        <div>
          <b>{prompt.headline}</b>
          <span className="muted"> {prompt.expected}</span>
        </div>
        <button type="button" className="timing-prompt-close" aria-label="Hide this notice" disabled={pending} onClick={() => answer("dismissed")}>
          ×
        </button>
      </div>
      {!open ? (
        <div className="timing-prompt-actions">
          <span className="timing-prompt-question muted">
            Did any parameters change?{more > 0 ? ` (${more} more step${more === 1 ? "" : "s"} to review after this)` : ""}
          </span>
          <button type="button" className="ghost" onClick={() => setOpen(true)} disabled={pending}>Yes, record</button>
          <button type="button" className="ghost" onClick={() => answer("unchanged")} disabled={pending}>No</button>
        </div>
      ) : (
        <div className="timing-prompt-form">
          {prompt.likely.length > 0 && (
            <p className="muted form-help">
              Seen before on this strain:{" "}
              {prompt.likely.map((l) => `${l.label} (${l.runs}×, ${l.avgShift > 0 ? "+" : ""}${l.avgShift} d)`).join(" · ")}
            </p>
          )}
          <div className="choice-chips compact" role="group" aria-label="What changed">
            {TIMING_FACTORS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`choice-chip${factors.has(f.key) ? " selected" : ""}`}
                aria-pressed={factors.has(f.key)}
                title={hints.get(f.key)}
                onClick={() => toggle(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {prompt.suggested.length > 0 && (
            <p className="muted form-help">Preselected where this batch differs from the usual setup: {prompt.suggested.map((s) => s.hint).join("; ")}.</p>
          )}
          <label className="sr-only" htmlFor={`timing-note-${prompt.fromStage}`}>What changed</label>
          <input
            id={`timing-note-${prompt.fromStage}`}
            type="text"
            placeholder="Optional detail"
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="timing-prompt-actions">
            <button type="button" className="primary" onClick={() => answer("changed")} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" className="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
          </div>
        </div>
      )}
      {message && <p className="timing-prompt-error">{message}</p>}
    </div>
  );
}
