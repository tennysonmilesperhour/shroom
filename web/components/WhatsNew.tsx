"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Portal from "@/components/Portal";
import { WHATS_NEW, type WhatsNewEntry, type WhatsNewStep } from "@/lib/whats-new";

const SEEN_KEY = "shroom-whats-new-seen";

function readSeen(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    /* Private mode or blocked storage: the button just keeps glowing. */
  }
}

function formatDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll until `find` returns something, or give up after `timeout` ms. */
async function waitFor<T>(find: () => T | null, timeout: number, cancelled: () => boolean): Promise<T | null> {
  const start = Date.now();
  while (!cancelled()) {
    const found = find();
    if (found) return found;
    if (Date.now() - start > timeout) return null;
    await sleep(120);
  }
  return null;
}

const query = (selector: string) => document.querySelector<HTMLElement>(selector);

export default function WhatsNew() {
  const router = useRouter();
  const [unseen, setUnseen] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  // Entries that were new when the panel opened, so their "New" tag stays put while it's open.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [tour, setTour] = useState<{ entry: WhatsNewEntry; index: number; direction: 1 | -1 } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seen = readSeen();
    setUnseen(new Set(WHATS_NEW.filter((e) => !seen.has(e.id)).map((e) => e.id)));
    setReady(true);
  }, []);

  function openPanel() {
    setFreshIds(unseen);
    setOpen(true);
    const seen = readSeen();
    for (const entry of WHATS_NEW) seen.add(entry.id);
    writeSeen(seen);
    setUnseen(new Set());
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: PointerEvent) {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  function showMe(entry: WhatsNewEntry) {
    setOpen(false);
    setTour({ entry, index: 0, direction: 1 });
  }

  const count = unseen.size;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`whats-new-btn${count > 0 ? " glow" : ""}`}
        data-ready={ready || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count > 0 ? `What's new: ${count} update${count === 1 ? "" : "s"} you haven't seen` : "What's new"}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <span aria-hidden="true">✦</span>
        <span className="whats-new-label">What&rsquo;s new</span>
        <span className="whats-new-short" aria-hidden="true">New</span>
        {count > 0 && <span className="whats-new-count" aria-hidden="true">{count}</span>}
      </button>

      {open && (
        <Portal>
          <div ref={panelRef} className="whats-new-panel" role="dialog" aria-label="What's new" tabIndex={-1}>
            <div className="whats-new-head">
              <b>What&rsquo;s new</b>
              <button type="button" className="whats-new-close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            </div>
            <ol className="whats-new-list">
              {WHATS_NEW.map((entry) => (
                <li key={entry.id}>
                  <div className="whats-new-meta">
                    <span>{formatDate(entry.date)}</span>
                    {freshIds.has(entry.id) && <span className="badge blue">new</span>}
                  </div>
                  <b className="whats-new-title">{entry.title}</b>
                  <p>{entry.summary}</p>
                  {entry.steps && entry.steps.length > 0 && (
                    <button type="button" className="primary whats-new-show" onClick={() => showMe(entry)}>
                      Show me
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </Portal>
      )}

      {tour && (
        <Tour
          key={`${tour.entry.id}-${tour.index}`}
          entry={tour.entry}
          index={tour.index}
          direction={tour.direction}
          onMove={(index) =>
            setTour(index >= 0 && index < (tour.entry.steps?.length ?? 0)
              ? { entry: tour.entry, index, direction: index < tour.index ? -1 : 1 }
              : null)}
          onClose={() => setTour(null)}
          navigate={(href) => router.push(href)}
        />
      )}
    </>
  );
}

/** One step of a "Show me" walkthrough: go to the right page, spotlight the spot, explain it. */
function Tour({
  entry,
  index,
  direction,
  onMove,
  onClose,
  navigate,
}: {
  entry: WhatsNewEntry;
  index: number;
  direction: 1 | -1;
  onMove: (index: number) => void;
  onClose: () => void;
  navigate: (href: string) => void;
}) {
  const steps = entry.steps ?? [];
  const step: WhatsNewStep = steps[index];
  const [status, setStatus] = useState<"finding" | "found" | "missing">("finding");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardAtTop, setCardAtTop] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    (async () => {
      const find = () => (step.target ? query(step.target) : null);
      if (step.target && !find()) {
        if (step.route && window.location.pathname !== step.route) {
          navigate(step.route);
          await waitFor(() => (window.location.pathname === step.route ? true : null), 8000, isCancelled);
        }
        if (step.follow && !find()) {
          const link = await waitFor(() => query(step.follow!) as HTMLAnchorElement | null, 5000, isCancelled);
          const href = link?.getAttribute("href");
          if (href) {
            navigate(href);
            await waitFor(() => (window.location.pathname === href.split("?")[0] ? true : null), 8000, isCancelled);
          }
        }
      }
      const element = step.target ? await waitFor(find, 6000, isCancelled) : null;
      if (cancelled) return;
      if (!element && step.target && step.optional) {
        onMove(index + direction);
        return;
      }
      elementRef.current = element;
      if (element) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        await sleep(reduce ? 50 : 450);
        if (cancelled) return;
        setRect(element.getBoundingClientRect());
        setStatus("found");
      } else {
        setStatus(step.target ? "missing" : "found");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Each step mounts its own Tour (keyed), so this runs once per step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the spotlight on the element while the page scrolls or resizes.
  useEffect(() => {
    if (status !== "found" || !elementRef.current) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => elementRef.current && setRect(elementRef.current.getBoundingClientRect()));
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [status]);

  // Put the explanation at the top of the screen when the spotlight sits under it.
  useLayoutEffect(() => {
    if (!rect || !cardRef.current) return;
    const cardHeight = cardRef.current.offsetHeight + 24;
    setCardAtTop(rect.bottom > window.innerHeight - cardHeight && rect.top > cardHeight);
  }, [rect]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const last = index === steps.length - 1;
  const pad = 6;

  return (
    <Portal>
      {rect && status === "found" && (
        <div
          className="tour-spotlight"
          aria-hidden="true"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      )}
      <div
        ref={cardRef}
        className={`tour-card${cardAtTop ? " top" : ""}`}
        role="dialog"
        aria-live="polite"
        aria-label={`${entry.title}: step ${index + 1} of ${steps.length}`}
      >
        <div className="tour-progress">
          Step {index + 1} of {steps.length}
        </div>
        <b className="tour-title">{step.title}</b>
        {status === "finding" ? (
          <p className="muted">Finding it…</p>
        ) : (
          <p>{step.body}</p>
        )}
        {status === "missing" && (
          <p className="muted form-help">This part isn&rsquo;t on screen right now, but here&rsquo;s what it does.</p>
        )}
        <div className="tour-actions">
          {!last && (
            <button type="button" className="ghost" onClick={onClose}>
              Skip
            </button>
          )}
          <span className="tour-spacer" />
          {index > 0 && (
            <button type="button" className="ghost" onClick={() => onMove(index - 1)}>
              Back
            </button>
          )}
          <button type="button" className="primary" onClick={() => (last ? onClose() : onMove(index + 1))}>
            {last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </Portal>
  );
}
