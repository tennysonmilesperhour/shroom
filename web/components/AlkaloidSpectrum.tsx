"use client";

import { useEffect, useRef, useState } from "react";
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

import { angleDistance, magnifyAngle, FOCUS_HALF_WIDTH, FOCUS_SCALE } from "@/lib/spectrum-focus";

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
  const wheelRef = useRef<SVGSVGElement>(null);
  const [focusAngle, setFocusAngle] = useState<number | null>(null);
  const touch = useRef<{ x: number; y: number; moved: boolean; openId: number | null } | null>(null);
  const pointerTypeRef = useRef("mouse");
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!wheelRef.current?.contains(event.target as Node)) setFocusAngle(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  // Sort by hue so the wedges sweep through the colour spectrum (gentle → intense),
  // matching the character scale beneath the wheel.
  const ordered = [...strains].sort((a, b) => (a.hue ?? 361) - (b.hue ?? 361) || a.name.localeCompare(b.name));
  const per = 360 / Math.max(ordered.length, 1);

  const pointAngle = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) * SIZE / box.width - CX;
    const y = (event.clientY - box.top) * SIZE / box.height - CY;
    if (Math.hypot(x, y) < HUB_R || Math.hypot(x, y) > OUTER_R) return null;
    return (Math.atan2(-y, x) * 180 / Math.PI + 360) % 360;
  };
  const focusAt = (angle: number | null) => {
    setFocusAngle(angle);
    setActiveId(angle == null ? null : ordered[Math.floor(angle / per)]?.id ?? null);
  };

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
          ref={wheelRef}
          data-magnified={focusAngle != null}
          style={{ touchAction: "none" }}
          onPointerDown={(event) => {
            pointerTypeRef.current = event.pointerType;
            if (event.pointerType === "mouse") return;
            if (!event.isPrimary) return;
            event.preventDefault();
            const angle = pointAngle(event);
            const target = (event.target as Element).closest("a[data-strain-id]");
            const nearby = angle != null && focusAngle != null &&
              Math.abs(angleDistance(angle, focusAngle)) <= FOCUS_HALF_WIDTH * FOCUS_SCALE;
            touch.current = { x: event.clientX, y: event.clientY, moved: false,
              openId: nearby && target ? Number(target.getAttribute("data-strain-id")) : null };
            event.currentTarget.setPointerCapture(event.pointerId);
            if (!nearby) focusAt(angle);
          }}
          onPointerMove={(event) => {
            if (event.pointerType === "mouse") {
              const angle = pointAngle(event);
              // Hold the lens while crossing enlarged neighbors so their real
              // click targets stay larger instead of moving away from the cursor.
              if (angle == null || focusAngle == null ||
                Math.abs(angleDistance(angle, focusAngle)) > FOCUS_HALF_WIDTH * FOCUS_SCALE) {
                focusAt(angle);
              } else {
                const target = (event.target as Element).closest("a[data-strain-id]");
                setActiveId(target ? Number(target.getAttribute("data-strain-id")) : null);
              }
            } else if (event.isPrimary && touch.current) {
              if (Math.hypot(event.clientX - touch.current.x, event.clientY - touch.current.y) > 8) {
                touch.current.moved = true;
                focusAt(pointAngle(event));
              }
            }
          }}
          onPointerUp={(event) => {
            if (event.pointerType === "mouse" || !event.isPrimary) return;
            event.preventDefault();
            const gesture = touch.current;
            touch.current = null;
            if (gesture && !gesture.moved && gesture.openId != null) router.push(`/strains/${gesture.openId}`);
          }}
          onPointerCancel={() => { touch.current = null; focusAt(null); }}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") focusAt(null); }}
          onKeyDown={(event) => { if (event.key === "Escape") focusAt(null); }}
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
            const a0 = magnifyAngle(i * per + gap / 2, focusAngle);
            const a1 = magnifyAngle((i + 1) * per - gap / 2, focusAngle);
            const rData = displayFrac(s.totalPct) * OUTER_R;
            const isActive = s.id === activeId;
            const color = s.hue == null ? "var(--muted)" : hueColor(s.hue, 74, 0.18);
            return (
              <a
                key={s.id}
                href={`/strains/${s.id}`}
                data-strain-id={s.id}
                onClick={(event) => {
                  event.preventDefault();
                  if (event.detail === 0 || pointerTypeRef.current === "mouse") router.push(`/strains/${s.id}`);
                }}
                onFocus={() => { setActiveId(s.id); setFocusAngle((i + 0.5) * per); }}
                onBlur={() => { setActiveId(null); setFocusAngle(null); }}
                className="spectrum-wedge"
                aria-label={`${s.name}, ${s.hue == null ? "not yet characterized, " : ""}${s.totalPct == null ? "potency not recorded" : `${s.totalPct}% total tryptamine`}`}
              >
                {/* ghost slice to the edge — gives the full pie + a generous hit area */}
                <path d={wedgePath(a0, a1, OUTER_R)} fill={color} opacity={isActive ? 0.22 : 0.12} />
                {/* Recorded reference potency; magnification changes angles only. */}
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
        <p className="muted spectrum-help">Hover to magnify · Touch or drag, then tap a larger slice to open</p>
        <button type="button" className="ghost spectrum-reset" disabled={focusAngle == null} onClick={() => focusAt(null)}>Reset magnification</button>
      </figure>

      <div className="spectrum-side">
        <label className="spectrum-picker">
          Find a strain ({strains.length})
          <select value={activeId ?? ""} onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null;
            setActiveId(id);
            setFocusAngle(id == null ? null : (ordered.findIndex((s) => s.id === id) + 0.5) * per);
          }}>
            <option value="">Choose a strain</option>
            {[...strains].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.hue == null ? " — not yet characterized" : ""}</option>
            ))}
          </select>
        </label>
        <div className="spectrum-readout" aria-live="polite">
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
              Hover to magnify nearby slices, then click to open. On a phone, touch or drag to magnify, then tap an enlarged slice to open it.
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
