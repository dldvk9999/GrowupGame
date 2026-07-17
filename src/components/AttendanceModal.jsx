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
  // 다음에 받을 날: 오늘 이미 받았으면 currentCycleDay 그대로 표시(완료 상태), 아니면 다음 날
  const nextDay = alreadyClaimedToday ? currentCycleDay : (currentCycleDay % 7) + 1;

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
            const claimed = day <= currentCycleDay && (day < currentCycleDay || alreadyClaimedToday);
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
