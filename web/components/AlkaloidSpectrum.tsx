"use client";

import { useRef, useState } from "react";
import Link from "next/link";
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
    `L ${p0.x.toFixed(3)} ${p0.y.toFixed(3)}`,
    `A ${rOut.toFixed(3)} ${rOut.toFixed(3)} 0 0 0 ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

export default function AlkaloidSpectrum({ strains }: { strains: SpectrumStrain[] }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = strains.find((s) => s.id === activeId) ?? null;
  const readoutRef = useRef<HTMLDivElement>(null);
  // Which wedge the last tap selected, and what kind of pointer produced the
  // current click. On phones the tap's synthetic mouseenter re-renders the
  // wedge mid-tap and the follow-up click is dropped or lands "already
  // active" depending on timing — so navigation was a coin flip. Touch now
  // gets an explicit two-tap flow: first tap selects and reveals the
  // profile, second tap opens the strain. Mouse behavior is unchanged.
  const lastTapRef = useRef<number | null>(null);
  const pointerTypeRef = useRef<string>("mouse");

  const selectWedge = (id: number) => {
    setActiveId(id);
    // The readout sits below the wheel on phones; make the tapped strain's
    // profile actually appear, otherwise the tap looks like it did nothing.
    readoutRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  // Sort by hue so the wedges sweep through the colour spectrum (gentle → intense),
  // matching the character scale beneath the wheel.
  const ordered = [...strains].sort((a, b) => (a.hue ?? 361) - (b.hue ?? 361) || a.name.localeCompare(b.name));
  const per = 360 / Math.max(ordered.length, 1);

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
          role="group"
          aria-label="Strain spectrum: every Magic library entry has a wedge. Gray means character unknown; an outline means potency unknown."
        >
          <defs>
            <radialGradient id="spectrum-hub" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style={{ stopColor: "var(--spectrum-hub-1)" }} />
              <stop offset="100%" style={{ stopColor: "var(--spectrum-hub-2)" }} />
            </radialGradient>
          </defs>

          {/* field */}
          <circle cx={CX} cy={CY} r={OUTER_R} fill="url(#spectrum-hub)" stroke="var(--line)" />

          {/* strain wedges — each an equal-angle slice colored by its hue */}
          {ordered.map((s, i) => {
            const gap = Math.min(WEDGE_GAP, per * 0.2);
            const a0 = i * per + gap / 2;
            const a1 = (i + 1) * per - gap / 2;
            const rData = displayFrac(s.totalPct) * OUTER_R;
            const isActive = s.id === activeId;
            const color = s.hue == null ? "var(--muted)" : hueColor(s.hue, 74, 0.18);
            return (
              <a
                key={s.id}
                href={`/strains/${s.id}`}
                onPointerDown={(e) => {
                  pointerTypeRef.current = e.pointerType;
                }}
                onClick={(e) => {
                  e.preventDefault();
                  if (pointerTypeRef.current === "touch" && lastTapRef.current !== s.id) {
                    lastTapRef.current = s.id;
                    selectWedge(s.id);
                    return;
                  }
                  router.push(`/strains/${s.id}`);
                }}
                onMouseEnter={() => setActiveId(s.id)}
                onMouseLeave={() => setActiveId((cur) => (cur === s.id ? null : cur))}
                onFocus={() => setActiveId(s.id)}
                onBlur={() => setActiveId((cur) => (cur === s.id ? null : cur))}
                className="spectrum-wedge"
                aria-label={`${s.name}, ${s.hue == null ? "not yet characterized, " : ""}${s.totalPct == null ? "potency not recorded" : `${s.totalPct}% total tryptamine`}`}
              >
                {/* ghost slice to the edge — gives the full pie + a generous hit area */}
                <path d={wedgePath(a0, a1, OUTER_R)} fill={color} opacity={isActive ? 0.22 : 0.12} />
                {/* solid slice whose length is the measured potency */}
                <path
                  d={wedgePath(a0, a1, s.totalPct == null ? OUTER_R : rData)}
                  fill={s.totalPct == null ? "none" : color}
                  opacity={isActive ? 1 : 0.85}
                  stroke={isActive ? "var(--text)" : s.totalPct == null ? color : "transparent"}
                  strokeWidth={isActive ? 1.5 : s.totalPct == null ? 0.7 : 0}
                  strokeDasharray={s.totalPct == null ? "2 3" : undefined}
                  strokeLinejoin="round"
                />
              </a>
            );
          })}

          {/* potency guide rings (drawn over the wedges, non-interactive) */}
          {POTENCY_GUIDES.filter((pct) => totals.length > 0 && pct >= dataMin - 1e-6 && pct <= dataMax + 1e-6).map((pct) => {
            const r = displayFrac(pct) * OUTER_R;
            return (
              <g key={pct} style={{ pointerEvents: "none" }}>
                <circle
                  cx={CX}
                  cy={CY}
                  r={r.toFixed(3)}
                  fill="none"
                  stroke="var(--line-soft)"
                  strokeDasharray="2 4"
                />
                <text x={CX + 3} y={(CY - r + 11).toFixed(3)} className="spectrum-guide-label">
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
        <label className="spectrum-picker">
          Find a strain ({strains.length})
          <select value={activeId ?? ""} onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null;
            setActiveId(id);
            lastTapRef.current = id;
          }}>
            <option value="">Choose a strain</option>
            {[...strains].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.hue == null ? " — not yet characterized" : ""}</option>
            ))}
          </select>
        </label>
        <div className="spectrum-readout" aria-live="polite" ref={readoutRef}>
          {active ? (
            <>
              <div className="spectrum-readout-top">
                <span
                  className="spectrum-swatch"
                  style={{ background: active.hue == null ? "var(--muted)" : hueColor(active.hue, 74, 0.18) }}
                  aria-hidden
                />
                <strong>{active.name}</strong>
              </div>
              <div className="spectrum-readout-meta">
                <span>{active.hue == null ? "Not yet characterized" : active.potencyTier ?? "Potency tier not recorded"}</span>
                <span>
                  {active.totalPct == null ? "Potency not recorded" : active.lowPct != null && active.highPct != null
                    ? `${active.lowPct}–${active.highPct}% total` : `${active.totalPct}% total`}
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
              <Link href={`/strains/${active.id}`} className="spectrum-readout-open">
                Open {active.name} →
              </Link>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Tap or hover a wedge to read its profile. Tap again (or click) to
              open the strain.
            </p>
          )}
        </div>

        <dl className="spectrum-legend">
          <div>
            <dt>Wedge length</dt>
            <dd>
              Recorded total tryptamine (% dry weight). Longer = higher recorded value.
              Dashed outline = potency not recorded; it does not indicate low potency.
            </dd>
          </div>
          <div>
            <dt>Wedge color</dt>
            <dd>
              Reported experiential character — <em>anecdotal</em>. Amber = gentle, cyan = bright/balanced,
              violet = intense. Gray = not yet characterized.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
