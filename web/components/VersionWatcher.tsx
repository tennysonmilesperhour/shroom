"use client";

import { useEffect, useState } from "react";

interface VersionWatcherProps {
  /** The commit SHA this page was rendered against. */
  buildId: string;
}

interface VersionResponse {
  buildId: string;
}

// Detects when the deployed build differs from the one this page was
// rendered against. Polls /api/version every 60s and also checks whenever
// the tab regains focus. When a newer deploy is live, renders a toast with
// a Reload button.
export default function VersionWatcher({ buildId }: VersionWatcherProps) {
  // The newest deployed build id we've seen, if it differs from ours.
  const [latest, setLatest] = useState<string | null>(null);
  // The build id the user explicitly dismissed with "Later". A newer deploy
  // (a different id) will re-prompt rather than stay silent forever.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  useEffect(() => {
    // Empty baseline = unknown build; nothing to compare against.
    if (!buildId || buildId === "dev") return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as VersionResponse;
        if (cancelled) return;
        if (data.buildId && data.buildId !== buildId) {
          setLatest(data.buildId);
        }
      } catch {
        // Network blip - try again on the next tick.
      }
    }

    check();
    const interval = setInterval(check, 60_000);
    function onVisibility() {
      if (!document.hidden) check();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [buildId]);

  const stale = latest !== null && latest !== dismissedFor;
  if (!stale) return null;

  return (
    <div className="toast version-toast" role="alert" aria-live="assertive">
      <div className="toast-body-text">
        <div className="toast-title">New version available</div>
        <div className="toast-body">Reload to get the latest changes.</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="toast-dismiss"
          aria-label="Dismiss"
          onClick={() => setDismissedFor(latest)}
        >
          Later
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    </div>
  );
}
