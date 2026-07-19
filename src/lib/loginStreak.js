/**
 * 연속 접속 스트릭 - localStorage로 "이 기기에서 며칠 연속 접속했는지"를 추적.
 * 순수 동기부여용 표시일 뿐, 어떤 보상 계산에도 쓰이지 않음(서버 검증 없음,
 * 기기를 바꾸거나 localStorage를 지우면 리셋됨 - 정확한 서버 기록이 아니라
 * "재미로 보는 스트릭"이라는 걸 UI에서도 명확히 함).
 */

const STREAK_KEY = 'growupgame-login-streak';

/** 로그인 시 호출 - 오늘 날짜 기준으로 스트릭을 갱신하고 현재 스트릭 일수를 반환 */
export function updateLoginStreak() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STREAK_KEY));
  } catch {
    saved = null;
  }

  if (saved?.lastDate === todayStr) {
    return saved.streak; // 오늘 이미 갱신함
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const newStreak = saved?.lastDate === yesterdayStr ? (saved.streak ?? 0) + 1 : 1;

  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify({ lastDate: todayStr, streak: newStreak }));
  } catch {
    // 저장 실패해도 이번 세션 표시엔 지장 없음
  }

  return newStreak;
}
