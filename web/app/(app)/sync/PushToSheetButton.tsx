"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pushToSheet } from "./actions";

// Writes the pending backlog (app → sheet) cell by cell via lib/sheet-writeback.
// New edits are written automatically after each save; this catches up the rest.
export default function PushToSheetButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const r = await pushToSheet();
      setMsg(r.message);
      if (r.ok) router.refresh();
    });
  }

  return (
    <span style={{ display: "inline-flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" className="primary" onClick={run} disabled={pending}>
        {pending ? "Writing to sheet…" : "Write pending changes to sheet"}
      </button>
      {msg && (
        <span className="muted" style={{ fontSize: 12 }}>
          {msg}
        </span>
      )}
    </span>
  );
}
