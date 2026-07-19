import { getWinsToNextTier } from './pvpTier';

const TOWER_MILESTONE_STEP = 10;
const ATTENDANCE_MILESTONES = [7, 30, 100, 200];
const POWER_MILESTONES = [10000, 100000, 1000000];
const DUNGEON_DEPTH_MILESTONES = [100, 300, 500];

/**
 * 여러 시스템(PvP 티어/무한의 탑/출석/코스튬/전투력/던전깊이)에 흩어진 "다음으로
 * 가장 가까운 목표"를 한 곳에 모아서 계산. 전부 순수 계산(이미 로드된 데이터 조합)이라
 * 서버 호출 없음.
 * 반환: [{ icon, label, remaining, unit }] 형태 배열(달성할 목표가 없으면 빈 배열)
 */
export function getNextGoals({ pvpWins, towerHighestFloor, attendanceTotal, costumeCount, combatPower, dungeonDepth }) {
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

  const costumes = costumeCount ?? 0;
  if (costumes < 20) {
    goals.push({ icon: '🎽', label: '코스튬 컬렉션', remaining: 20 - costumes, unit: '종' });
  }

  const power = combatPower ?? 0;
  const nextPowerMilestone = POWER_MILESTONES.find((m) => m > power);
  if (nextPowerMilestone) {
    goals.push({ icon: '💪', label: '전투력 마일스톤', remaining: nextPowerMilestone - power, unit: '' });
  }

  const depth = dungeonDepth ?? 0;
  const nextDepthMilestone = DUNGEON_DEPTH_MILESTONES.find((m) => m > depth);
  if (nextDepthMilestone) {
    goals.push({ icon: '🏰', label: '던전 깊이 마일스톤', remaining: nextDepthMilestone - depth, unit: '층' });
  }

  return goals;
}
