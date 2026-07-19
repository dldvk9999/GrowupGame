import { supabase } from './supabaseClient';

/** 전투력 상위 50명 랭킹 */
export async function fetchLeaderboard() {
  const { data, error } = await supabase.rpc('fetch_leaderboard');
  if (error) throw error;
  return data ?? [];
}

/** 내 순위 (50위 밖이어도 알 수 있음, 활성 몬스터 없으면 null) */
export async function fetchMyRank() {
  const { data, error } = await supabase.rpc('fetch_my_rank');
  if (error) throw error;
  return data;
}

/** 골드 재산 랭킹 TOP20 */
export async function fetchGoldLeaderboard() {
  const { data, error } = await supabase.rpc('fetch_gold_leaderboard');
  if (error) throw error;
  return data ?? [];
}

/** 내 골드 순위 (20위 밖일 때 표시용) */
export async function fetchMyGoldRank() {
  const { data, error } = await supabase.rpc('fetch_my_gold_rank');
  if (error) throw error;
  return data;
}
