"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestSheetSync } from "./actions";

/** "Pull from sheet" button. Greys out once a sync has been run today; the
 * parent recomputes `syncedToday` from sheet_imports after each run. */
export default function SyncFromSheetButton({
  syncedToday,
}: {
  syncedToday: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const r = await requestSheetSync();
      setMsg(r.message);
      if (r.ok) router.refresh();
    });
  }

  const done = syncedToday && !pending;

  return (
    <span style={{ display: "inline-flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        className="primary"
        onClick={run}
        disabled={pending || done}
        aria-disabled={pending || done}
        title={done ? "Already synced today" : "Pull the latest from the Master Cultivation Reference sheet"}
      >
        {pending ? "Starting…" : done ? "✓ Synced today" : "Sync from sheet"}
      </button>
      {msg && (
        <span className="muted" style={{ fontSize: 12 }}>
          {msg}
        </span>
      )}
    </span>
  );
}
