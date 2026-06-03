"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SporeMark from "@/components/SporeMark";
import { NAV_GROUPS, isActive } from "@/lib/nav";

// Mobile shell: sticky top bar + slide-in drawer. Auto-closes on route
// change, Escape, or backdrop tap. Locks body scroll while open.
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // Body scroll lock + Escape handler
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Current page title for the top bar
  const currentLabel: string =
    NAV_GROUPS.flatMap((g) => g.items)
      .find(([href]) => isActive(href, path))?.[1] ?? "Quantum Blue";

  return (
    <>
      <header className="topbar" role="banner">
        <Link href="/" className="topbar-brand" aria-label="Quantum Blue — Dashboard">
          <SporeMark size={22} />
          <span className="logo">Quantum Blue</span>
        </Link>
        <span className="topbar-current" aria-live="polite">
          {currentLabel}
        </span>
        <button
          type="button"
          className="topbar-toggle"
          aria-expanded={open}
          aria-controls="mobile-drawer"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`bars ${open ? "x" : ""}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </header>

      <div
        className={`drawer-backdrop ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside
        id="mobile-drawer"
        className={`drawer ${open ? "open" : ""}`}
        aria-hidden={!open}
        aria-label="Primary navigation"
      >
        <div className="drawer-head">
          <SporeMark size={26} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span className="logo">Quantum Blue</span>
            <span className="eyebrow" style={{ marginTop: 2 }}>Mycology OS</span>
          </div>
        </div>

        <nav className="drawer-nav" aria-label="Primary">
          {NAV_GROUPS.map((g) => (
            <div className="grp-block" key={g.key} data-grp={g.key}>
              <div className="grp">{g.label}</div>
              {g.items.map(([href, label]) => {
                const active = isActive(href, path);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={active ? "active" : ""}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="drawer-foot">
          <span className="who">
            <span className="live-dot" aria-hidden="true" />
            Live · in-house
          </span>
        </div>
      </aside>
    </>
  );
}
