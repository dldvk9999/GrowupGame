export default function GrassStage1({ size = 90 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <defs>
        <radialGradient id="grassBg" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#d4ffa0" />
          <stop offset="100%" stopColor="#5aa832" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="78" fill="url(#grassBg)" />
      <path d="M18 100 Q80 140 142 100 Q132 140 80 148 Q28 140 18 100 Z" fill="#3f7d24" opacity="0.55" />
      <path d="M80 28 Q45 -12 18 5 Q35 38 80 42 Z" fill="#4a9e2f" />
      <path d="M80 28 Q115 -12 142 5 Q125 38 80 42 Z" fill="#63b845" />
      <path d="M80 35 Q65 15 80 0 Q95 15 80 35 Z" fill="#8fd968" />
      <ellipse cx="58" cy="88" rx="13" ry="17" fill="#1f3a12" />
      <ellipse cx="106" cy="88" rx="13" ry="17" fill="#1f3a12" />
      <circle cx="61" cy="82" r="4.5" fill="#fff" />
      <circle cx="109" cy="82" r="4.5" fill="#fff" />
      <circle cx="40" cy="108" r="6" fill="#2f6e1e" opacity="0.5" />
      <circle cx="120" cy="115" r="5" fill="#2f6e1e" opacity="0.5" />
      <circle cx="50" cy="130" r="4" fill="#2f6e1e" opacity="0.5" />
      <path d="M58 122 Q80 133 102 122" fill="none" stroke="#245214" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
