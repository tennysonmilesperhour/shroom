"use client";

import { useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { NAV_GROUPS } from "@/lib/nav";
import { useToast } from "@/components/ToastProvider";
import { addRoutine, setRoutineDone, deleteRoutine } from "@/app/(app)/actions";

export type RoutineKind = "task" | "check_in" | "automation" | "report";
export type RoutineCadence = "daily" | "weekly" | "monthly" | "as_needed";

export interface Routine {
  id: number;
  kind: RoutineKind;
  title: string;
  cadence: RoutineCadence;
  href: string;
  notes: string;
  last_done_at: string | null;
}

interface GroupMeta {
  kind: RoutineKind;
  label: string;
  icon: string;
  blurb: string;
}

// The four programmable lanes of the command center. Order here is the order
// they render in.
const GROUPS: readonly GroupMeta[] = [
  { kind: "task", label: "Daily tasks", icon: "✓", blurb: "Hands-on work for today" },
  { kind: "check_in", label: "Check-ins", icon: "◎", blurb: "Confirm the operation is healthy" },
  { kind: "automation", label: "Automations", icon: "⚡", blurb: "Background jobs to push" },
  { kind: "report", label: "Reports", icon: "▤", blurb: "Numbers to review" },
];

const CADENCE_LABEL: Record<RoutineCadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  as_needed: "As needed",
};

// Start of the current cadence window, in local time. A routine is "done" for
// the window when last_done_at falls on/after this instant; otherwise it is due.
function windowStart(cadence: RoutineCadence, now: Date): Date | null {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (cadence === "daily") return d;
  if (cadence === "weekly") {
    // ISO-ish week: roll back to Monday.
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
  }
  if (cadence === "monthly") {
    d.setDate(1);
    return d;
  }
  return null; // as_needed never auto-flags as due
}

function isDoneThisWindow(r: Routine, now: Date): boolean {
  if (!r.last_done_at) return false;
  const start = windowStart(r.cadence, now);
  if (!start) return true; // as_needed: any completion counts as done
  return new Date(r.last_done_at).getTime() >= start.getTime();
}

interface RoutinePlannerProps {
  routines: Routine[];
}

export default function RoutinePlanner({ routines }: RoutinePlannerProps) {
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  // Time-derived "due" state can drift between SSR and hydration; gate it.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  function toggleDone(r: Routine, done: boolean) {
    startTransition(async () => {
      const res = await setRoutineDone(r.id, done);
      if (!res.ok) push({ title: "Couldn’t update", body: res.message, tone: "ember" });
    });
  }

  function remove(r: Routine) {
    startTransition(async () => {
      const res = await deleteRoutine(r.id);
      push(
        res.ok
          ? { title: "Removed", body: r.title, tone: "spore" }
          : { title: "Couldn’t remove", body: res.message, tone: "ember" },
      );
    });
  }

  const dueCount = now
    ? routines.filter((r) => !isDoneThisWindow(r, now)).length
    : 0;

  return (
    <section className="command-center" aria-labelledby="cc-title">
      <div className="cc-head">
        <div>
          <div className="eyebrow">Command center</div>
          <h3 id="cc-title">
            Program your day
            {now && (
              <span className="cc-due" aria-label={`${dueCount} due`}>
                {dueCount} due
              </span>
            )}
          </h3>
        </div>
        <button
          type="button"
          className="cc-program-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">{open ? "−" : "+"}</span>
          {open ? "Close" : "Program"}
        </button>
      </div>

      {open && <ProgramForm onSaved={() => setOpen(false)} />}

      <div className="cc-lanes">
        {GROUPS.map((g) => {
          const items = routines.filter((r) => r.kind === g.kind);
          return (
            <div className="cc-lane" key={g.kind}>
              <div className="cc-lane-head">
                <span className="cc-lane-icon" aria-hidden="true">{g.icon}</span>
                <div>
                  <div className="cc-lane-label">{g.label}</div>
                  <div className="cc-lane-blurb muted">{g.blurb}</div>
                </div>
              </div>
              {items.length === 0 ? (
                <div className="cc-empty muted">Nothing programmed yet.</div>
              ) : (
                <ul className="cc-list">
                  {items.map((r) => {
                    const done = now ? isDoneThisWindow(r, now) : false;
                    return (
                      <li key={r.id} className={`cc-item${done ? " is-done" : ""}`}>
                        <button
                          type="button"
                          className="cc-check"
                          aria-pressed={done}
                          aria-label={done ? `Mark ${r.title} not done` : `Mark ${r.title} done`}
                          disabled={pending}
                          onClick={() => toggleDone(r, !done)}
                        >
                          {done ? "✓" : ""}
                        </button>
                        <Link href={r.href} className="cc-body">
                          <span className="cc-item-title">{r.title}</span>
                          <span className="cc-item-meta">
                            <span className="cc-cadence">{CADENCE_LABEL[r.cadence]}</span>
                            {now && !done && r.cadence !== "as_needed" && (
                              <span className="cc-badge-due">due</span>
                            )}
                            {r.notes && <span className="cc-notes muted">· {r.notes}</span>}
                          </span>
                        </Link>
                        <button
                          type="button"
                          className="cc-remove"
                          aria-label={`Remove ${r.title}`}
                          disabled={pending}
                          onClick={() => remove(r)}
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Inline "program a routine" form. Mirrors the EntityForm submit ergonomics
// (transition + toast) but is self-contained so it can live on the dashboard.
function ProgramForm({ onSaved }: { onSaved: () => void }) {
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const ids = {
    kind: useId(),
    title: useId(),
    cadence: useId(),
    href: useId(),
    notes: useId(),
  };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const res = await addRoutine(data);
      push({
        title: res.ok ? "Programmed" : "Couldn’t program",
        body: res.message,
        tone: res.ok ? "moss" : "ember",
      });
      if (res.ok) {
        form.reset();
        onSaved();
      }
    });
  }

  return (
    <form className="form-grid cc-form" onSubmit={onSubmit}>
      <div>
        <label htmlFor={ids.kind}>Type</label>
        <select id={ids.kind} name="kind" defaultValue="task" required>
          {GROUPS.map((g) => (
            <option key={g.kind} value={g.kind}>{g.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.title}>Title</label>
        <input id={ids.title} name="title" required placeholder="e.g. Mist the fruiting room" />
      </div>
      <div>
        <label htmlFor={ids.cadence}>Cadence</label>
        <select id={ids.cadence} name="cadence" defaultValue="daily" required>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="as_needed">As needed</option>
        </select>
      </div>
      <div>
        <label htmlFor={ids.href}>Goes to</label>
        <select id={ids.href} name="href" defaultValue="/" required>
          {NAV_GROUPS.map((group) => (
            <optgroup key={group.key} label={group.label}>
              {group.items.map(([href, label]) => (
                <option key={href} value={href}>{label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="full">
        <label htmlFor={ids.notes}>Notes</label>
        <input id={ids.notes} name="notes" placeholder="Optional reminder of what to do there" />
      </div>
      <div className="actions full">
        <button type="submit" className="primary" data-ripple disabled={pending}>
          {pending ? "Programming…" : "Program it"}
        </button>
      </div>
    </form>
  );
}
