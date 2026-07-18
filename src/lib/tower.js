import { supabase } from './supabaseClient';

const ELEMENTS = ['fire', 'water', 'grass'];

/**
 * 층수 기반 몬스터 생성. 서버 calc_tower_gold의 HP 공식(220 + floor^1.8 * 200)과
 * 동일한 값을 그대로 몬스터 체력으로 사용해서, "얼마나 강한 몬스터를 잡았는지"와
 * "얼마나 많은 골드를 받는지"가 항상 일관되게 맞물리도록 함. 기존 10층 고정 던전보다
 * 지수를 더 가파르게(1.8) 잡아서 "무한히 어려워지는" 느낌을 살림.
 */
export function getTowerFloorMonster(floor) {
  const element = ELEMENTS[floor % ELEMENTS.length];
  const hp = Math.round(220 + Math.pow(floor, 1.8) * 200);
  const atk = Math.round(20 + Math.pow(floor, 1.7) * 14);
  const def = Math.round(15 + Math.pow(floor, 1.6) * 10);
  return {
    name: `탑 ${floor}층 수호자`,
    element,
    spriteKey: `${element}_1`,
    maxHp: hp,
    hp,
    atk,
    def,
    isBoss: true,
    dungeonType: 'tower',
    stage: floor,
    expReward: Math.round(hp * 1.5),
    goldReward: Math.round(hp * 1.1), // 클라이언트 추정치일 뿐, 실제 지급액은 서버(calc_tower_gold)가 결정
  };
}

/** 입장 (하루 3회 제한), 현재 최고층+1 도전권 발급 */
export async function enterTower() {
  const { data, error } = await supabase.rpc('enter_tower');
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { sessionId: row.session_id, floor: row.floor, remainingAttempts: row.remaining_attempts };
}

/** 클리어 보고 - 골드 지급 + 최고기록 갱신 (반환: 실제 지급 골드, 갱신된 최고층, 신기록 여부) */
export async function claimTowerFloor(sessionId) {
  const { data, error } = await supabase.rpc('claim_tower_floor', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { gold: row.gold, newHighestFloor: row.new_highest_floor, isNewRecord: row.is_new_record };
}

/** 내 최고 도달 층수 조회 */
export async function fetchMyTowerProgress(userId) {
  const { data, error } = await supabase
    .from('tower_progress')
    .select('highest_floor')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.highest_floor ?? 0;
}

/** 최고 도달 층수 랭킹 TOP20 */
export async function fetchTowerLeaderboard() {
  const { data, error } = await supabase.rpc('fetch_tower_leaderboard');
  if (error) throw error;
  return data ?? [];
}

/** 내 순위 (20위 밖일 때 표시용) */
export async function fetchMyTowerRank() {
  const { data, error } = await supabase.rpc('fetch_my_tower_rank');
  if (error) throw error;
  return data;
}
