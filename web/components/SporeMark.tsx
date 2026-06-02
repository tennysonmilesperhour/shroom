// Quantum Blue mark: a mushroom cap fused with the psilocybin molecule's
// indole ring and an electric spark node.
export default function SporeMark({ size = 26 }: { size?: number }) {
  return (
    <svg className="spore" width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="qbMark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38e1ff" />
          <stop offset="55%" stopColor="#5b8cff" />
          <stop offset="100%" stopColor="#9b7bff" />
        </linearGradient>
      </defs>
      {/* cap */}
      <path d="M4 15 C4 8.4 9.4 3.5 16 3.5 S28 8.4 28 15 Z" stroke="url(#qbMark)" strokeWidth="1.6" fill="rgba(56,225,255,0.07)" />
      {/* stem */}
      <path d="M13 15 L13 26 Q16 28 19 26 L19 15" stroke="url(#qbMark)" strokeWidth="1.6" fill="none" />
      {/* indole ring hint */}
      <path d="M9 10 l3 -1.6 3 1.6 0 3 -3 1.6 -3 -1.6 Z" stroke="url(#qbMark)" strokeWidth="1.1" fill="none" opacity="0.85" />
      {/* spark node */}
      <circle cx="21" cy="10" r="1.8" fill="#bff3ff" />
    </svg>
  );
}
