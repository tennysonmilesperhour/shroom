// Quantum Blue mark
// A mushroom whose stem is a DNA double-helix rising from a mycelial base,
// with an indole-ring spark floating beside the cap — a compact glyph for the
// idea: fungi + biology + consciousness.

interface SporeMarkProps {
  size?: number;
  title?: string;
}

export default function SporeMark({ size = 28, title = "Quantum Blue" }: SporeMarkProps) {
  const w = size;
  const h = (size * 42) / 32;
  return (
    <svg
      className="spore"
      width={w}
      height={h}
      viewBox="0 0 32 42"
      fill="none"
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="qbMark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(82% 0.18 195)" />
          <stop offset="55%" stopColor="oklch(66% 0.18 268)" />
          <stop offset="100%" stopColor="oklch(60% 0.21 295)" />
        </linearGradient>
        <radialGradient id="qbCap" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="oklch(82% 0.18 195)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="oklch(60% 0.21 295)" stopOpacity="0.04" />
        </radialGradient>
        <filter id="qbGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
      </defs>

      {/* Cap — slightly asymmetric pebble silhouette */}
      <path
        d="M5 13.5 C5 6.8 9.8 2.6 16 2.6 S27 6.6 27 13.3 C24 16 19.5 16.6 16 16.6 S8.4 15.8 5 13.5 Z"
        fill="url(#qbCap)"
        stroke="url(#qbMark)"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* Gill curve */}
      <path
        d="M8.5 13.6 Q16 16.8 23.5 13.6"
        stroke="url(#qbMark)"
        strokeWidth="0.7"
        opacity="0.55"
        fill="none"
        strokeLinecap="round"
      />

      {/* DNA double-helix stem */}
      <g strokeLinecap="round" fill="none">
        <path
          d="M12.2 16.5 C20 19.5, 20 23, 12.2 26 S20 31.5, 12.2 34.5"
          stroke="url(#qbMark)"
          strokeWidth="1.25"
        />
        <path
          d="M19.8 16.5 C12 19.5, 12 23, 19.8 26 S12 31.5, 19.8 34.5"
          stroke="url(#qbMark)"
          strokeWidth="1.25"
        />
      </g>

      {/* Base-pair rungs (graduating opacity) */}
      <g stroke="url(#qbMark)" strokeWidth="0.8" strokeLinecap="round">
        <line x1="13.6" y1="18.4" x2="18.4" y2="18.4" opacity="0.85" />
        <line x1="13.6" y1="23"   x2="18.4" y2="23"   opacity="0.75" />
        <line x1="13.6" y1="27.6" x2="18.4" y2="27.6" opacity="0.65" />
        <line x1="13.6" y1="32"   x2="18.4" y2="32"   opacity="0.55" />
      </g>

      {/* Mycelial base */}
      <g stroke="url(#qbMark)" strokeWidth="0.85" opacity="0.55" fill="none" strokeLinecap="round">
        <path d="M16 35 C13 37, 9 37.6, 5.5 39" />
        <path d="M16 35 C16 37.4, 16 38, 16 39.5" />
        <path d="M16 35 C19 37, 23 37.6, 26.5 39" />
        <path d="M16 35 C14 36, 11 36.5, 9 37.6" opacity="0.4" />
        <path d="M16 35 C18 36, 21 36.5, 23 37.6" opacity="0.4" />
      </g>

      {/* Indole ring + spark — psilocybin signature */}
      <g>
        <path
          d="M22.6 6.8 l2.1 -1.2 2.1 1.2 0 2.4 -2.1 1.2 -2.1 -1.2 Z"
          stroke="url(#qbMark)"
          strokeWidth="0.85"
          strokeLinejoin="round"
          fill="none"
          opacity="0.9"
        />
        <circle cx="24.7" cy="5.6" r="2.1" fill="oklch(82% 0.18 195)" opacity="0.35" filter="url(#qbGlow)" />
        <circle cx="24.7" cy="5.6" r="1.1" fill="oklch(94% 0.05 195)" />
      </g>
    </svg>
  );
}
