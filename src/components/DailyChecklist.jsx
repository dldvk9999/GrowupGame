/**
 * 오늘의 할 일 체크리스트 - 재방문 유도를 위한 대표적인 패턴.
 * 이미 App.jsx가 들고 있는 상태들을 조합해서 보여줄 뿐, 별도 서버 호출 없음.
 */
export default function DailyChecklist({ attendanceClaimedToday, freeDrawUsed, missionCompleted, worldBossAttempted, onOpenAttendance, onOpenShop, onOpenWorldBoss }) {
  const items = [
    { key: 'attendance', label: '출석체크', done: attendanceClaimedToday === true, onClick: onOpenAttendance },
    { key: 'freedraw', label: '무료뽑기', done: freeDrawUsed === true, onClick: onOpenShop },
    { key: 'worldboss', label: '월드보스 도전', done: worldBossAttempted === true, onClick: onOpenWorldBoss },
    { key: 'mission', label: '가이드미션', done: missionCompleted === true, onClick: null },
  ];
  const doneCount = items.filter((i) => i.done).length;

  if (doneCount === items.length) return null; // 다 했으면 위젯 자체를 숨겨서 화면을 안 가림

  return (
    <div className="daily-checklist">
      <span className="daily-checklist-title">📋 오늘의 할 일 ({doneCount}/{items.length})</span>
      <div className="daily-checklist-items">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`daily-checklist-item ${item.done ? 'done' : ''}`}
            onClick={item.onClick ?? undefined}
            disabled={!item.onClick || item.done}
          >
            {item.done ? '✅' : '⬜'} {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
