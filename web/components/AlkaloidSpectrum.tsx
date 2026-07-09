"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  hueColor,
  polarPoint,
  evidenceLabel,
  POTENCY_MIN,
  POTENCY_MAX,
  type SpectrumStrain,
} from "@/lib/spectrum";

const SIZE = 360;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = 150; // plotting edge / wedge tip reaches here at max potency
const HUB_R = 7; // tiny center cap where wedges converge

// Gap between neighbouring wedges, in degrees, so each slice reads as its own triangle.
const WEDGE_GAP = 1.4;
// Weakest strain still fills this much of the radius, so the wheel isn't hollow.
const RADIUS_FLOOR = 0.32;
// <1 expands the differences between the clustered mid-potency strains.
const RADIUS_GAMMA = 0.8;

// Potency reference rings (% dry weight) drawn as dashed circles.
const POTENCY_GUIDES = [0.5, 1.0, 1.5, 2.0, 2.5];

/** Pie/coxcomb slice from the center out to `rOut`, spanning [a0, a1] degrees. */
function wedgePath(a0: number, a1: number, rOut: number): string {
  const p0 = polarPoint(a0, 0, CX, CY, rOut, rOut);
  const p1 = polarPoint(a1, 0, CX, CY, rOut, rOut);
  return [
    `M ${CX} ${CY}`,
    `L ${p0.x} ${p0.y}`,
    `A ${rOut} ${rOut} 0 0 0 ${p1.x} ${p1.y}`,
    "Z",
  ].join(" ");
}

export default function AlkaloidSpectrum({ strains }: { strains: SpectrumStrain[] }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = strains.find((s) => s.id === activeId) ?? null;

  // Sort by hue so the wedges sweep through the colour spectrum (gentle → intense),
  // matching the character scale beneath the wheel.
  const ordered = [...strains].sort((a, b) => a.hue - b.hue);
  const per = 360 / ordered.length;

  // Radial scale: spread the wedges across the *actual* potency range on hand
  // rather than the fixed 0.4–2.6% window, so the weakest strain starts at the
  // floor and the strongest reaches the rim — the full radius does work, giving
  // maximum length contrast and little empty space. A gamma curve further pulls
  // the clustered mid-potency strains apart.
  const totals = ordered.map((s) => s.totalPct).filter((v): v is number => v != null);
  const dataMin = totals.length ? Math.min(...totals) : POTENCY_MIN;
  const dataMax = totals.length ? Math.max(...totals) : POTENCY_MAX;
  const span = Math.max(dataMax - dataMin, 0.1);

  const displayFrac = (pct: number | null): number => {
    if (pct == null) return RADIUS_FLOOR;
    const t = Math.min(1, Math.max(0, (pct - dataMin) / span));
    return RADIUS_FLOOR + (1 - RADIUS_FLOOR) * Math.pow(t, RADIUS_GAMMA);
  };

  return (
    <div className="spectrum">
      <figure className="spectrum-wheel">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Strain spectrum: each colored wedge is a strain; wedge length encodes measured potency, color encodes reported character."
        >
          <defs>
            <radialGradient id="spectrum-hub" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="oklch(20% 0.04 235)" />
              <stop offset="100%" stopColor="oklch(13% 0.03 245)" />
            </radialGradient>
          </defs>

          {/* field */}
          <circle cx={CX} cy={CY} r={OUTER_R} fill="url(#spectrum-hub)" stroke="var(--line)" />

          {/* strain wedges — each an equal-angle slice colored by its hue */}
          {ordered.map((s, i) => {
            const a0 = i * per + WEDGE_GAP / 2;
            const a1 = (i + 1) * per - WEDGE_GAP / 2;
            const rData = displayFrac(s.totalPct) * OUTER_R;
            const isActive = s.id === activeId;
            const color = hueColor(s.hue, 74, 0.18);
            return (
              <a
                key={s.id}
                href={`/strains/${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(`/strains/${s.id}`);
                }}
                onMouseEnter={() => setActiveId(s.id)}
                onMouseLeave={() => setActiveId((cur) => (cur === s.id ? null : cur))}
                onFocus={() => setActiveId(s.id)}
                onBlur={() => setActiveId((cur) => (cur === s.id ? null : cur))}
                className="spectrum-wedge"
                aria-label={`${s.name}, ${s.potencyTier ?? "potency unknown"}, ${s.totalPct ?? "?"}% total tryptamine`}
              >
                {/* ghost slice to the edge — gives the full pie + a generous hit area */}
                <path d={wedgePath(a0, a1, OUTER_R)} fill={color} opacity={isActive ? 0.22 : 0.12} />
                {/* solid slice whose length is the measured potency */}
                <path
                  d={wedgePath(a0, a1, rData)}
                  fill={color}
                  opacity={isActive ? 1 : 0.85}
                  stroke={isActive ? "var(--text)" : "transparent"}
                  strokeWidth={isActive ? 1.5 : 0}
                  strokeLinejoin="round"
                />
              </a>
            );
          })}

          {/* potency guide rings (drawn over the wedges, non-interactive) */}
          {POTENCY_GUIDES.filter((pct) => pct >= dataMin - 1e-6 && pct <= dataMax + 1e-6).map((pct) => {
            const r = displayFrac(pct) * OUTER_R;
            return (
              <g key={pct} style={{ pointerEvents: "none" }}>
                <circle
                  cx={CX}
                  cy={CY}
                  r={r}
                  fill="none"
                  stroke="var(--line-soft)"
                  strokeDasharray="2 4"
                />
                <text x={CX + 3} y={CY - r + 11} className="spectrum-guide-label">
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* center cap hides the converging wedge tips */}
          <circle cx={CX} cy={CY} r={HUB_R} fill="url(#spectrum-hub)" stroke="var(--line)" style={{ pointerEvents: "none" }} />
        </svg>

        {/* character scale — color → reported character, well-aligned with the wheel's spectrum */}
        <figcaption className="spectrum-scale">
          <span className="spectrum-scale-bar" aria-hidden />
          <span className="spectrum-scale-labels">
            <span>gentle</span>
            <span>balanced · bright</span>
            <span>intense</span>
          </span>
        </figcaption>
      </figure>

      <div className="spectrum-side">
        <div className="spectrum-readout" aria-live="polite">
          {active ? (
            <>
              <div className="spectrum-readout-top">
                <span
                  className="spectrum-swatch"
                  style={{ background: hueColor(active.hue, 74, 0.18) }}
                  aria-hidden
                />
                <strong>{active.name}</strong>
              </div>
              <div className="spectrum-readout-meta">
                <span>{active.potencyTier ?? "—"}</span>
                <span>
                  {active.lowPct ?? "?"}–{active.highPct ?? "?"}% total
                </span>
                <span>{evidenceLabel(active.evidenceGrade)}</span>
              </div>
              {active.tags.length > 0 && (
                <div className="spectrum-readout-tags">
                  {active.tags.map((t) => (
                    <span key={t} className="badge muted">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Hover or focus a wedge to read its profile. Click to open the strain.
            </p>
          )}
        </div>

        <dl className="spectrum-legend">
          <div>
            <dt>Wedge length</dt>
            <dd>
              Measured total tryptamine (% dry weight) — <em>lab-grounded</em>. Longer = stronger.
            </dd>
          </div>
          <div>
            <dt>Wedge color</dt>
            <dd>
              Reported experiential character — <em>anecdotal</em>. Amber = gentle, cyan = bright/balanced,
              violet = intense.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
