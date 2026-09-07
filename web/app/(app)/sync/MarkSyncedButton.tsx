"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllSynced } from "./actions";

export default function MarkSyncedButton({ cutoff, count }: { cutoff: string; count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    if (!window.confirm(`Mark ${count} pending changes as manually reconciled? This does not write anything to the workbook.`)) return;
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await markAllSynced(cutoff);
        setMsg(r.message);
        if (r.ok) router.refresh();
      } catch {
        setMsg("Could not confirm the update. Refresh the page before trying again.");
      }
    });
  }

  return (
    <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
      <button type="button" className="ghost" onClick={run} disabled={pending || count === 0}>
        {pending ? "Marking…" : "I reconciled these changes manually"}
      </button>
      {msg && (
        <span className="muted" style={{ fontSize: 12 }}>
          {msg}
        </span>
      )}
    </span>
  );
}
