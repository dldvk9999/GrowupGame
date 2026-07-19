/**
 * 테마 컬러 프리셋 - 순수 클라이언트 취향 설정(localStorage), 서버 관여 없음.
 * 각 테마는 --accent-fire/--accent-gold를 오버라이드해서 버튼/그라데이션 색감을 바꿈.
 * unlock이 없는 테마는 누구나 바로 쓸 수 있음. unlock이 있으면 해당 조건을 만족해야
 * 선택 가능(판정은 순수 클라이언트에서 이미 가진 데이터로만 함 - 서버 검증 없는
 * 명예/장식 조건이라 크게 문제되지 않음, 스탯에 영향 없는 순수 꾸미기 요소이기 때문).
 */
export const THEMES = {
  sunset: { label: '🔥 선셋 (기본)', fire: '#ff5a1f', gold: '#f2b705' },
  ocean: { label: '🌊 오션', fire: '#1f9dff', gold: '#4fd6d6' },
  forest: { label: '🌿 포레스트', fire: '#2fa84f', gold: '#c7e05a' },
  candy: { label: '🍬 캔디', fire: '#ff5aa8', gold: '#ffb84f' },
  royal: { label: '👑 로얄', fire: '#8a4fff', gold: '#f2b705' },
  founder: { label: '🌟 얼리버드', fire: '#f2b705', gold: '#fff6d6', unlock: { type: 'achievement', key: 'founder', label: '"얼리버드" 업적 달성' } },
  diamond: { label: '💎 다이아몬드', fire: '#4fd6d6', gold: '#8a4fff', unlock: { type: 'pvpTier', tier: 'diamond', label: 'PvP 다이아몬드 티어 도달' } },
};

const THEME_KEY = 'growupgame-theme';

export function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) ?? 'sunset';
  } catch {
    return 'sunset';
  }
}

/** 선택한 테마를 저장하고, 즉시 CSS 변수에 반영 */
export function applyTheme(themeKey) {
  const theme = THEMES[themeKey] ?? THEMES.sunset;
  document.documentElement.style.setProperty('--accent-fire', theme.fire);
  document.documentElement.style.setProperty('--accent-gold', theme.gold);
  try {
    localStorage.setItem(THEME_KEY, themeKey);
  } catch {
    // localStorage 없는 환경이면 조용히 무시(이번 세션에서만 적용됨)
  }
}
