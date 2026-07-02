"use client";

import Link from "next/link";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// "State of the mycelium" — the dashboard centerpiece (#5). Every active lot is
// a node placed on a concentric ring by lifecycle stage (colonization inner →
// harvesting outer), sized by unit count, colored by mushroom type, tethered to
// the core by a faint hypha. One glance answers "what's alive, how far along,
// how much." Purely presentational; data comes from the server component.
//
// Determinism: node jitter is derived from the batch id (no Math.random), so
// SSR and client markup match and the bloom doesn't reshuffle on every render.

export interface BloomNode {
  id: number;
  lot_code: string;
  stage: string;
  strain: string | null;
  type: string | null; // mushroom_type
  units: number;
}

// Inner → outer. Anything unknown lands on the outer ring.
const RING_STAGES = ["colonization", "spawn_to_bulk", "fruiting", "harvesting"] as const;
const RING_RADIUS: Record<string, number> = {
  colonization: 52,
  spawn_to_bulk: 84,
  fruiting: 116,
  harvesting: 146,
};
const STAGE_LABEL: Record<string, string> = {
  colonization: "Colonizing",
  spawn_to_bulk: "Spawn → bulk",
  fruiting: "Fruiting",
  harvesting: "Harvesting",
};

const C = 170; // center / half of the 340 viewBox
const MAX_NODES = 64;

function typeClass(type: string | null): string {
  if (type === "psychedelic") return "psy";
  if (type === "functional") return "fun";
  if (type === "gourmet") return "gourmet";
  return "other";
}

// Small deterministic hash → [0,1)
function frac(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function nodeRadius(units: number): number {
  const u = Math.max(0, units);
  return Math.max(4, Math.min(11, 4 + Math.sqrt(u) * 1.1));
}

export default function MyceliumBloom({ nodes }: { nodes: BloomNode[] }) {
  const reduced = useReducedMotion();
  const shown = nodes.slice(0, MAX_NODES);
  const overflow = nodes.length - shown.length;

  // Bucket by ring so we can spread each ring's nodes evenly around the circle.
  const byRing = new Map<string, BloomNode[]>();
  for (const n of shown) {
    const ring = RING_RADIUS[n.stage] != null ? n.stage : "harvesting";
    const arr = byRing.get(ring) ?? [];
    arr.push(n);
    byRing.set(ring, arr);
  }

  interface Placed extends BloomNode {
    x: number;
    y: number;
    r: number;
    ring: string;
    delay: number;
  }
  const placed: Placed[] = [];
  for (const [ring, arr] of byRing) {
    const radius = RING_RADIUS[ring];
    const step = (Math.PI * 2) / arr.length;
    arr.forEach((n, i) => {
      // Even spacing + a deterministic wobble so rings don't look mechanical.
      const jitterA = (frac(n.id) - 0.5) * step * 0.55;
      const jitterR = (frac(n.id * 3.3) - 0.5) * 10;
      const angle = i * step + jitterA - Math.PI / 2;
      const rr = radius + jitterR;
      placed.push({
        ...n,
        ring,
        r: nodeRadius(n.units),
        x: C + Math.cos(angle) * rr,
        y: C + Math.sin(angle) * rr,
        delay: frac(n.id * 7.7) * 6,
      });
    });
  }

  const total = nodes.length;
  const summary =
    total === 0
      ? "No active lots."
      : `${total} active ${total === 1 ? "lot" : "lots"} across ${byRing.size} ${
          byRing.size === 1 ? "stage" : "stages"
        }.`;

  return (
    <section className="bloom-wrap" aria-labelledby="bloom-title">
      <div className="bloom-figure">
        <svg
          viewBox="0 0 340 340"
          className={`bloom ${reduced ? "reduced" : ""}`}
          role="img"
          aria-label={`State of the mycelium: ${summary}`}
        >
          <defs>
            <radialGradient id="bloomCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--lumen)" stopOpacity="0.55" />
              <stop offset="60%" stopColor="var(--indigo)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--indigo)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Guide rings */}
          {RING_STAGES.map((s) => (
            <circle
              key={s}
              className="bloom-ring"
              cx={C}
              cy={C}
              r={RING_RADIUS[s]}
              fill="none"
            />
          ))}

          {/* Core glow */}
          <circle cx={C} cy={C} r={150} fill="url(#bloomCore)" />

          {/* Hyphae: tether each node to the core */}
          <g className="bloom-hyphae">
            {placed.map((p) => (
              <line key={`h${p.id}`} x1={C} y1={C} x2={p.x} y2={p.y} />
            ))}
          </g>

          {/* Nodes */}
          <g className="bloom-nodes">
            {placed.map((p) => (
              <circle
                key={p.id}
                className={`bloom-node type-${typeClass(p.type)}`}
                cx={p.x}
                cy={p.y}
                r={p.r}
                style={{ animationDelay: `${p.delay.toFixed(2)}s` }}
              >
                <title>{`${p.lot_code} · ${p.strain ?? "—"} · ${
                  STAGE_LABEL[p.ring] ?? p.ring
                } · ${p.units} units`}</title>
              </circle>
            ))}
          </g>

          {/* Core label */}
          <text className="bloom-core-num" x={C} y={C - 2} textAnchor="middle">
            {total}
          </text>
          <text className="bloom-core-label" x={C} y={C + 16} textAnchor="middle">
            active {total === 1 ? "lot" : "lots"}
          </text>
        </svg>
      </div>

      <div className="bloom-side">
        <div className="eyebrow">Living map</div>
        <h2 id="bloom-title" className="section">
          State of the mycelium
        </h2>
        <p className="lead" style={{ marginBottom: "var(--space-4)" }}>
          Every active lot, placed by how far it&rsquo;s come — colonizing at the
          core, harvesting at the rim.
        </p>

        <ul className="bloom-legend" aria-hidden="true">
          {RING_STAGES.map((s) => {
            const count = (byRing.get(s) ?? []).length;
            return (
              <li key={s}>
                <span className={`bloom-dot ring-${s}`} />
                <span className="bloom-legend-label">{STAGE_LABEL[s]}</span>
                <span className="bloom-legend-count num">{count}</span>
              </li>
            );
          })}
        </ul>

        <div className="bloom-types" aria-hidden="true">
          <span><i className="bloom-swatch type-psy" /> Psychedelic</span>
          <span><i className="bloom-swatch type-fun" /> Functional</span>
          <span><i className="bloom-swatch type-gourmet" /> Gourmet</span>
        </div>

        {overflow > 0 && (
          <p className="muted" style={{ fontSize: "var(--text-xs)", marginTop: 8 }}>
            +{overflow} more not shown ·{" "}
            <Link href="/batches" className="row-anchor">see all batches</Link>
          </p>
        )}
      </div>
    </section>
  );
}
