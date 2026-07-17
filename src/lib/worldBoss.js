import { supabase } from './supabaseClient';

/** 이번 주 월드보스 상태 동기화(없으면 생성 + 지난주 미클리어 보상 정산) 후 조회 */
export async function fetchWorldBoss() {
  const syncRes = await supabase.rpc('sync_world_boss');
  if (syncRes.error) throw syncRes.error;

  const { data, error } = await supabase.rpc('get_world_boss_state');
  if (error) throw error;
  const row = data;
  if (!row) return null;
  return {
    weekKey: row.week_key,
    maxHp: Number(row.max_hp),
    currentHp: Number(row.current_hp),
    atk: row.atk,
    def: row.def,
    cleared: row.cleared,
  };
}

/**
 * 이번 주 월드보스 기여도 TOP 10 (닉네임 + 누적 피해량).
 * world_boss_contributions/profiles 둘 다 "누구나 조회 가능" RLS라 RPC 없이 직접 조회 가능하고,
 * user_id -> profiles(id) FK 관계를 PostgREST가 자동으로 조인해줌.
 */
export async function fetchWorldBossTopContributors(weekKey) {
  if (!weekKey) return [];
  const { data, error } = await supabase
    .from('world_boss_contributions')
    .select('total_damage, profiles(nickname)')
    .eq('week_key', weekKey)
    .order('total_damage', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    nickname: row.profiles?.nickname ?? '알 수 없음',
    damage: Number(row.total_damage),
  }));
}

/** 내 오늘 도전 횟수 / 이번 주 누적 데미지 */
export async function fetchMyWorldBossProgress() {
  const { data, error } = await supabase.rpc('fetch_my_world_boss_progress');
  if (error) throw error;
  const row = data?.[0];
  return { attemptsUsed: row?.attempts_used ?? 0, myWeekDamage: Number(row?.my_week_damage ?? 0) };
}

/**
 * 역대 월드보스 참여 여부(어떤 주든 피해를 입힌 적이 있는지) - 업적 진행도 표시용.
 * world_boss_contributions RLS가 "누구나 조회 가능"이라 RPC 없이 직접 조회 가능.
 * (fetchMyWorldBossProgress의 myWeekDamage는 "이번 주"만 보여줘서, 과거에 참여했지만
 * 이번 주는 아직 안 한 유저의 업적 진행도가 0으로 잘못 보이는 문제가 있어 별도로 뺌)
 */
export async function hasEverParticipatedInWorldBoss(userId) {
  if (!userId) return false;
  const { data, error } = await supabase
    .from('world_boss_contributions')
    .select('user_id')
    .eq('user_id', userId)
    .gt('total_damage', 0)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}
export async function enterWorldBoss() {
  const { data, error } = await supabase.rpc('enter_world_boss');
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return {
    sessionId: row.session_id,
    weekKey: row.week_key,
    bossCurrentHp: Number(row.boss_current_hp),
    bossMaxHp: Number(row.boss_max_hp),
    bossAtk: row.boss_atk,
    bossDef: row.boss_def,
    remainingAttempts: row.remaining_attempts,
  };
}

/** 전투에서 실제로 입힌 데미지를 서버에 보고 (세션당 1회만 반영, 전투력 기준 상한으로 클램프) */
export async function reportWorldBossDamage(sessionId, damage) {
  const { data, error } = await supabase.rpc('report_world_boss_damage', {
    p_session_id: sessionId,
    p_damage: damage,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return {
    newCurrentHp: Number(row.new_current_hp),
    bossMaxHp: Number(row.boss_max_hp),
    clearedNow: row.cleared_now,
  };
}
