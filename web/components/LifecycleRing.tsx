// Circular progress visualization across the batch lifecycle stages.
//
// Each stage owns an arc of the ring plus a label that rides that same arc, so
// the words curve with the segment they name instead of floating beside it.
// The three phase states are drawn differently rather than just recolored:
// done stages are solid, the current one is thick and glowing, and stages still
// ahead are dashed and hollow. Elapsed days (or the stage name) sit in the
// center.
//
// Accepts the current stage and an optional inoculation date so the center
// can show "elapsed in stage" or "elapsed since inoculation" depending on
// available data.

import type { ReactNode } from "react";
import { normalizeStage } from "@/lib/stages";

const STAGES = [
  { key: "colonization",  label: "Colonization" },
  { key: "spawn_to_bulk", label: "Bulk" },
  { key: "fruiting",      label: "Fruiting" },
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

const TAU = Math.PI * 2;
const TOP = -Math.PI / 2;   // angle of 12 o'clock; angles run clockwise from here
const CAP_RATIO = 0.72;     // cap height as a fraction of the label font size
const SEG_GAP = 0.11;       // radians of empty ring between two stage arcs

export default function LifecycleRing({
  stage,
  size = 220,
  centerLabel = "Stage",
  centerValue,
}: LifecycleRingProps) {
  const cx = size / 2;
  const cy = size / 2;
  const segCount = STAGES.length;
  const slice = TAU / segCount;

  // The label band hugs the outer edge and the ring sits just inside it.
  // Deriving both radii from the font size keeps labels from clipping the
  // viewBox or colliding with the arcs at any size.
  const fontSize = Math.max(8, Math.round(size * 0.05));
  const capH = fontSize * CAP_RATIO;
  const stroke = Math.max(6, Math.round(size * 0.036));
  const labelR = size / 2 - 4 - capH;
  const ringR = labelR - fontSize - stroke / 2;
  const nodeR = Math.max(2, size * 0.014);

  const norm = normalizeStage(stage);
  const currentIdx = STAGES.findIndex((s) => s.key === norm);
  const isContaminated = norm === "contaminated";

  function polar(r: number, a: number): readonly [number, number] {
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  }

  function arc(r: number, from: number, to: number): string {
    const [x1, y1] = polar(r, from);
    const [x2, y2] = polar(r, to);
    const large = Math.abs(to - from) > Math.PI ? 1 : 0;
    const sweep = to > from ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
  }

  function segPath(idx: number): string {
    return arc(ringR, TOP + idx * slice + SEG_GAP / 2, TOP + (idx + 1) * slice - SEG_GAP / 2);
  }

  // Labels follow their own stage's arc. Segments on the lower half are drawn
  // backwards so the text never reads upside down; because glyphs then sit on
  // the inside of the baseline, that path is pushed out by one cap height to
  // keep every label in the same visual band.
  function labelPath(idx: number): string {
    const start = TOP + idx * slice;
    const end = start + slice;
    const flipped = Math.sin(start + slice / 2) > 0;
    return flipped ? arc(labelR + capH, end, start) : arc(labelR, start, end);
  }

  function state(idx: number): "done" | "active" | "todo" | "danger" {
    if (isContaminated) return "danger";
    if (currentIdx < 0) return "todo";
    if (idx < currentIdx) return "done";
    if (idx === currentIdx) return "active";
    return "todo";
  }

  return (
    <div className="lifecycle-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          {STAGES.map((s, i) => (
            <path key={`p-${s.key}`} id={`lr-${size}-${s.key}`} d={labelPath(i)} fill="none" />
          ))}
        </defs>

        {STAGES.map((s, i) => {
          const st = state(i);
          return (
            <path
              key={s.key}
              d={segPath(i)}
              className={`arc ${st}`}
              strokeWidth={st === "active" ? stroke + 2 : stroke - 1}
              // Scale the dash with the ring so upcoming stages read as a dashed
              // track at every size rather than a comb of ticks.
              strokeDasharray={st === "todo" ? `${stroke * 0.55} ${stroke}` : undefined}
              fill="none"
            />
          );
        })}

        {/* Checkpoint dots in the gaps: each marks entry into the next stage. */}
        {STAGES.map((s, i) => {
          const [x, y] = polar(ringR, TOP + i * slice);
          return <circle key={`n-${s.key}`} cx={x} cy={y} r={nodeR} className={`node ${state(i)}`} />;
        })}

        {STAGES.map((s, i) => (
          <text key={`l-${s.key}`} className={`stage-label ${state(i)}`} fontSize={fontSize}>
            <textPath href={`#lr-${size}-${s.key}`} startOffset="50%" textAnchor="middle">
              {s.label}
            </textPath>
          </text>
        ))}
      </svg>
      <div className="lifecycle-center">
        <div className="lifecycle-center-label">{centerLabel}</div>
        <div
          className="lifecycle-center-value"
          data-kind={centerValue == null || isContaminated ? "text" : "metric"}
        >
          {isContaminated ? "Contaminated" : centerValue ?? STAGES[currentIdx]?.label ?? "—"}
        </div>
      </div>
    </div>
  );
}

export type { Stage };
