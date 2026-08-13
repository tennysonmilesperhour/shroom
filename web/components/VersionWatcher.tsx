"use client";

import { useEffect, useState } from "react";

interface VersionWatcherProps {
  /** The deployment this page was rendered against. */
  buildId: string;
  /** Stable production endpoint that reports the currently promoted build. */
  versionEndpoint: string;
}

interface VersionResponse {
  buildId: string;
}

// Detects when the deployed build differs from the one this page was
// rendered against. Polls the stable production alias every 30s and also
// checks whenever the tab regains focus or connectivity. When a newer deploy
// is live, renders a persistent toast with an Update button.
export default function VersionWatcher({
  buildId,
  versionEndpoint,
}: VersionWatcherProps) {
  // The newest deployed build id we've seen, if it differs from ours.
  const [latest, setLatest] = useState<string | null>(null);
  const [updateHref, setUpdateHref] = useState<string | null>(null);

  useEffect(() => {
    // Empty baseline = unknown build; nothing to compare against.
    if (!buildId || buildId === "dev") return;

    let cancelled = false;

    async function check() {
      try {
        const url = new URL(versionEndpoint, window.location.origin);
        // Belt-and-suspenders cache busting for proxies that mishandle
        // no-store. The route itself also sends strict no-cache headers.
        url.searchParams.set("_updateCheck", Date.now().toString());
        const res = await fetch(url, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = (await res.json()) as VersionResponse;
        if (cancelled) return;
        if (data.buildId && data.buildId !== buildId) {
          const current = new URL(window.location.href);
          const endpoint = new URL(versionEndpoint, current.origin);
          setLatest(data.buildId);
          setUpdateHref(
            `${endpoint.origin}${current.pathname}${current.search}${current.hash}`,
          );
        } else if (data.buildId === buildId) {
          setLatest(null);
          setUpdateHref(null);
        }
      } catch {
        // Network blip - try again on the next tick.
      }
    }

    check();
    const interval = setInterval(check, 30_000);
    function onVisibility() {
      if (!document.hidden) check();
    }
    function onPageShow(event: PageTransitionEvent) {
      // A page restored from the back/forward cache may have been asleep for
      // hours and needs an immediate freshness check.
      if (event.persisted) check();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [buildId, versionEndpoint]);

  if (latest === null || updateHref === null) return null;

  return (
    <div className="toast version-toast" role="alert" aria-live="assertive">
      <div className="toast-body-text">
        <div className="toast-title">New version available</div>
        <div className="toast-body">Reload to get the latest changes.</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {/* A real link still works if React event handling is degraded. It
            also moves immutable deployment URLs onto the production alias. */}
        <a className="toast-update" href={updateHref}>
          Update now
        </a>
      </div>
    </div>
  );
}
