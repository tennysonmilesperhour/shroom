// Quantum Blue ambient background: a faint mycelial network of hyphae and nodes
// with bright sparks travelling the threads — the electric link between the
// psilocybin molecule and consciousness. Purely decorative, fixed behind content.

const HYPHAE = [
  "M -50 180 C 220 120, 360 300, 600 240 S 1000 120, 1240 260 S 1500 220, 1600 300",
  "M -40 520 C 240 460, 420 640, 700 560 S 1080 460, 1320 600 S 1520 560, 1600 620",
  "M -60 760 C 200 700, 480 860, 760 780 S 1120 700, 1360 820 S 1540 800, 1600 840",
  "M 120 -40 C 200 220, 80 420, 260 640 S 360 880, 300 980",
  "M 720 -40 C 760 240, 640 440, 820 660 S 900 900, 840 1000",
  "M 1180 -40 C 1240 220, 1120 460, 1300 660 S 1360 900, 1300 1000",
];

const NODES = [
  [600, 240], [700, 560], [760, 780], [260, 640], [820, 660], [1300, 660],
  [220, 120], [1080, 460], [1320, 600], [360, 300], [1000, 120], [480, 860],
];

export default function QuantumBackground() {
  return (
    <div className="qbg" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="mycoGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5b8cff" />
            <stop offset="50%" stopColor="#38e1ff" />
            <stop offset="100%" stopColor="#9b7bff" />
          </linearGradient>
          <radialGradient id="floor" cx="50%" cy="100%" r="80%">
            <stop offset="0%" stopColor="#0a2a24" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#04100e" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="500" width="1440" height="400" fill="url(#floor)" />

        {HYPHAE.map((d, i) => (
          <path key={i} d={d} className={`hypha ${i % 3 === 1 ? "b" : i % 3 === 2 ? "c" : ""}`} />
        ))}

        {NODES.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={2.5} className="node" style={{ animationDelay: `${(i % 6) * 0.7}s` }} />
        ))}

        {/* Travelling sparks bound to the first three hyphae. */}
        {[0, 1, 2].map((i) => (
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
