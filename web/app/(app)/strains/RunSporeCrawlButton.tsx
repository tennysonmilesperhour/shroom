"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runSporeCrawlNow } from "./actions";

// Manual trigger for the spore-source crawler. The crawl normally runs weekly
// via Vercel Cron; this lets the operator kick it off on demand (e.g. right
// after flipping a strain's source to "unknown") instead of waiting.
export default function RunSporeCrawlButton({ strainId }: { strainId?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const r = await runSporeCrawlNow(strainId);
      setMsg(r.message ?? null);
      if (r.ok) router.refresh();
    });
  }

  return (
    <span style={{ display: "inline-flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" className="primary" onClick={run} disabled={pending}>
        {pending ? "Searching…" : "Run source search now"}
      </button>
      {msg && (
        <span className="muted" style={{ fontSize: 12 }}>
          {msg}
        </span>
      )}
    </span>
  );
}
