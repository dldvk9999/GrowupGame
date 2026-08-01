import { supabase } from './supabaseClient';

/**
 * 봉인된 던전 보스 스탯(레벨 스케일만) - 서버 calc_sealed_dungeon_boss와 동일 공식 유지할 것.
 * 루비 던전보다 약 1.4배 강하게 설계된 "실력 체크"용 보스 - 골드/경험치 없이 파편만 준다.
 */
export function getSealedDungeonBoss(level) {
  const lv = Math.max(1, level);
  const maxHp = Math.round(2000 + Math.pow(lv, 1.5) * 56);
  const atk = Math.round(110 + Math.pow(lv, 1.3) * 8.4);
  const def = Math.round(85 + Math.pow(lv, 1.2) * 5.6);
  return {
    name: '봉인의 파수꾼',
    icon: '🗝️',
    maxHp, hp: maxHp, atk, def,
  };
}

export async function fetchMySealStatus() {
  const { data, error } = await supabase.rpc('fetch_my_seal_status');
  if (error) throw error;
  const row = data?.[0];
  return { sealKeys: row?.seal_keys ?? 0, sealFragments: row?.seal_fragments ?? 0 };
}

export async function enterSealedDungeon() {
  const { data, error } = await supabase.rpc('enter_sealed_dungeon');
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { sessionId: row.session_id, sealKeysRemaining: row.seal_keys_remaining };
}

export async function claimSealedDungeonReward(sessionId) {
  const { data, error } = await supabase.rpc('claim_sealed_dungeon_reward', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { fragmentsEarned: row.fragments_earned, totalFragments: row.total_fragments };
}

export async function fetchSealLeaderboard() {
  const { data, error } = await supabase.rpc('fetch_seal_leaderboard');
  if (error) throw error;
  return data ?? [];
}

export async function fetchMySealRank() {
  const { data, error } = await supabase.rpc('fetch_my_seal_rank');
  if (error) throw error;
  return data;
}

/** 봉인의 상점 - 내가 보유한 봉인 코스튬 item_key 목록 */
export async function fetchMySealCostumes() {
  const { data, error } = await supabase.rpc('fetch_my_seal_costumes');
  if (error) throw error;
  return (data ?? []).map((row) => row.item_key);
}

/** 봉인의 상점 - 코스튬 구매(파편만 소비, 골드 무관) */
export async function buySealCostume(itemKey) {
  const { data, error } = await supabase.rpc('buy_seal_costume', { p_item_key: itemKey });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { remainingFragments: row.remaining_fragments };
}
