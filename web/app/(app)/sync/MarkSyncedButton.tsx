"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllSynced } from "./actions";

export default function MarkSyncedButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const r = await markAllSynced();
      setMsg(r.message);
      if (r.ok) router.refresh();
    });
  }

  return (
    <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
      <button type="button" className="primary" onClick={run} disabled={pending}>
        {pending ? "Marking…" : "Mark all as synced"}
      </button>
      {msg && (
        <span className="muted" style={{ fontSize: 12 }}>
          {msg}
        </span>
      )}
    </span>
  );
}
