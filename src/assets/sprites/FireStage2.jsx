export default function FireStage2({ size = 90 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <defs>
        <radialGradient id="fire2Bg" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffb35c" />
          <stop offset="100%" stopColor="#e04a12" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="78" fill="url(#fire2Bg)" />
      <path d="M14 102 Q80 145 146 102 Q134 145 80 152 Q26 145 14 102 Z" fill="#c73d0d" opacity="0.6" />
      {/* 등에 솟은 화염 갈기 */}
      <path d="M40 55 Q30 20 45 5 Q50 30 55 45 Z" fill="#ff4a12" />
      <path d="M80 45 Q75 8 90 -8 Q92 22 95 42 Z" fill="#ff6a1f" />
      <path d="M120 55 Q130 20 115 5 Q110 30 105 45 Z" fill="#ff4a12" />
      <path d="M34 26 Q80 -18 126 26 Q118 55 98 60 Q80 40 62 60 Q42 55 34 26 Z" fill="#ff3a0a" />
      <path d="M58 12 Q80 -14 102 12 Q95 30 80 33 Q65 30 58 12 Z" fill="#ffd23f" />
      <ellipse cx="52" cy="88" rx="15" ry="19" fill="#1b120d" />
      <ellipse cx="108" cy="88" rx="15" ry="19" fill="#1b120d" />
      <circle cx="55" cy="81" r="5" fill="#ffd23f" />
      <circle cx="111" cy="81" r="5" fill="#ffd23f" />
      <path d="M35 65 Q16 88 28 118 Q40 96 50 84 Z" fill="#c73d0d" />
      <path d="M125 65 Q144 88 132 118 Q120 96 110 84 Z" fill="#c73d0d" />
      <path d="M52 126 Q80 146 108 126" fill="none" stroke="#6e1e05" strokeWidth="5" strokeLinecap="round" />
      <path d="M40 100 L48 95 M120 100 L112 95" stroke="#ffd23f" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
