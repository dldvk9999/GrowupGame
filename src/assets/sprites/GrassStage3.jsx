export default function GrassStage3({ size = 90 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <defs>
        <radialGradient id="grass3Bg" cx="50%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#f2ffd9" />
          <stop offset="100%" stopColor="#2f5e1a" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="78" fill="url(#grass3Bg)" />
      <path d="M10 104 Q80 150 150 104 Q136 148 80 155 Q24 148 10 104 Z" fill="#1d3a0f" opacity="0.65" />
      <path d="M80 38 Q28 -20 -8 8 Q16 50 80 60 Z" fill="#4a9e2f" />
      <path d="M80 38 Q132 -20 168 8 Q144 50 80 60 Z" fill="#63b845" />
      <path d="M80 48 Q54 12 80 -14 Q106 12 80 48 Z" fill="#c8ffa0" />
      <ellipse cx="52" cy="94" rx="16" ry="20" fill="#152a09" />
      <ellipse cx="108" cy="94" rx="16" ry="20" fill="#152a09" />
      <circle cx="55" cy="87" r="5.5" fill="#f2ffd9" />
      <circle cx="111" cy="87" r="5.5" fill="#f2ffd9" />
      <circle cx="24" cy="116" r="9" fill="#1d3a0f" opacity="0.6" />
      <circle cx="136" cy="124" r="8" fill="#1d3a0f" opacity="0.6" />
      <circle cx="38" cy="140" r="6" fill="#1d3a0f" opacity="0.6" />
      <circle cx="118" cy="146" r="5" fill="#1d3a0f" opacity="0.6" />
      <path d="M50 134 Q80 156 110 134" fill="none" stroke="#12220a" strokeWidth="5" strokeLinecap="round" />
      <path d="M18 92 Q0 66 14 36 M142 92 Q160 66 146 36" fill="none" stroke="#63b845" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="80" cy="120" r="6" fill="#c8ffa0" opacity="0.85" />
    </svg>
  );
}
