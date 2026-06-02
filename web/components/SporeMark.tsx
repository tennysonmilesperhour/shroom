// Quantum Blue mark (placeholder, hand-built SVG echoing the chosen Canva logo):
// a mushroom whose stem is a DNA double-helix rising from a mycelial base, with
// an indole (psilocybin) ring and an electric spark node. Scales crisply on dark.
export default function SporeMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="spore" width={size} height={(size * 40) / 32} viewBox="0 0 32 40" fill="none">
      <defs>
        <linearGradient id="qbMark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38e1ff" />
          <stop offset="55%" stopColor="#5b8cff" />
          <stop offset="100%" stopColor="#9b7bff" />
        </linearGradient>
      </defs>

      {/* cap */}
      <path d="M5 13 C5 6.5 10 2.5 16 2.5 S27 6.5 27 13 Q16 17 5 13 Z"
        stroke="url(#qbMark)" strokeWidth="1.5" fill="rgba(56,225,255,0.08)" strokeLinejoin="round" />
      {/* gills */}
      <path d="M9 13.6 Q16 16 23 13.6" stroke="url(#qbMark)" strokeWidth="0.8" opacity="0.5" fill="none" />

      {/* DNA double-helix stem */}
      <path d="M12.5 16 C20 19, 20 23, 12.5 26 S20 31, 12.5 34" stroke="url(#qbMark)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M19.5 16 C12 19, 12 23, 19.5 26 S12 31, 19.5 34" stroke="url(#qbMark)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* base-pair rungs */}
      <g stroke="url(#qbMark)" strokeWidth="0.9" opacity="0.8">
        <line x1="14" y1="18.4" x2="18" y2="18.4" />
        <line x1="14" y1="23" x2="18" y2="23" />
        <line x1="14" y1="27.6" x2="18" y2="27.6" />
        <line x1="14" y1="32" x2="18" y2="32" />
      </g>

      {/* mycelial base */}
      <g stroke="url(#qbMark)" strokeWidth="0.9" opacity="0.55" fill="none" strokeLinecap="round">
        <path d="M16 34 C13 36, 9 36.5, 6 38" />
        <path d="M16 34 C16 36.5, 16 37, 16 38.5" />
        <path d="M16 34 C19 36, 23 36.5, 26 38" />
      </g>

      {/* indole ring + spark */}
      <path d="M22 7 l2.4 -1.3 2.4 1.3 0 2.6 -2.4 1.3 -2.4 -1.3 Z" stroke="url(#qbMark)" strokeWidth="0.9" fill="none" opacity="0.85" />
      <circle cx="24.4" cy="6" r="1.5" fill="#bff3ff" />
    </svg>
  );
}
