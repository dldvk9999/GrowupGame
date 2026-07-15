import { supabase } from './supabaseClient';

/** 전직 던전 입장 - 레벨/이전단계 완료 여부를 서버가 검증, session_id 반환 */
export async function startJobDungeon(tier) {
  const { data, error } = await supabase.rpc('start_job_dungeon', { p_tier: tier });
  if (error) throw new Error(error.message);
  return data; // session_id
}

/** 전직 던전 클리어 - 실제 전직 적용(unlocked_job_tier 갱신) */
export async function claimJobDungeon(sessionId) {
  const { error } = await supabase.rpc('claim_job_dungeon', { p_session_id: sessionId });
  if (error) throw error;
}
