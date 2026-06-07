"use client";

import type { ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useInView } from "@/hooks/useInView";

type GaugeTone = "lumen" | "moss" | "ember" | "spore";

interface RadialGaugeProps {
  /** Fraction of the ring to fill, 0–1. */
  value: number;
  size?: number;
  stroke?: number;
  tone?: GaugeTone;
  centerValue?: ReactNode;
  centerLabel?: string;
  /** Accessible description, e.g. "Dry ratio 9.3 percent". */
  ariaLabel?: string;
}

// Animated progress ring. Uses the normalized pathLength trick so the arc draws
// in on view without measuring geometry in JS. Reduced-motion → final fill.
export default function RadialGauge({
  value,
  size = 148,
  stroke = 10,
  tone = "lumen",
  centerValue,
  centerLabel,
  ariaLabel,
}: RadialGaugeProps) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const clamped = Math.max(0, Math.min(1, value));
  const drawn = inView || reduced;
  const r = (size - stroke) / 2;
  const c = size / 2;

  return (
    <div
      ref={ref}
      className={`gauge tone-${tone} ${drawn ? "in" : ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="gauge-track" cx={c} cy={c} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="gauge-prog"
          cx={c}
          cy={c}
          r={r}
          strokeWidth={stroke}
          fill="none"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={drawn ? 1 - clamped : 1}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </svg>
      <div className="gauge-center">
        {centerValue != null && <b>{centerValue}</b>}
        {centerLabel && <span>{centerLabel}</span>}
      </div>
    </div>
  );
}
