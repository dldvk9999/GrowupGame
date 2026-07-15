export default function FireStage3({ size = 90 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <defs>
        <radialGradient id="fire3Bg" cx="50%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#ffd23f" />
          <stop offset="100%" stopColor="#c73d0d" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="78" fill="url(#fire3Bg)" />
      <path d="M10 104 Q80 150 150 104 Q136 148 80 155 Q24 148 10 104 Z" fill="#8a2708" opacity="0.65" />
      <path d="M18 70 Q-10 40 5 5 Q30 25 42 55 Q30 60 18 70 Z" fill="#ff5a1f" opacity="0.9" />
      <path d="M142 70 Q170 40 155 5 Q130 25 118 55 Q130 60 142 70 Z" fill="#ff5a1f" opacity="0.9" />
      <path d="M30 20 Q80 -25 130 20 Q120 52 96 58 Q80 36 64 58 Q40 52 30 20 Z" fill="#ff3a0a" />
      <path d="M56 6 Q80 -20 104 6 Q97 26 80 30 Q63 26 56 6 Z" fill="#ffe680" />
      <ellipse cx="52" cy="90" rx="16" ry="20" fill="#150c08" />
      <ellipse cx="108" cy="90" rx="16" ry="20" fill="#150c08" />
      <circle cx="55" cy="83" r="5.5" fill="#ffe680" />
      <circle cx="111" cy="83" r="5.5" fill="#ffe680" />
      <path d="M30 68 Q6 92 20 126 Q34 100 46 86 Z" fill="#8a2708" />
      <path d="M130 68 Q154 92 140 126 Q126 100 114 86 Z" fill="#8a2708" />
      <path d="M50 130 Q80 152 110 130" fill="none" stroke="#4a1503" strokeWidth="5" strokeLinecap="round" />
      <circle cx="80" cy="118" r="6" fill="#ffe680" opacity="0.85" />
    </svg>
  );
}
