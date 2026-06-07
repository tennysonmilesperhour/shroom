"use client";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useInView } from "@/hooks/useInView";

type MeterTone = "lumen" | "moss" | "ember" | "spore";

interface MeterProps {
  /** Fill fraction, 0–1. */
  value: number;
  tone?: MeterTone;
  /** Optional reference marker fraction (e.g. a floor/target line), 0–1. */
  marker?: number;
  className?: string;
  ariaLabel?: string;
}

// A thin horizontal bar that fills to `value` when scrolled into view.
// Reduced-motion → filled immediately. Optional marker draws a reference tick.
export default function Meter({ value, tone = "lumen", marker, className, ariaLabel }: MeterProps) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const clamped = Math.max(0, Math.min(1, value));
  const filled = inView || reduced ? clamped : 0;

  return (
    <div
      ref={ref}
      className={`meter tone-${tone} ${className ?? ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={ariaLabel}
    >
      <span className="meter-fill" style={{ width: `${filled * 100}%` }} />
      {marker != null && (
        <span className="meter-marker" style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }} />
      )}
    </div>
  );
}
