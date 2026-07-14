import { supabase } from './supabaseClient';

/** 유저가 클리어한 모든 스테이지 id(순번) 집합 조회 */
export async function fetchClearedStageIds(userId) {
  const { data, error } = await supabase
    .from('stage_progress')
    .select('stage_id')
    .eq('user_id', userId)
    .eq('cleared', true);
  if (error) throw error;
  return new Set(data.map((r) => r.stage_id));
}

/** 스테이지 클리어 기록 - 서버(RPC)에서 "정말 열려있는 스테이지인지" 재검증됨 */
export async function markStageCleared(userId, stageId) {
  const { error } = await supabase.rpc('clear_stage', { p_stage_id: stageId });
  if (error) throw error;
}
