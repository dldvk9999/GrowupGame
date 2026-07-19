import { getWinsToNextTier } from './pvpTier';

const TOWER_MILESTONE_STEP = 10;
const ATTENDANCE_MILESTONES = [7, 30, 100, 200];

/**
 * 여러 시스템(PvP 티어/무한의 탑/출석)에 흩어진 "다음으로 가장 가까운 목표"를
 * 한 곳에 모아서 계산. 전부 순수 계산(이미 로드된 데이터 조합)이라 서버 호출 없음.
 * 반환: [{ icon, label, remaining, unit }] 형태 배열(달성할 목표가 없으면 빈 배열)
 */
export function getNextGoals({ pvpWins, towerHighestFloor, attendanceTotal }) {
  const goals = [];

  const winsToNextTier = getWinsToNextTier(pvpWins);
  if (winsToNextTier != null) {
    goals.push({ icon: '🥇', label: 'PvP 다음 티어', remaining: winsToNextTier, unit: '승' });
  }

  const floor = towerHighestFloor ?? 0;
  const nextTowerMilestone = Math.ceil((floor + 1) / TOWER_MILESTONE_STEP) * TOWER_MILESTONE_STEP;
  goals.push({ icon: '🗼', label: '무한의 탑 마일스톤', remaining: nextTowerMilestone - floor, unit: '층' });

  const total = attendanceTotal ?? 0;
  const nextAttendanceMilestone = ATTENDANCE_MILESTONES.find((m) => m > total);
  if (nextAttendanceMilestone) {
    goals.push({ icon: '📅', label: '출석 마일스톤', remaining: nextAttendanceMilestone - total, unit: '회' });
  }

  return goals;
}
