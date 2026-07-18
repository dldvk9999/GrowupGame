/**
 * 테마 컬러 프리셋 - 순수 클라이언트 취향 설정(localStorage), 서버 관여 없음.
 * 각 테마는 --accent-fire/--accent-gold를 오버라이드해서 버튼/그라데이션 색감을 바꿈.
 */
export const THEMES = {
  sunset: { label: '🔥 선셋 (기본)', fire: '#ff5a1f', gold: '#f2b705' },
  ocean: { label: '🌊 오션', fire: '#1f9dff', gold: '#4fd6d6' },
  forest: { label: '🌿 포레스트', fire: '#2fa84f', gold: '#c7e05a' },
  candy: { label: '🍬 캔디', fire: '#ff5aa8', gold: '#ffb84f' },
  royal: { label: '👑 로얄', fire: '#8a4fff', gold: '#f2b705' },
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
