import { supabase } from './supabaseClient';

/** 이번 주 행운의 던전 타입('exp' | 'gold') - 클라이언트가 선택 화면에서 미리 안내하는 용도 */
export async function fetchLuckyDungeonType() {
  const { data, error } = await supabase.rpc('fetch_lucky_dungeon_type');
  if (error) throw error;
  return data;
}

/** 오늘(서울시간 오전 8시 기준) 던전 타입별 남은 입장 횟수 { exp: n, gold: n } */
export async function fetchDungeonAttemptsToday(userId) {
  const { data, error } = await supabase
    .from('dungeon_attempts')
    .select('dungeon_type, count, attempt_date')
    .eq('user_id', userId);
  if (error) throw error;

  // 서울시간(UTC+9)으로 맞춘 뒤 리셋 기준(오전 8시)만큼 앞당겨서 날짜만 취함
  // → 08:00~다음날 07:59는 같은 "던전 일자"로 취급됨 (서버 RPC와 동일 로직)
  const seoulOffsetMs = 9 * 60 * 60 * 1000;
  const resetOffsetMs = 8 * 60 * 60 * 1000;
  const periodDate = new Date(Date.now() + seoulOffsetMs - resetOffsetMs).toISOString().slice(0, 10);

  const used = { exp: 0, gold: 0 };
  for (const row of data) {
    if (row.attempt_date === periodDate) used[row.dungeon_type] = row.count;
  }
  return { exp: Math.max(0, 3 - used.exp), gold: Math.max(0, 3 - used.gold) };
}

/** 던전 타입별 현재 진행도(깬 층수) { exp: n, gold: n } */
export async function fetchDungeonProgress(userId) {
  const { data, error } = await supabase
    .from('dungeon_progress')
    .select('dungeon_type, cleared_stage')
    .eq('user_id', userId);
  if (error) throw error;
  const progress = { exp: 0, gold: 0 };
  for (const row of data) progress[row.dungeon_type] = row.cleared_stage;
  return progress;
}

/** 던전 입장 (하루 3회 제한, 서버에서 최종 검증) - 서버가 진행도 기준으로 층을 자동 결정함 */
export async function useDungeonAttempt(dungeonType) {
  const { data, error } = await supabase.rpc('use_dungeon_attempt', {
    p_dungeon_type: dungeonType,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { sessionId: row?.session_id, remaining: row?.remaining, stage: row?.stage };
}

/** 던전 승리 시 보상 수령 - 서버가 세션 검증 후 골드를 직접 계산해서 지급 (반환값 = 지급된 골드) */
export async function claimDungeonReward(sessionId) {
  const { data, error } = await supabase.rpc('claim_dungeon_reward', { p_session_id: sessionId });
  if (error) throw error;
  const row = data?.[0];
  return { gold: row.gold, isElite: row.is_elite, comboBonus: row.combo_bonus, isLuckyWeek: row.is_lucky_week };
}
