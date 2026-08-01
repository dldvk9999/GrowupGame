import { supabase } from './supabaseClient';
import { eliteExpToNextLevel } from './growth';

/**
 * 정예의 시련 - 정예레벨 1부터 입장 가능한 신규 던전(사용자 요청).
 * 보상 고민 결과: 새 재화를 만들지 않고 "정예 경험치"를 보상으로 줌 - 레벨 500(만렙)
 * 상태에서는 applyExpGain이 얻는 경험치를 이미 자동으로 정예경험치로 돌려주고 있어서
 * (168), 이 던전은 그 흐름을 재사용하는 "정예레벨 전용 고효율 파밍터" 역할만 하면 됨
 * (새 경제 리스크 없음, 기존 클라이언트 신뢰 모델의 경험치 지급 방식 그대로 재사용).
 *
 * 난이도는 정예레벨에 비례해서 계속 올라감(streak-dungeon.md의 설계 철학과 동일 -
 * 더 위로 밀어붙일수록 위험도 보상도 커짐, 다만 여긴 위험-보상 뱅킹형이 아니라
 * 매번 그 시점의 정예레벨 기준으로 고정 난이도).
 */
export function getEliteTrialBoss(eliteLevel) {
  const lv = Math.max(1, eliteLevel);
  const maxHp = Math.round(3000 + Math.pow(lv, 1.6) * 400);
  const atk = Math.round(200 + Math.pow(lv, 1.4) * 25);
  const def = Math.round(150 + Math.pow(lv, 1.3) * 18);
  // 한 번 클리어로 "현재 정예레벨업까지 필요한 경험치"의 약 15%를 줌 - 3회/일 제한과
  // 맞물려 대략 2~3일에 한 정예레벨씩 오르는 속도(레벨이 오를수록 자연히 더뎌짐)
  const expReward = Math.round(eliteExpToNextLevel(lv) * 0.15);
  return {
    name: `정예 시련 · ${lv}단계`,
    icon: '💠',
    element: 'water', // 신비로운 시련의 공간 테마로 물 속성 고정(속성상성 계산용)
    maxHp, hp: maxHp, atk, def,
    expReward,
  };
}

export async function fetchEliteTrialAttemptsToday() {
  const { data, error } = await supabase.rpc('fetch_elite_trial_attempts_today');
  if (error) throw error;
  return data ?? 0;
}

export async function enterEliteTrial() {
  const { error } = await supabase.rpc('enter_elite_trial');
  if (error) throw new Error(error.message);
}
