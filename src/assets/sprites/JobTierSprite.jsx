const ELEMENT_HUES = {
  fire: { core: '#ffd23f', mid: '#ff5a1f', dark: '#8a2708', body: '#ff3a0a' },
  water: { core: '#eafcff', mid: '#3aa8e0', dark: '#0a3752', body: '#2f96cf' },
  grass: { core: '#f2ffd9', mid: '#63b845', dark: '#1d3a0f', body: '#4a9e2f' },
};

/** 전직 단계(1~4)가 오를수록 오라 크기/날개/왕관이 더 화려해짐 */
export default function JobTierSprite({ element, tier, size = 90 }) {
  const c = ELEMENT_HUES[element] ?? ELEMENT_HUES.fire;
  const gradId = `jobtier-${element}-${tier}`;
  const auraRadius = 66 + tier * 8;

  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <defs>
        <radialGradient id={gradId} cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor={c.core} />
          <stop offset="100%" stopColor={c.dark} />
        </radialGradient>
      </defs>

      <circle cx="80" cy="80" r="78" fill={`url(#${gradId})`} />

      <circle cx="80" cy="80" r={auraRadius} fill="none" stroke={c.core} strokeWidth={2 + tier} opacity={0.25 + tier * 0.12} />
      {tier >= 3 && <circle cx="80" cy="80" r={auraRadius + 10} fill="none" stroke={c.core} strokeWidth="1.5" opacity="0.3" />}

      {tier >= 2 && (
        <>
          <path d="M14 70 Q-16 40 0 2 Q28 24 42 56 Q28 62 14 70 Z" fill={c.mid} opacity="0.9" />
          <path d="M146 70 Q176 40 160 2 Q132 24 118 56 Q132 62 146 70 Z" fill={c.mid} opacity="0.9" />
        </>
      )}

      <path d="M10 104 Q80 150 150 104 Q136 148 80 155 Q24 148 10 104 Z" fill={c.dark} opacity="0.6" />
      <path d="M28 40 Q80 4 132 40 Q126 76 96 82 Q80 58 64 82 Q34 76 28 40 Z" fill={c.body} />

      {tier === 1 && (
        <path d="M62 14 Q80 -10 98 14 Q92 30 80 33 Q68 30 62 14 Z" fill={c.core} />
      )}
      {tier === 2 && (
        <>
          <path d="M50 20 Q70 -14 86 16 Q78 32 66 34 Z" fill={c.core} />
          <path d="M110 20 Q90 -14 74 16 Q82 32 94 34 Z" fill={c.core} />
        </>
      )}
      {tier >= 3 && (
        <>
          <path d="M40 24 Q80 -26 120 24 Q112 44 96 46 Q80 26 64 46 Q48 44 40 24 Z" fill={c.core} />
          <circle cx="80" cy="18" r="6" fill="#fff" opacity="0.9" />
        </>
      )}

      <ellipse cx="54" cy="92" rx="15.5" ry="19.5" fill="#150c08" />
      <ellipse cx="106" cy="92" rx="15.5" ry="19.5" fill="#150c08" />
      <circle cx="57" cy="85" r="5.5" fill={c.core} />
      <circle cx="109" cy="85" r="5.5" fill={c.core} />

      <path d="M50 130 Q80 152 110 130" fill="none" stroke={c.dark} strokeWidth="5" strokeLinecap="round" />
      {tier >= 3 && <circle cx="80" cy="118" r="6" fill={c.core} opacity="0.85" />}
    </svg>
  );
}
