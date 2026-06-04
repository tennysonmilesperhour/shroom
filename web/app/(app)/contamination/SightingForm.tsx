"use client";

import { useId, useState, useTransition } from "react";
import { logSighting, type SightingResult } from "./actions";

interface BatchOption {
  id: number;
  lot_code: string;
  container_id: string | null;
}

interface GuideHint {
  label: string;
  action: string;
}

interface SightingFormProps {
  batches: BatchOption[];
  guides: GuideHint[];
}

const TYPES = [
  "trichoderma",
  "cobweb",
  "bacterial_blotch",
  "green_mold",
  "wet_spot",
  "other",
] as const;

export default function SightingForm({ batches, guides }: SightingFormProps) {
  const batchSelectId = useId();
  const typeSelectId = useId();
  const sevSelectId = useId();
  const photoId = useId();
  const actionId = useId();

  const [contamType, setContamType] = useState<string>(TYPES[0]);
  const [result, setResult] = useState<SightingResult | null>(null);
  const [pending, startTransition] = useTransition();

  const guideHint = guides.find((g) =>
    g.label.toLowerCase().includes(contamType.split("_")[0]),
  )?.action;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const res = await logSighting(data);
      setResult(res);
      if (res.ok) form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <div style={{ marginBottom: 10 }}>
        <label htmlFor={batchSelectId} className="eyebrow" style={{ display: "block", marginBottom: 4 }}>
          Batch
        </label>
        <select id={batchSelectId} name="batch_id" required defaultValue="">
          <option value="">Select batch…</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.container_id || b.lot_code} - {b.lot_code}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label
            htmlFor={typeSelectId}
            className="eyebrow"
            style={{ display: "block", marginBottom: 4 }}
          >
            Type
          </label>
          <select
            id={typeSelectId}
            name="contam_type"
            value={contamType}
            onChange={(e) => setContamType(e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: 130 }}>
          <label
            htmlFor={sevSelectId}
            className="eyebrow"
            style={{ display: "block", marginBottom: 4 }}
          >
            Severity
          </label>
          <select id={sevSelectId} name="severity" defaultValue="low">
            <option value="low">low</option>
            <option value="med">med</option>
            <option value="high">high</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label
          htmlFor={photoId}
          className="eyebrow"
          style={{ display: "block", marginBottom: 4 }}
        >
          Photo URL
        </label>
        <input
          id={photoId}
          name="photo_url"
          type="url"
          placeholder="https://…"
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label
          htmlFor={actionId}
          className="eyebrow"
          style={{ display: "block", marginBottom: 4 }}
        >
          Action taken
        </label>
        <textarea
          id={actionId}
          name="action_taken"
          rows={2}
          placeholder="What did you do about it?"
        />
      </div>

      {guideHint && (
        <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          <span aria-hidden="true">📖</span> Reference guide: {guideHint}
        </p>
      )}

      <button type="submit" className="primary" disabled={pending}>
        {pending ? "Logging…" : "Log sighting"}
      </button>
      {result && (
        <span
          className={result.ok ? "muted" : "err"}
          style={{ marginLeft: 12, color: result.ok ? "var(--moss)" : "var(--ember)" }}
          role="status"
        >
          {result.message}
        </span>
      )}
    </form>
  );
}
