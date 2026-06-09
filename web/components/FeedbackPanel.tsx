"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { usePathname } from "next/navigation";
import { labelForPath } from "@/lib/nav";

// Side notes — a feedback drawer pinned to the right edge of every page.
//
// The beta user types a note; it's filed against the page they're on (path +
// human label captured automatically). The dev polls the same store every few
// seconds, so new requests surface in near-real-time with an unread badge on
// the collapsed tab. Notes can be scoped to the current page or viewed across
// the whole app, and cleared once handled.

interface FeedbackItem {
  id: number;
  page: string;
  page_label: string;
  body: string;
  status: "open" | "done";
  created_at: string;
}

const POLL_MS = 12_000;

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function FeedbackPanel() {
  const pathname = usePathname() || "/";
  const pageLabel = labelForPath(pathname);

  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"page" | "all">("all");
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the newest note id we've shown while the drawer was open, so the
  // collapsed tab can flag how many fresh notes have landed since.
  const seenMaxId = useRef(0);
  const [unseen, setUnseen] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/feedback?scope=all`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { ok: boolean; items: FeedbackItem[] };
      if (!json.ok) return;
      setItems(json.items);
      const maxId = json.items.reduce((m, i) => Math.max(m, i.id), 0);
      if (seenMaxId.current === 0) {
        // First load establishes the baseline without flagging everything new.
        seenMaxId.current = maxId;
      } else if (maxId > seenMaxId.current) {
        const fresh = json.items.filter(
          (i) => i.id > seenMaxId.current && i.status === "open",
        ).length;
        setUnseen((u) => u + fresh);
      }
    } catch {
      /* offline / transient — try again next tick */
    }
  }, []);

  // Poll while mounted; also refresh when the tab regains focus.
  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  // Opening the drawer clears the unread flag and marks everything as seen.
  useEffect(() => {
    if (open) {
      seenMaxId.current = items.reduce((m, i) => Math.max(m, i.id), seenMaxId.current);
      setUnseen(0);
    }
  }, [open, items]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pathname, page_label: pageLabel, body }),
      });
      const json = (await res.json()) as { ok: boolean; item?: FeedbackItem; error?: string };
      if (!res.ok || !json.ok || !json.item) {
        setError(json.error ?? "Couldn't save. Try again.");
      } else {
        setItems((list) => [json.item as FeedbackItem, ...list]);
        seenMaxId.current = Math.max(seenMaxId.current, json.item.id);
        setDraft("");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function setStatus(id: number, status: "open" | "done") {
    // Optimistic — flip locally, reconcile on failure.
    setItems((list) => list.map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      const res = await fetch(`/api/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) load();
    } catch {
      load();
    }
  }

  const visible =
    scope === "page" ? items.filter((i) => i.page === pathname) : items;
  const openCount = items.filter((i) => i.status === "open").length;

  return (
    <>
      {!open && (
        <button
          type="button"
          className="fb-tab"
          onClick={() => setOpen(true)}
          aria-label={`Open side notes${unseen ? `, ${unseen} new` : ""}`}
        >
          <span className="fb-tab-label">Notes</span>
          {unseen > 0 && <span className="fb-tab-badge">{unseen}</span>}
        </button>
      )}

      <aside
        className={`fb-drawer${open ? " open" : ""}`}
        aria-hidden={!open}
        aria-label="Side notes and feedback"
      >
        <header className="fb-head">
          <div>
            <div className="fb-eyebrow">Side notes</div>
            <h2 className="fb-title">Feedback</h2>
          </div>
          <button
            type="button"
            className="fb-x"
            onClick={() => setOpen(false)}
            aria-label="Close side notes"
          >
            ×
          </button>
        </header>

        <form className="fb-compose" onSubmit={submit}>
          <label className="fb-page" title={pathname}>
            For: <span className="fb-page-tag">{pageLabel}</span>
          </label>
          <textarea
            className="fb-textarea"
            placeholder={`What would you change on ${pageLabel}?`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e);
            }}
          />
          {error && <p className="fb-error">{error}</p>}
          <div className="fb-compose-foot">
            <span className="fb-hint">⌘↵ to send</span>
            <button type="submit" className="primary" disabled={sending || !draft.trim()}>
              {sending ? "Sending…" : "Send note"}
            </button>
          </div>
        </form>

        <div className="fb-scope" role="tablist" aria-label="Note scope">
          <button
            type="button"
            role="tab"
            aria-selected={scope === "all"}
            className={scope === "all" ? "active" : ""}
            onClick={() => setScope("all")}
          >
            All{openCount > 0 ? ` · ${openCount} open` : ""}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "page"}
            className={scope === "page" ? "active" : ""}
            onClick={() => setScope("page")}
          >
            This page
          </button>
        </div>

        <div className="fb-list" aria-live="polite">
          {visible.length === 0 ? (
            <p className="fb-empty">
              {scope === "page"
                ? "No notes for this page yet."
                : "No notes yet. Jot the first one above."}
            </p>
          ) : (
            visible.map((i) => (
              <article
                key={i.id}
                className={`fb-note${i.status === "done" ? " done" : ""}`}
              >
                <div className="fb-note-body">{i.body}</div>
                <div className="fb-note-foot">
                  <span className="fb-note-tag">{i.page_label || "App"}</span>
                  <span className="fb-note-time">{timeAgo(i.created_at)}</span>
                  <button
                    type="button"
                    className="fb-note-toggle"
                    onClick={() => setStatus(i.id, i.status === "done" ? "open" : "done")}
                  >
                    {i.status === "done" ? "Reopen" : "Done"}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
