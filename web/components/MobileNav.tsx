"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SporeMark from "@/components/SporeMark";
import ThemeToggle from "@/components/ThemeToggle";
import { NAV_GROUPS, isActive } from "@/lib/nav";

// Mobile shell: sticky top bar + slide-in drawer. Auto-closes on route change,
// Escape, or backdrop tap. Locks body scroll while open. On open, moves focus
// to the first drawer link; on close, restores focus to the toggle. Tab is
// trapped inside the drawer while it's open.
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // Body scroll lock + Escape + Tab trap + focus management.
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus to the first focusable element inside the drawer.
    const drawer = drawerRef.current;
    const focusables = drawer?.querySelectorAll<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusables?.[0];
    const last = focusables?.[focusables.length - 1];
    first?.focus();

    // Snapshot the toggle ref synchronously so the cleanup closure doesn't
    // capture a stale `.current` if the component re-renders.
    const toggle = toggleRef.current;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "Tab" && first && last) {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      // Restore focus to the toggle on close.
      toggle?.focus();
    };
  }, [open]);

  const currentLabel: string =
    NAV_GROUPS.flatMap((g) => g.items)
      .find(([href]) => isActive(href, path))?.[1] ?? "Quantum Blue";

  return (
    <>
      <header className="topbar" role="banner">
        <Link
          href="/"
          className="topbar-brand"
          aria-label="Quantum Blue dashboard"
        >
          <SporeMark size={22} />
          <span className="logo">Quantum Blue</span>
        </Link>
        <span className="topbar-current">{currentLabel}</span>
        <button
          ref={toggleRef}
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
        aria-hidden="true"
      />

      <aside
        ref={drawerRef}
        id="mobile-drawer"
        className={`drawer ${open ? "open" : ""}`}
        aria-label="Primary navigation"
        inert={!open}
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
          <div className="foot-row">
            <span className="who">
              <span className="live-dot" aria-hidden="true" />
              Live · in-house
            </span>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}
