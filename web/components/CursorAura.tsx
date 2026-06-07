"use client";

import { useEffect } from "react";

// Global atmosphere layer. Two responsibilities, both purely presentational:
//
//   1. A bioluminescent aura that lazily tracks the pointer. We write smoothed
//      --mx/--my CSS variables on <body>; globals.css paints body::after from
//      them. rAF-throttled; no-op on coarse pointers and reduced-motion.
//   2. A click ripple on any [data-ripple] element, via a single delegated
//      pointerdown listener (no per-button wiring).
//
// Renders nothing.
export default function CursorAura() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const body = document.body;

    let cleanupAura: (() => void) | undefined;
    if (!reduced && fine) {
      let tx = 50,
        ty = 0,
        cx = 50,
        cy = 0,
        raf = 0;
      const tick = () => {
        cx += (tx - cx) * 0.08;
        cy += (ty - cy) * 0.08;
        body.style.setProperty("--mx", cx.toFixed(1) + "%");
        body.style.setProperty("--my", cy.toFixed(1) + "%");
        if (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.4) {
          raf = requestAnimationFrame(tick);
        } else {
          raf = 0;
        }
      };
      const onMove = (e: PointerEvent) => {
        tx = (e.clientX / window.innerWidth) * 100;
        ty = (e.clientY / window.innerHeight) * 100;
        if (!raf) raf = requestAnimationFrame(tick);
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      cleanupAura = () => {
        window.removeEventListener("pointermove", onMove);
        if (raf) cancelAnimationFrame(raf);
      };
    }

    // Ripple — skipped under reduced motion.
    const onDown = (e: PointerEvent) => {
      if (reduced) return;
      const target = e.target as HTMLElement | null;
      const host = target?.closest<HTMLElement>("[data-ripple]");
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const span = document.createElement("span");
      span.className = "ripple-ink";
      span.style.width = span.style.height = size + "px";
      span.style.left = e.clientX - rect.left - size / 2 + "px";
      span.style.top = e.clientY - rect.top - size / 2 + "px";
      // Host must be positioned + clip; .has-ripple in globals.css handles that.
      host.appendChild(span);
      span.addEventListener("animationend", () => span.remove());
    };
    window.addEventListener("pointerdown", onDown);

    return () => {
      cleanupAura?.();
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return null;
}
