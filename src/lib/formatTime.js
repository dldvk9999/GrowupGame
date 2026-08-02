// 리팩토링(사용자 요청 - 재사용 가능한 유틸 분리): 원래 DungeonSelect.jsx 안에만
// 있던 순수 포맷 함수. 남은 시간을 "N시간 M분" / "M분 S초" / "S초"로 표시.
export function formatRemaining(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}
