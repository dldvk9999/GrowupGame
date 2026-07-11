export default function WaterStage1({ size = 90 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <defs>
        <radialGradient id="waterBg" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#a8ecff" />
          <stop offset="100%" stopColor="#2f96cf" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="78" fill="url(#waterBg)" />
      <path d="M18 100 Q80 140 142 100 Q132 140 80 148 Q28 140 18 100 Z" fill="#1c7fb0" opacity="0.55" />
      <path d="M28 38 Q46 3 40 60 Q31 60 28 38 Z" fill="#2f96cf" />
      <path d="M132 38 Q114 3 120 60 Q129 60 132 38 Z" fill="#2f96cf" />
      <path d="M40 40 Q80 15 120 40 Q118 72 80 78 Q42 72 40 40 Z" fill="#3aa8e0" />
      <ellipse cx="56" cy="88" rx="13" ry="17" fill="#12303f" />
      <ellipse cx="104" cy="88" rx="13" ry="17" fill="#12303f" />
      <circle cx="59" cy="82" r="4.5" fill="#fff" />
      <circle cx="107" cy="82" r="4.5" fill="#fff" />
      <path d="M35 108 Q20 122 28 142" fill="none" stroke="#a3e4ff" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      <path d="M125 108 Q140 122 132 142" fill="none" stroke="#a3e4ff" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      <path d="M56 122 Q80 135 104 122" fill="none" stroke="#0d4a68" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
