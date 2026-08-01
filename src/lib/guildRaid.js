import { supabase } from './supabaseClient';

/** 내 길드의 이번주 레이드 보스 상태(길드 미가입이면 null) */
export async function fetchGuildRaidState() {
  const { data, error } = await supabase.rpc('fetch_guild_raid_state');
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    guildId: row.guild_id,
    guildName: row.guild_name,
    weekKey: row.week_key,
    currentHp: row.current_hp,
    maxHp: row.max_hp,
    atk: row.atk,
    def: row.def,
    cleared: row.cleared,
  };
}

export async function fetchMyGuildRaidProgress() {
  const { data, error } = await supabase.rpc('fetch_my_guild_raid_progress');
  if (error) throw error;
  const row = data?.[0];
  return { attemptsUsed: row?.attempts_used ?? 0, myWeekDamage: row?.my_week_damage ?? 0 };
}

export async function fetchGuildRaidContributors() {
  const { data, error } = await supabase.rpc('fetch_guild_raid_contributors');
  if (error) throw error;
  return data ?? [];
}

export async function enterGuildRaid() {
  const { data, error } = await supabase.rpc('enter_guild_raid');
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return {
    sessionId: row.session_id,
    guildId: row.guild_id,
    weekKey: row.week_key,
    bossCurrentHp: row.boss_current_hp,
    bossMaxHp: row.boss_max_hp,
    bossAtk: row.boss_atk,
    bossDef: row.boss_def,
    remainingAttempts: row.remaining_attempts,
  };
}

export async function reportGuildRaidDamage(sessionId, damage) {
  const { data, error } = await supabase.rpc('report_guild_raid_damage', { p_session_id: sessionId, p_damage: damage });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { newCurrentHp: row.new_current_hp, bossMaxHp: row.boss_max_hp, clearedNow: row.cleared_now };
}
