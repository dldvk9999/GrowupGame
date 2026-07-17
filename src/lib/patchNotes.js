/**
 * 패치노트 (정적 데이터). 새 기능/변경사항이 생길 때마다 배열 맨 앞에 추가.
 * 서버 데이터 아님 - 순수 클라이언트 콘텐츠라 마이그레이션 없이 자유롭게 수정 가능.
 */
export const PATCH_NOTES = [
  {
    date: '2026-07-17',
    title: '출석체크 · 업적 · 랭킹 · 무료뽑기 · 칭호 업데이트',
    items: [
      '📅 7일 주기 출석체크 추가 (헤더 버튼)',
      '🏆 업적 시스템 추가 (레벨/전직/스테이지/뽑기/PvP/월드보스/출석, 22종)',
      '📖 마이페이지에 몬스터 도감 추가',
      '🥇 로비에 전투력 랭킹(명예의 전당) 추가 — 장착 장비 보너스까지 반영',
      '🎁 상점에 하루 1회 무료뽑기 추가',
      '🎖️ 업적 연계 칭호 시스템 추가',
      '🎉 신규 유저 환영 패키지(우편으로 자동 지급)',
      '🐉 월드보스 화면에 이번 주 기여자 TOP10 추가',
      '🎟️ 이벤트 쿠폰 UPDATE2026 발행',
      '⚔️ PvP 최근 전적 목록 추가',
      '✨ 뽑기 중복 강화 시 10% 확률 럭키 보너스(강화량 2배)',
      '👥 로비에 실시간 접속자 수 표시',
      '📊 인벤토리에 강화 진행률 바 추가',
      '🎰 스킬/장비 뽑기레벨 상한 20 → 50 확장',
      '🐛 PvP/랭킹 전투력 계산에 장비 보너스 누락 수정',
    ],
  },
];

const SEEN_KEY = 'growupgame-patchnotes-seen-date';

/** 가장 최근 패치노트를 이미 확인했는지(localStorage 기준, 계정과 무관하게 이 브라우저 기준) */
export function hasSeenLatestPatchNote() {
  try {
    return localStorage.getItem(SEEN_KEY) === PATCH_NOTES[0]?.date;
  } catch {
    return true; // localStorage 접근 실패 시 뱃지를 계속 띄우지 않도록 안전하게 "봤음" 처리
  }
}

/** 패치노트 화면을 열었을 때 호출 - 최신 날짜를 확인한 것으로 기록 */
export function markLatestPatchNoteSeen() {
  try {
    localStorage.setItem(SEEN_KEY, PATCH_NOTES[0]?.date ?? '');
  } catch {
    // localStorage 없는 환경(시크릿모드 등)이면 조용히 무시
  }
}
