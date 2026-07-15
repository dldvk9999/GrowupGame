export default function GrassStage2({ size = 90 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <defs>
        <radialGradient id="grass2Bg" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#e8ffb0" />
          <stop offset="100%" stopColor="#3f7d24" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="78" fill="url(#grass2Bg)" />
      <path d="M14 102 Q80 145 146 102 Q134 145 80 152 Q26 145 14 102 Z" fill="#2f5e1a" opacity="0.6" />
      <path d="M80 42 Q40 -10 8 12 Q28 48 80 55 Z" fill="#4a9e2f" />
      <path d="M80 42 Q120 -10 152 12 Q132 48 80 55 Z" fill="#63b845" />
      <path d="M80 50 Q60 20 80 -2 Q100 20 80 50 Z" fill="#a3e86f" />
      <ellipse cx="52" cy="92" rx="15" ry="19" fill="#233d10" />
      <ellipse cx="108" cy="92" rx="15" ry="19" fill="#233d10" />
      <circle cx="55" cy="85" r="5" fill="#eaffb0" />
      <circle cx="111" cy="85" r="5" fill="#eaffb0" />
      <circle cx="30" cy="112" r="8" fill="#2f6e1e" opacity="0.55" />
      <circle cx="130" cy="120" r="7" fill="#2f6e1e" opacity="0.55" />
      <circle cx="42" cy="135" r="5" fill="#2f6e1e" opacity="0.55" />
      <path d="M52 128 Q80 142 108 128" fill="none" stroke="#1d3a0f" strokeWidth="5" strokeLinecap="round" />
      <path d="M25 90 Q10 70 20 45 M135 90 Q150 70 140 45" fill="none" stroke="#4a9e2f" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
