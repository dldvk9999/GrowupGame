/**
 * PvP 티어 - 순수 클라이언트 표시 콘텐츠. 이미 있는 profiles.pvp_wins 값을
 * 구간별로 나눠서 등급명/색상/아이콘을 부여할 뿐, 서버 데이터나 밸런스에는
 * 전혀 영향 없음(스탯 보너스 없는 명예 등급).
 */
const TIER_TABLE = [
  { min: 0, key: 'bronze', label: '브론즈', icon: '🥉', color: '#c17a4a' },
  { min: 10, key: 'silver', label: '실버', icon: '🥈', color: '#b0b8c9' },
  { min: 30, key: 'gold', label: '골드', icon: '🥇', color: '#f2b705' },
  { min: 60, key: 'platinum', label: '플래티넘', icon: '💎', color: '#4fd6d6' },
  { min: 100, key: 'diamond', label: '다이아몬드', icon: '👑', color: '#8a4fff' },
];

/** 승수 기준 현재 티어 정보 반환 */
export function getPvpTier(wins) {
  const w = wins ?? 0;
  let current = TIER_TABLE[0];
  for (const t of TIER_TABLE) {
    if (w >= t.min) current = t;
  }
  return current;
}

/** 다음 티어까지 남은 승수 (최고 티어면 null) */
export function getWinsToNextTier(wins) {
  const w = wins ?? 0;
  const next = TIER_TABLE.find((t) => t.min > w);
  return next ? next.min - w : null;
}
