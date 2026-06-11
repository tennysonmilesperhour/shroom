"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  hueColor,
  potencyRadius,
  polarPoint,
  evidenceLabel,
  type SpectrumStrain,
} from "@/lib/spectrum";

const SIZE = 360;
const CX = SIZE / 2;
const CY = SIZE / 2;
const INNER_R = 34; // empty hub
const OUTER_R = 150; // plotting edge
const RING_IN = 154;
const RING_OUT = 168; // colored hue ring band

// Colored hue ring: many wedges so angle === oklch hue.
const RING_SEGMENTS = 72;

function ringWedge(i: number): { d: string; fill: string } {
  const a0 = (i / RING_SEGMENTS) * 360;
  const a1 = ((i + 1) / RING_SEGMENTS) * 360;
  // pad slightly to avoid hairline seams
  const p0in = polarPoint(a0, 0, CX, CY, RING_IN, RING_IN);
  const p1in = polarPoint(a1, 0, CX, CY, RING_IN, RING_IN);
  const p0out = polarPoint(a0, 0, CX, CY, RING_OUT, RING_OUT);
  const p1out = polarPoint(a1, 0, CX, CY, RING_OUT, RING_OUT);
  const d = [
    `M ${p0in.x} ${p0in.y}`,
    `L ${p0out.x} ${p0out.y}`,
    `A ${RING_OUT} ${RING_OUT} 0 0 0 ${p1out.x} ${p1out.y}`,
    `L ${p1in.x} ${p1in.y}`,
    `A ${RING_IN} ${RING_IN} 0 0 1 ${p0in.x} ${p0in.y}`,
    "Z",
  ].join(" ");
  const mid = (a0 + a1) / 2;
  return { d, fill: hueColor(mid, 70, 0.16) };
}

// Potency reference rings (% dry weight) drawn as dashed circles.
const POTENCY_GUIDES = [0.5, 1.0, 1.5, 2.0, 2.5];

export default function AlkaloidSpectrum({ strains }: { strains: SpectrumStrain[] }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = strains.find((s) => s.id === activeId) ?? null;

  return (
    <div className="spectrum">
      <figure className="spectrum-wheel">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Strain spectrum: angle encodes reported character, distance from center encodes measured potency."
        >
          <defs>
            <radialGradient id="spectrum-hub" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="oklch(20% 0.04 235)" />
              <stop offset="100%" stopColor="oklch(13% 0.03 245)" />
            </radialGradient>
          </defs>

          {/* field */}
          <circle cx={CX} cy={CY} r={OUTER_R} fill="url(#spectrum-hub)" stroke="var(--line)" />

          {/* potency guide rings */}
          {POTENCY_GUIDES.map((pct) => {
            const r = INNER_R + potencyRadius(pct) * (OUTER_R - INNER_R);
            return (
              <g key={pct}>
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

          {/* colored hue ring */}
          {Array.from({ length: RING_SEGMENTS }, (_, i) => {
            const { d, fill } = ringWedge(i);
            return <path key={i} d={d} fill={fill} opacity={0.85} />;
          })}

          {/* character anchor labels around the ring */}
          <text x={CX + OUTER_R + 6} y={CY + 4} className="spectrum-axis" textAnchor="start">
            gentle
          </text>
          <text x={CX} y={CY - OUTER_R - 18} className="spectrum-axis" textAnchor="middle">
            balanced · bright
          </text>
          <text x={CX - OUTER_R - 6} y={CY + 4} className="spectrum-axis" textAnchor="end">
            intense
          </text>

          {/* strain dots */}
          {strains.map((s) => {
            const { x, y } = polarPoint(s.hue, potencyRadius(s.totalPct), CX, CY, INNER_R, OUTER_R);
            const isActive = s.id === activeId;
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
                className="spectrum-dot"
                aria-label={`${s.name}, ${s.potencyTier ?? "potency unknown"}, ${s.totalPct ?? "?"}% total tryptamine`}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 9 : 6.5}
                  fill={hueColor(s.hue, 74, 0.18)}
                  stroke={isActive ? "var(--text)" : "oklch(98% 0 0 / 0.55)"}
                  strokeWidth={isActive ? 2 : 1}
                />
                {isActive && (
                  <text x={x} y={y - 13} className="spectrum-dot-label" textAnchor="middle">
                    {s.name}
                  </text>
                )}
              </a>
            );
          })}
        </svg>
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
              Hover or focus a node to read its profile. Click to open the strain.
            </p>
          )}
        </div>

        <dl className="spectrum-legend">
          <div>
            <dt>Distance from center</dt>
            <dd>
              Measured total tryptamine (% dry weight) — <em>lab-grounded</em>. Outer = stronger.
            </dd>
          </div>
          <div>
            <dt>Angle / color</dt>
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
