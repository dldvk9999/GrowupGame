/**
 * 가이드미션을 "오늘 한 번이라도 완료했는지" - 페이지 새로고침에도 유지되도록
 * localStorage에 유저별/날짜별로 저장. 미션 자체는 계속 순환 배정되는 구조라
 * (완료→수령하면 서버가 곧바로 새 미션을 배정) "지금 배정된 미션이 완료 상태인지"만
 * 보면 새로고침 직후엔 늘 false로 보이는 문제가 있었음 - 이 모듈이 그 간극을 메움.
 */

const KEY_PREFIX = 'growupgame-mission-claimed-';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** 오늘 이미 가이드미션을 완료(수령)했는지 - 로그인 시점에 호출해서 초기값으로 씀 */
export function hasClaimedMissionTodayPersisted(userId) {
  if (!userId) return false;
  try {
    return localStorage.getItem(KEY_PREFIX + userId) === todayStr();
  } catch {
    return false;
  }
}

/** 미션 수령 성공 시 호출 - 오늘 날짜로 기록해서 새로고침해도 유지되게 함 */
export function markMissionClaimedToday(userId) {
  if (!userId) return;
  try {
    localStorage.setItem(KEY_PREFIX + userId, todayStr());
  } catch {
    // 저장 실패해도 이번 세션 표시엔 지장 없음(메모리 state는 정상 동작)
  }
}
