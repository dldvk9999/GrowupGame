import { supabase } from './supabaseClient';

/** 오늘(서울시간 기준) 던전 타입별 남은 입장 횟수 { exp: n, gold: n } */
export async function fetchDungeonAttemptsToday(userId) {
  const { data, error } = await supabase
    .from('dungeon_attempts')
    .select('dungeon_type, count, attempt_date')
    .eq('user_id', userId);
  if (error) throw error;

  const todaySeoul = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    .toISOString()
    .slice(0, 10);

  const used = { exp: 0, gold: 0 };
  for (const row of data) {
    if (row.attempt_date === todaySeoul) used[row.dungeon_type] = row.count;
  }
  return { exp: Math.max(0, 3 - used.exp), gold: Math.max(0, 3 - used.gold) };
}

/** 던전 입장 (하루 3회 제한, 서버에서 최종 검증) - session_id를 받아서 승리 시 보상 수령에 씀 */
export async function useDungeonAttempt(dungeonType, stage) {
  const { data, error } = await supabase.rpc('use_dungeon_attempt', {
    p_dungeon_type: dungeonType,
    p_stage: stage,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { sessionId: row?.session_id, remaining: row?.remaining };
}

/** 던전 승리 시 보상 수령 - 서버가 세션 검증 후 골드를 직접 계산해서 지급 (반환값 = 지급된 골드) */
export async function claimDungeonReward(sessionId) {
  const { data, error } = await supabase.rpc('claim_dungeon_reward', { p_session_id: sessionId });
  if (error) throw error;
  return data;
}
