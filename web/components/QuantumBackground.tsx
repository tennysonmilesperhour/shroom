"use client";

import { useEffect, useRef } from "react";

// Quantum Blue ambient background.
//
// Three layered fields, slow and breathing:
//   1. faint hex/molecular lattice — the "consciousness link" hint
//   2. mycelial hyphae — long organic arcs forming the network
//   3. bioluminescent particles — soft drifting nodes + travelling sparks
//
// Mask fades from radial center so the network never crowds content edges.
// Compositor-friendly (opacity / transform / offset-distance only).
// Respects prefers-reduced-motion via CSS, and pauses all animation while
// the tab is hidden so we don't spin the GPU for nothing.

const HYPHAE = [
  "M -80 220 C 180 140, 360 320, 620 240 S 1020 120, 1280 270 S 1520 230, 1640 320",
  "M -60 540 C 220 470, 440 650, 720 560 S 1100 470, 1340 600 S 1540 560, 1640 620",
  "M -80 780 C 200 720, 480 880, 760 800 S 1140 720, 1380 840 S 1560 820, 1640 860",
  "M 140 -50 C 220 230, 100 430, 280 650 S 380 880, 320 1000",
  "M 740 -50 C 780 250, 660 450, 840 670 S 920 900, 860 1010",
  "M 1200 -50 C 1260 230, 1140 470, 1320 670 S 1380 900, 1320 1010",
  "M -40 360 C 220 320, 500 420, 780 380 S 1180 320, 1480 400",
  "M -40 660 C 260 620, 540 720, 820 680 S 1220 620, 1480 700",
];

const NODES: ReadonlyArray<readonly [number, number, number]> = [
  [620, 240, 1], [720, 560, 1.1], [760, 800, 0.9], [280, 650, 1.2], [840, 670, 1],
  [1320, 670, 0.9], [220, 140, 0.8], [1100, 470, 1.1], [1340, 600, 1], [360, 320, 0.85],
  [1020, 120, 1.15], [480, 880, 0.9], [780, 380, 0.7], [540, 720, 0.7], [1180, 320, 0.7],
];

const LATTICE_PATH =
  "M 100 100 L 180 60 L 260 100 L 260 180 L 180 220 L 100 180 Z " +
  "M 260 100 L 340 60 L 420 100 L 420 180 L 340 220 L 260 180 " +
  "M 420 100 L 500 60 L 580 100 L 580 180 L 500 220 L 420 180 " +
  "M 580 100 L 660 60 L 740 100 L 740 180 L 660 220 L 580 180 ";

// Three sparks — one per `.trav` class variant. Originally 4; trimmed to 3
// because each extra spark adds a compositor layer with measurable GPU cost
// on lower-end devices for a delta most users won't notice.
const SPARK_INDICES = [0, 1, 2] as const;

export default function QuantumBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function onVisibilityChange() {
      container?.classList.toggle("paused", document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <div ref={containerRef} className="qbg" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="mycoGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(66% 0.18 268)" />
            <stop offset="45%" stopColor="oklch(82% 0.18 195)" />
            <stop offset="100%" stopColor="oklch(60% 0.21 295)" />
          </linearGradient>
          <radialGradient id="floor" cx="50%" cy="100%" r="70%">
            <stop offset="0%" stopColor="oklch(22% 0.06 230)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="oklch(11% 0.03 245)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="canopy" cx="20%" cy="0%" r="70%">
            <stop offset="0%" stopColor="oklch(60% 0.21 295)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="oklch(60% 0.21 295)" stopOpacity="0" />
          </radialGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>

        <rect x="0" y="0" width="1440" height="900" fill="url(#canopy)" />
        <rect x="0" y="520" width="1440" height="380" fill="url(#floor)" />

        <g className="lattice" opacity="0.5">
          <path d={LATTICE_PATH} />
          <g transform="translate(680 460)">
            <path d={LATTICE_PATH} />
          </g>
        </g>

        <g filter="url(#soft)">
          {HYPHAE.map((d, i) => (
            <path
              key={i}
              d={d}
              className={`hypha ${i % 3 === 1 ? "b" : i % 3 === 2 ? "c" : ""}`}
            />
          ))}
        </g>

        {NODES.map(([cx, cy, s], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={2.4 * s}
            className="node"
            style={{ animationDelay: `${(i % 7) * 0.85}s` }}
          />
        ))}

        {SPARK_INDICES.map((i) => (
          <circle
            key={`s${i}`}
            r={2.6}
            className={`spark trav ${i === 1 ? "b" : i === 2 ? "c" : ""}`}
            style={{ offsetPath: `path('${HYPHAE[i]}')` } as React.CSSProperties}
          />
        ))}
      </svg>
    </div>
  );
}
