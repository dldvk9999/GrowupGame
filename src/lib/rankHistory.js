/**
 * 랭킹 변동 추적 - "저번에 봤을 때보다 몇 계단 올랐는지"를 localStorage로 추적하는
 * 순수 재미 요소. 순위 자체는 항상 서버가 계산한 최신 값을 그대로 쓰고, 이 모듈은
 * "이전에 로컬에 저장해둔 순위"와 비교만 함 - 실제 순위 판정 로직에는 전혀 관여 안 함.
 */

const KEY_PREFIX = 'growupgame-last-rank-';

/**
 * 새 순위를 기록하면서, 직전에 저장했던 순위 대비 변동을 반환.
 * @param {string} kind - 'power' | 'achievement' | 'tower' | 'pvp' | 'referral' | 'gold'
 * @param {number|null} newRank - 이번에 서버에서 받은 순위(1위=1). null이면 순위권 밖.
 * @returns {number|null} 이전 대비 상승폭(양수=상승, 음수=하락), 처음 보는 경우 null
 */
export function trackRankChange(kind, newRank) {
  if (newRank == null) return null;
  const storageKey = KEY_PREFIX + kind;
  let prevRank = null;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) prevRank = Number(saved);
  } catch {
    // localStorage 접근 실패해도 이번 세션 기능만 못 쓸 뿐 치명적이지 않음
  }

  try {
    localStorage.setItem(storageKey, String(newRank));
  } catch {
    // 저장 실패해도 무시
  }

  if (prevRank == null || Number.isNaN(prevRank)) return null;
  return prevRank - newRank; // 숫자가 작을수록 높은 순위이므로, prev - new > 0이면 상승
}
