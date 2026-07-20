/**
 * 주말(토·일, 한국시간 기준) 자동사냥 골드 1.5배 이벤트 안내.
 * 실제 배율 적용은 서버(grant_idle_reward, 105)가 하고, 여기는 로그인 시
 * 하루 1번(localStorage로 날짜 추적, dailyQuote.js와 동일 패턴) 안내 토스트만 담당함.
 */

const WEEKEND_TOAST_KEY = 'growupgame-last-weekend-toast-date';

function getKstDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

/** 지금이 한국시간 기준 주말(토=6, 일=0)인지 */
export function isWeekendGoldBonusActive() {
  const day = getKstDate().getDay();
  return day === 0 || day === 6;
}

/** 오늘(KST) 아직 안 보여줬고 주말이면 true, 아니면 false */
export function shouldShowWeekendBonusToast() {
  if (!isWeekendGoldBonusActive()) return false;
  const todayKst = getKstDate().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(WEEKEND_TOAST_KEY) === todayKst) return false;
    localStorage.setItem(WEEKEND_TOAST_KEY, todayKst);
  } catch {
    // localStorage 없으면 매번 보여줌(치명적이지 않음)
  }
  return true;
}
