export default function FireStage1({ size = 90 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <defs>
        <radialGradient id="fireBg" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffcf8a" />
          <stop offset="100%" stopColor="#ff7a30" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="78" fill="url(#fireBg)" />
      <path d="M18 100 Q80 140 142 100 Q132 140 80 148 Q28 140 18 100 Z" fill="#e04a12" opacity="0.55" />
      <path d="M38 28 Q80 -22 122 28 Q115 55 97 60 Q80 38 60 60 Q42 55 38 28 Z" fill="#ff4a12" />
      <path d="M60 15 Q80 -10 100 15 Q94 32 80 35 Q66 32 60 15 Z" fill="#ffd23f" />
      <path d="M38 65 Q23 85 33 110 Q43 92 51 82 Z" fill="#e04a12" />
      <path d="M122 65 Q137 85 127 110 Q117 92 109 82 Z" fill="#e04a12" />
      <ellipse cx="56" cy="88" rx="13" ry="17" fill="#241b16" />
      <ellipse cx="104" cy="88" rx="13" ry="17" fill="#241b16" />
      <circle cx="59" cy="82" r="4.5" fill="#fff" />
      <circle cx="107" cy="82" r="4.5" fill="#fff" />
      <path d="M56 122 Q80 140 104 122" fill="none" stroke="#7a2508" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
