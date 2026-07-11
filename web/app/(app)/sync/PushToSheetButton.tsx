"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pushToSheet } from "./actions";

// Triggers the reverse sync (app → sheet) by dispatching the sheet-export
// workflow. Mirrors SyncFromSheetButton; the actual workbook write happens in
// the Python exporter, and the pending queue clears itself when the job lands.
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
        {pending ? "Starting push…" : "Push to sheet now"}
      </button>
      {msg && (
        <span className="muted" style={{ fontSize: 12 }}>
          {msg}
        </span>
      )}
    </span>
  );
}
