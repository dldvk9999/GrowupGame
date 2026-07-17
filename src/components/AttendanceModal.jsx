import { useState } from 'react';
import { claimAttendance } from '../lib/attendance';
import { showToast } from '../lib/toast';

const DAY_REWARDS = [500, 800, 1200, 1800, 2500, 3500, 8000];

/**
 * 7일 주기 출석체크 모달. 헤더의 "출석체크" 버튼에서 열림.
 * claimedToday=false && attendanceState가 있으면 다음 받을 날(cycle_day+1, 7 넘으면 1)이
 * 하이라이트되고, 이미 지난 날들은 체크 표시로 보여줌.
 */
export default function AttendanceModal({ attendanceState, onClose, onClaimed }) {
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  const currentCycleDay = attendanceState?.cycle_day ?? 0; // 마지막으로 받은 날 (0=아직 없음)
  const alreadyClaimedToday = attendanceState?._claimedToday ?? false;

  // 어제 받았는지 확인해서 스트릭이 이어질지 미리 예측(서버 claim_attendance와 동일한 판정 기준).
  // last_claim_date가 없으면(첫 방문) 스트릭 개념 자체가 없으므로 항상 이어지는 것으로 취급.
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const willContinueStreak = !attendanceState?.last_claim_date || attendanceState.last_claim_date === yesterday || alreadyClaimedToday;

  // 다음에 받을 날: 오늘 이미 받았으면 currentCycleDay 그대로 표시(완료 상태),
  // 스트릭이 끊길 예정이면 1일차로 리셋, 아니면 다음 날로 이어짐
  const nextDay = alreadyClaimedToday ? currentCycleDay : willContinueStreak ? (currentCycleDay % 7) + 1 : 1;
  // 화면상 체크 표시 기준일 - 스트릭이 끊길 예정이거나(리셋), 지난 사이클을 다 채우고 아직 오늘 안 받았으면(새 사이클 시작)
  // 0부터 다시 보여줌. 실제로는 서버가 claim 시점에만 cycle_day를 갱신하므로 그 전까지는 이전 값이 남아있어서
  // 그대로 쓰면 이미 끝난/끊긴 사이클의 완료 표시가 계속 남아있는 것처럼 보임
  const displayCycleDay = !alreadyClaimedToday && (!willContinueStreak || currentCycleDay === 7) ? 0 : currentCycleDay;

  async function handleClaim() {
    setError('');
    setClaiming(true);
    try {
      const result = await claimAttendance();
      const reward = result.reward_gold ?? DAY_REWARDS[(result.cycle_day ?? 1) - 1];
      showToast(
        result.streak_broken
          ? `연속 출석이 끊겨서 1일차부터 다시 시작해요. 💰 ${reward.toLocaleString()} 획득!`
          : `${result.cycle_day}일차 출석 완료! 💰 ${reward.toLocaleString()} 획득!`,
        'success'
      );
      onClaimed?.(result);
    } catch (err) {
      setError(err.message ?? '출석체크에 실패했어요.');
      showToast(err.message ?? '출석체크에 실패했어요.', 'error');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel attendance-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📅 출석체크</h3>
          <button className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <p className="stage-select-hint">
          매일 접속해서 골드를 받아가세요. 7일을 채우면 큰 보너스가 있어요.
          하루라도 거르면 1일차부터 다시 시작하니 매일 들러주세요!
        </p>

        <div className="attendance-grid">
          {DAY_REWARDS.map((reward, i) => {
            const day = i + 1;
            // cycle_day는 "마지막으로 받은 날"이므로 그 이하 날짜는 (오늘 받았든 이전에 받았든) 전부 이미 받은 상태
            const claimed = day <= displayCycleDay;
            const isNext = day === nextDay && !alreadyClaimedToday;
            const isBonus = day === 7;
            return (
              <div
                key={day}
                className={`attendance-day ${claimed ? 'claimed' : ''} ${isNext ? 'next' : ''} ${isBonus ? 'bonus' : ''}`}
              >
                <span className="attendance-day-label">{day}일차{isBonus && ' 🎁'}</span>
                <span className="attendance-day-reward">💰{reward.toLocaleString()}</span>
                {claimed && <span className="attendance-day-check">✓</span>}
              </div>
            );
          })}
        </div>

        {error && <p className="shop-error">{error}</p>}

        <button
          className={`btn btn-challenge attendance-claim-btn ${alreadyClaimedToday ? 'btn-unaffordable' : ''}`}
          disabled={claiming || alreadyClaimedToday}
          onClick={handleClaim}
        >
          {alreadyClaimedToday ? '오늘은 이미 받았어요' : claiming ? '받는 중...' : `${nextDay}일차 출석하기`}
        </button>
      </div>
    </div>
  );
}
