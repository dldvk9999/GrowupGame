export default function WaterStage2({ size = 90 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <defs>
        <radialGradient id="water2Bg" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#bff0ff" />
          <stop offset="100%" stopColor="#1c7fb0" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="78" fill="url(#water2Bg)" />
      <path d="M14 102 Q80 145 146 102 Q134 145 80 152 Q26 145 14 102 Z" fill="#155f83" opacity="0.6" />
      <path d="M24 45 Q45 5 40 65 Q30 65 24 45 Z" fill="#2f96cf" />
      <path d="M136 45 Q115 5 120 65 Q130 65 136 45 Z" fill="#2f96cf" />
      <path d="M34 42 Q80 10 126 42 Q122 78 80 84 Q38 78 34 42 Z" fill="#3aa8e0" />
      <path d="M60 20 Q80 0 100 20 Q94 36 80 39 Q66 36 60 20 Z" fill="#eafcff" />
      <ellipse cx="52" cy="90" rx="15" ry="19" fill="#0c2733" />
      <ellipse cx="108" cy="90" rx="15" ry="19" fill="#0c2733" />
      <circle cx="55" cy="83" r="5" fill="#eafcff" />
      <circle cx="111" cy="83" r="5" fill="#eafcff" />
      <path d="M28 108 Q6 128 18 156" fill="none" stroke="#bff0ff" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
      <path d="M132 108 Q154 128 142 156" fill="none" stroke="#bff0ff" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
      <path d="M52 126 Q80 142 108 126" fill="none" stroke="#0d4a68" strokeWidth="5" strokeLinecap="round" />
      <path d="M80 140 Q62 162 80 178 Q98 162 80 140 Z" fill="#2f96cf" />
    </svg>
  );
}
