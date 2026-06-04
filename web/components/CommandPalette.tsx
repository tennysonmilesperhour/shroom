"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV_GROUPS } from "@/lib/nav";

interface BatchEntry {
  id: number;
  lot_code: string;
  stage: string;
  strain: string | null;
}
interface StrainEntry {
  id: number;
  name: string;
  mushroom_type: string;
}
interface CustomerEntry {
  id: number;
  name: string;
  channel: string;
}
interface OrderEntry {
  id: number;
  order_number: string;
  date: string;
  customer: string | null;
}

interface CommandIndex {
  batches: BatchEntry[];
  strains: StrainEntry[];
  customers: CustomerEntry[];
  orders: OrderEntry[];
}

interface Result {
  href: string;
  title: string;
  hint: string;
  group: "Pages" | "Batches" | "Strains" | "Customers" | "Orders";
}

interface CommandPaletteProps {
  index: CommandIndex;
}

const PAGE_RESULTS: Result[] = NAV_GROUPS.flatMap((g) =>
  g.items.map(
    ([href, label]): Result => ({
      href,
      title: label,
      hint: g.label,
      group: "Pages",
    }),
  ),
);

function buildResults(index: CommandIndex): Result[] {
  const batches: Result[] = index.batches.map((b) => ({
    href: `/batches/${b.id}`,
    title: b.lot_code,
    hint: [b.strain, b.stage].filter(Boolean).join(" · "),
    group: "Batches",
  }));
  const strains: Result[] = index.strains.map((s) => ({
    href: `/strains/${s.id}`,
    title: s.name,
    hint: s.mushroom_type,
    group: "Strains",
  }));
  const customers: Result[] = index.customers.map((c) => ({
    href: `/customers/${c.id}`,
    title: c.name,
    hint: c.channel,
    group: "Customers",
  }));
  const orders: Result[] = index.orders.map((o) => ({
    href: `/orders`,
    title: o.order_number,
    hint: [o.customer, o.date].filter(Boolean).join(" · "),
    group: "Orders",
  }));
  return [...PAGE_RESULTS, ...batches, ...strains, ...customers, ...orders];
}

function scoreMatch(query: string, text: string): number {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  // Subsequence match (very loose).
  let i = 0;
  for (const ch of t) {
    if (ch === q[i]) i++;
    if (i === q.length) return 30;
  }
  return 0;
}

export default function CommandPalette({ index }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const all = useMemo(() => buildResults(index), [index]);

  // Filter + score.
  const results = useMemo<Result[]>(() => {
    if (!q.trim()) {
      return PAGE_RESULTS.slice(0, 8);
    }
    const scored = all
      .map((r) => ({
        r,
        score: Math.max(scoreMatch(q, r.title), scoreMatch(q, r.hint) - 10),
      }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((s) => s.r);
    return scored;
  }, [q, all]);

  // Open/close keyboard shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset when opening.
  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset active index when results change.
  useEffect(() => {
    setActive(0);
  }, [q]);

  // Scroll active into view.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const el = list.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function go(r: Result | undefined) {
    if (!r) return;
    setOpen(false);
    router.push(r.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  }

  if (!open) return null;

  // Group results for display.
  const groups: Record<Result["group"], Result[]> = {
    Pages: [], Batches: [], Strains: [], Customers: [], Orders: [],
  };
  results.forEach((r) => groups[r.group].push(r));

  let flatIdx = -1;

  return (
    <div
      className="cmdk-backdrop"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="cmdk-panel" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="cmdk-input"
          placeholder="Search batches, strains, customers, orders…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onInputKey}
          aria-label="Search"
          aria-controls="cmdk-list"
        />
        <ul className="cmdk-list" id="cmdk-list" ref={listRef} role="listbox">
          {results.length === 0 ? (
            <li className="cmdk-empty">No matches.</li>
          ) : (
            (Object.entries(groups) as [Result["group"], Result[]][])
              .filter(([, items]) => items.length > 0)
              .flatMap(([group, items]) => [
                <li className="cmdk-group" key={group} aria-hidden="true">
                  {group}
                </li>,
                ...items.map((r) => {
                  flatIdx += 1;
                  const isActive = flatIdx === active;
                  return (
                    <li
                      key={`${group}-${r.href}-${r.title}-${flatIdx}`}
                      className={`cmdk-item ${isActive ? "active" : ""}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActive(flatIdx)}
                      onClick={() => go(r)}
                    >
                      <span className="cmdk-title">{r.title}</span>
                      <span className="cmdk-hint">{r.hint}</span>
                    </li>
                  );
                }),
              ])
          )}
        </ul>
        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
