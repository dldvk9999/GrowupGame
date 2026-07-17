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
