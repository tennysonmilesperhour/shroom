"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestSheetSync } from "./actions";

/** Only an active run disables retry; success and failure never lock out the day. */
export default function SyncFromSheetButton({
  inProgress, configured = true,
}: {
  inProgress: boolean;
  configured?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!inProgress) return;
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [inProgress, router]);

  function run() {
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await requestSheetSync();
        setMsg(r.message);
        if (r.ok) router.refresh();
      } catch { setMsg("Connection interrupted. Please try again."); }
    });
  }

  const done = inProgress && !pending;

  return (
    <span style={{ display: "inline-flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        className="primary"
        onClick={run}
        disabled={pending || done || !configured}
        aria-disabled={pending || done || !configured}
        title={done ? "A sheet import is running" : "Pull the latest from the Master Cultivation Reference sheet"}
      >
        {pending ? "Starting…" : done ? "Sync in progress…" : !configured ? "Cloud sheet not connected" : "Sync from sheet"}
      </button>
      {msg && (
        <span className="muted" role="status" style={{ fontSize: 12 }}>
          {msg}
        </span>
      )}
    </span>
  );
}
