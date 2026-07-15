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

/** 던전 입장 (하루 3회 제한, 서버에서 최종 검증) */
export async function useDungeonAttempt(dungeonType) {
  const { data, error } = await supabase.rpc('use_dungeon_attempt', { p_dungeon_type: dungeonType });
  if (error) throw new Error(error.message);
  return data; // 남은 횟수
}
