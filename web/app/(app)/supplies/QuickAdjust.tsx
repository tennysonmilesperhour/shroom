"use client";

import { useState, useTransition } from "react";
import { adjustSupplyQuantity } from "./actions";

interface QuickAdjustProps {
  itemId: number;
  step?: number;
}

// Tiny +/- inline buttons next to a quantity. Posts to a server action.
export default function QuickAdjust({ itemId, step = 1 }: QuickAdjustProps) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function bump(delta: number) {
    setMsg(null);
    startTransition(async () => {
      const r = await adjustSupplyQuantity(itemId, delta);
      if (!r.ok) setMsg(r.message ?? "Failed");
    });
  }

  return (
    <span className="qa">
      <button
        type="button"
        className="qa-btn"
        aria-label="Decrease"
        disabled={pending}
        onClick={() => bump(-step)}
      >
        −
      </button>
      <button
        type="button"
        className="qa-btn"
        aria-label="Increase"
        disabled={pending}
        onClick={() => bump(step)}
      >
        +
      </button>
      {msg && (
        <span className="muted" style={{ marginLeft: 6, fontSize: 11, color: "var(--ember)" }}>
          {msg}
        </span>
      )}
    </span>
  );
}
