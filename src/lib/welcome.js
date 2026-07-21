// 최초 로그인 시 환영 팝업(신규, 사용자 요청) - 브라우저(localStorage) 기준으로 딱 한 번만 노출.
// 계정 단위가 아니라 기기/브라우저 단위 추적이라, 다른 기기로 로그인하면 다시 한 번 뜰 수
// 있음(패치노트 "새 글 확인" 플래그와 동일한 성격 - 서버 동기화 없는 순수 UX 편의 기능).

const STORAGE_KEY = 'growupgame-welcome-seen';

export function hasSeenWelcome() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return true; // localStorage 접근 불가 환경이면 매번 뜨는 것보단 안 뜨는 쪽이 안전
  }
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // no-op
  }
}
