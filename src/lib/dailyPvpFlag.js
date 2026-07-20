/**
 * "오늘 PvP를 한 번이라도 했는지" - 오늘의 할 일 체크리스트 표시 전용.
 * PvP는 하루 횟수 제한이 없어서(2초 쿨다운만 있음) 서버에 별도 "오늘 몇 번" 카운터가
 * 없음 - loginStreak.js와 동일하게 localStorage 날짜 추적으로 가볍게 처리(기기별,
 * 순수 표시용 - 실제 보상/제한 로직에는 전혀 관여 안 함).
 */

const PVP_PLAYED_KEY = 'growupgame-last-pvp-play-date';

/** 오늘 날짜로 "PvP 했음" 기록 */
export function markPvpPlayedToday() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    localStorage.setItem(PVP_PLAYED_KEY, today);
  } catch {
    // 저장 실패해도 체크리스트 표시만 못 할 뿐 치명적이지 않음
  }
}

/** 오늘 이미 PvP를 했는지 */
export function hasPlayedPvpToday() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    return localStorage.getItem(PVP_PLAYED_KEY) === today;
  } catch {
    return false;
  }
}
