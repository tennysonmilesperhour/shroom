// Circular progress visualization across the batch lifecycle stages.
// Each stage is a labeled arc; completed stages glow, the current one pulses,
// future stages are dim. Elapsed days sit in the center.
//
// Accepts the current stage and an optional inoculation date so the center
// can show "elapsed in stage" or "elapsed since inoculation" depending on
// available data.

import type { ReactNode } from "react";
import { normalizeStage } from "@/lib/stages";

const STAGES = [
  { key: "colonization",  label: "Coloniz." },
  { key: "spawn_to_bulk", label: "Bulk" },
  { key: "fruiting",      label: "Fruit" },
  { key: "harvesting",    label: "Harvest" },
  { key: "spent",         label: "Spent" },
] as const;

type Stage = (typeof STAGES)[number]["key"];

interface LifecycleRingProps {
  stage: string;
  size?: number;
  centerLabel?: string;
  centerValue?: ReactNode;
}

export default function LifecycleRing({
  stage,
  size = 220,
  centerLabel = "Stage",
  centerValue,
}: LifecycleRingProps) {
  const cx = size / 2;
  const cy = size / 2;
  const ringR = size / 2 - 20;
  const segCount = STAGES.length;
  const segGap = 0.04; // radians of gap between arcs

  const norm = normalizeStage(stage);
  const currentIdx = STAGES.findIndex((s) => s.key === norm);
  const isContaminated = norm === "contaminated";

  // Convert a stage index to the arc start/end angles in radians, with
  // angle 0 at 12 o'clock and arcs running clockwise.
  function arcPath(idx: number): string {
    const slice = (Math.PI * 2) / segCount;
    const start = -Math.PI / 2 + idx * slice + segGap / 2;
    const end = -Math.PI / 2 + (idx + 1) * slice - segGap / 2;
    const x1 = cx + ringR * Math.cos(start);
    const y1 = cy + ringR * Math.sin(start);
    const x2 = cx + ringR * Math.cos(end);
    const y2 = cy + ringR * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${ringR} ${ringR} 0 ${large} 1 ${x2} ${y2}`;
  }

  function labelPosition(idx: number): { x: number; y: number } {
    const slice = (Math.PI * 2) / segCount;
    const mid = -Math.PI / 2 + idx * slice + slice / 2;
    const labelR = ringR + 16;
    return {
      x: cx + labelR * Math.cos(mid),
      y: cy + labelR * Math.sin(mid),
    };
  }

  function arcClass(idx: number): string {
    if (isContaminated) return idx === currentIdx ? "arc danger" : "arc done";
    if (currentIdx < 0) return "arc dim";
    if (idx < currentIdx) return "arc done";
    if (idx === currentIdx) return "arc active";
    return "arc dim";
  }

  return (
    <div className="lifecycle-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {STAGES.map((s, i) => (
          <path key={s.key} d={arcPath(i)} className={arcClass(i)} fill="none" />
        ))}
        {STAGES.map((s, i) => {
          const pos = labelPosition(i);
          const isCurrent = i === currentIdx && !isContaminated;
          return (
            <text
              key={`l-${s.key}`}
              x={pos.x}
              y={pos.y}
              className={`stage-label ${isCurrent ? "current" : ""}`}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {s.label}
            </text>
          );
        })}
      </svg>
      <div className="lifecycle-center">
        <div className="lifecycle-center-label">{centerLabel}</div>
        <div className="lifecycle-center-value">
          {isContaminated ? "Contaminated" : centerValue ?? STAGES[currentIdx]?.label ?? "—"}
        </div>
      </div>
    </div>
  );
}

export type { Stage };
