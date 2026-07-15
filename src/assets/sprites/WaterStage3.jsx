export default function WaterStage3({ size = 90 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <defs>
        <radialGradient id="water3Bg" cx="50%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#eafcff" />
          <stop offset="100%" stopColor="#0d4a68" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="78" fill="url(#water3Bg)" />
      <path d="M10 104 Q80 150 150 104 Q136 148 80 155 Q24 148 10 104 Z" fill="#0a3752" opacity="0.65" />
      <path d="M16 66 Q-12 40 0 4 Q26 22 40 52 Q28 58 16 66 Z" fill="#3aa8e0" opacity="0.9" />
      <path d="M144 66 Q172 40 160 4 Q134 22 120 52 Q132 58 144 66 Z" fill="#3aa8e0" opacity="0.9" />
      <path d="M26 40 Q80 4 134 40 Q128 76 96 82 Q80 58 64 82 Q32 76 26 40 Z" fill="#2f96cf" />
      <path d="M56 12 Q80 -14 104 12 Q97 32 80 36 Q63 32 56 12 Z" fill="#ffffff" />
      <ellipse cx="52" cy="92" rx="16" ry="20" fill="#052232" />
      <ellipse cx="108" cy="92" rx="16" ry="20" fill="#052232" />
      <circle cx="55" cy="85" r="5.5" fill="#ffffff" />
      <circle cx="111" cy="85" r="5.5" fill="#ffffff" />
      <path d="M28 110 Q2 132 16 160" fill="none" stroke="#eafcff" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      <path d="M132 110 Q158 132 144 160" fill="none" stroke="#eafcff" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      <path d="M50 132 Q80 154 110 132" fill="none" stroke="#062f45" strokeWidth="5" strokeLinecap="round" />
      <circle cx="80" cy="120" r="6" fill="#eafcff" opacity="0.85" />
    </svg>
  );
}
