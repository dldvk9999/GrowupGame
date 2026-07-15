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

/** 스테이지 클리어 기록 - 서버가 열림여부 재검증 + 골드도 직접 계산해서 지급 (반환값 = 지급된 골드) */
export async function markStageCleared(userId, stageId) {
  const { data, error } = await supabase.rpc('clear_stage', { p_stage_id: stageId });
  if (error) throw error;
  return data; // 지급된 골드
}
