"use client";

import { useEffect } from "react";

// Publishes a few live "vitals" of the operation onto <html> as CSS custom
// properties + a data attribute, so the ambient background (QuantumBackground)
// can react to real state without a second data fetch or crossing the
// layout/context boundary. Mirrors the SectionTint pattern (which sets
// data-section on <html>). Renders nothing.
//
//   --pulse-opacity : 0.72–1   → overall network presence (fuller as more
//                                blocks are in production)
//   --pulse-speed   : 0.7–1.5  → animation-speed multiplier (livelier when the
//                                operation is busy)
//   data-pulse="alert" | "calm" → warm attention wash when rooms are out of spec
//
// A harvest logged very recently briefly tags data-pulse-burst so the network
// can flare once.
export interface OperationVitals {
  activeBatches: number;
  blocks: number;
  alerts: number;
  /** ISO date of the most recent harvest, if any. */
  lastHarvestOn: string | null;
}

export default function OperationPulse({ vitals }: { vitals: OperationVitals }) {
  const { activeBatches, blocks, alerts, lastHarvestOn } = vitals;

  useEffect(() => {
    const root = document.documentElement;

    // Fuller, faster network as the operation ramps; clamped to a tasteful band.
    const opacity = Math.max(0.72, Math.min(1, 0.72 + blocks / 1200));
    const speed = Math.max(0.7, Math.min(1.5, 0.7 + activeBatches / 25));

    root.style.setProperty("--pulse-opacity", opacity.toFixed(3));
    root.style.setProperty("--pulse-speed", speed.toFixed(3));
    root.dataset.pulse = alerts > 0 ? "alert" : "calm";

    // Flare once if the newest harvest is from the last ~36h.
    let cleared: ReturnType<typeof setTimeout> | undefined;
    if (lastHarvestOn) {
      const when = Date.parse(lastHarvestOn + "T12:00:00");
      if (Number.isFinite(when) && Date.now() - when < 36 * 3600 * 1000) {
        root.dataset.pulseBurst = "1";
        cleared = setTimeout(() => {
          delete root.dataset.pulseBurst;
        }, 4200);
      }
    }
    return () => {
      if (cleared) clearTimeout(cleared);
    };
  }, [activeBatches, blocks, alerts, lastHarvestOn]);

  return null;
}
