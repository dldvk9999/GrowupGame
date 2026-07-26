/**
 * 전투 제한시간을 눈으로 보이는 게이지로 표시(신규, 사용자 요청) - 시간이 지날수록
 * 점점 줄어드는 바. 남은 비율이 30% 미만이면 빨갛게 경고색으로 바뀜.
 * remainingMs/totalMs를 props로 받아서 순수 표시만 담당(카운트다운 로직은 각 전투
 * 컴포넌트가 직접 관리 - 화면마다 "시간 초과 시 처리"가 조금씩 달라서 분리함).
 */
export default function TimeLimitBar({ remainingMs, totalMs }) {
  const pct = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const isWarning = pct < 30;
  return (
    <div className="time-limit-bar-wrap">
      <div className="time-limit-bar-label">
        ⏱️ 제한시간 {seconds}초
      </div>
      <div className="bar-track time-limit-track">
        <div
          className={`bar-fill time-limit-fill ${isWarning ? 'time-limit-fill--warning' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
