import { expToNextLevel } from './growth';

const IDLE_KILL_INTERVAL_SECONDS = 1.5; // stages.js의 자동사냥 처치 텀과 동일

/** 자동사냥 몬스터 1마리당 경험치 - stages.js의 getIdleMonster와 동일 공식(순수 추정용, 경험치 절반감소 반영) */
function idleExpPerKill(chapter, playerLevel) {
  const hp = Math.max(10, Math.round(8 + chapter * 2.0 + playerLevel * 3.0));
  return Math.max(1, Math.round(hp * 0.19 * 0.5));
}

/**
 * 지금 자동사냥만 계속 켜뒀을 때 다음 레벨까지 대략 얼마나 걸리는지 추정.
 * 실제로는 스테이지 도전/던전 등도 병행하니 "최소 이 정도"에 가까운 하한 추정치.
 * 반환: 초 단위(정수) 또는 계산 불가 시 null
 */
export function estimateSecondsToNextLevel({ level, exp, chapter }) {
  if (!level || chapter == null) return null;
  const remainingExp = expToNextLevel(level) - (exp ?? 0);
  if (remainingExp <= 0) return 0;

  const expPerKill = idleExpPerKill(chapter, level);
  if (expPerKill <= 0) return null;

  const killsNeeded = Math.ceil(remainingExp / expPerKill);
  return Math.round(killsNeeded * IDLE_KILL_INTERVAL_SECONDS);
}

/** 초를 "N시간 M분" 같은 읽기 쉬운 문자열로 */
export function formatDuration(totalSeconds) {
  if (totalSeconds == null) return null;
  if (totalSeconds <= 0) return '곧';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.ceil((totalSeconds % 3600) / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}일 이상`;
  if (hours > 0) return `약 ${hours}시간 ${minutes}분`;
  return `약 ${minutes}분`;
}
