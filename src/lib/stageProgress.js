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

/** 스테이지 클리어 기록 (이미 클리어했으면 그대로 유지) */
export async function markStageCleared(userId, stageId) {
  const { error } = await supabase
    .from('stage_progress')
    .upsert(
      { user_id: userId, stage_id: stageId, cleared: true, cleared_at: new Date().toISOString() },
      { onConflict: 'user_id,stage_id' }
    );
  if (error) throw error;
}
