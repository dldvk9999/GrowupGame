import { supabase } from './supabaseClient';

export async function createGuild(name, tag) {
  const { data, error } = await supabase.rpc('create_guild', { p_name: name, p_tag: tag });
  if (error) throw new Error(error.message);
  return data; // guild id
}

export async function joinGuild(guildId) {
  const { error } = await supabase.rpc('join_guild', { p_guild_id: guildId });
  if (error) throw new Error(error.message);
}

export async function leaveGuild() {
  const { error } = await supabase.rpc('leave_guild');
  if (error) throw new Error(error.message);
}

export async function transferGuildLeadership(newLeaderId) {
  const { error } = await supabase.rpc('transfer_guild_leadership', { p_new_leader_id: newLeaderId });
  if (error) throw new Error(error.message);
}

export async function setGuildAnnouncement(text) {
  const { error } = await supabase.rpc('set_guild_announcement', { p_announcement: text });
  if (error) throw new Error(error.message);
}

/** 내 길드 정보 - 가입 안 했으면 null */
export async function fetchMyGuild() {
  const { data, error } = await supabase.rpc('fetch_my_guild');
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    guildId: row.guild_id, name: row.name, tag: row.tag, announcement: row.announcement,
    leaderId: row.leader_id, memberCount: row.member_count, isLeader: row.is_leader,
    level: row.level ?? 1, exp: Number(row.exp ?? 0), expToNext: Number(row.exp_to_next ?? 0),
    bankGold: Number(row.bank_gold ?? 0),
  };
}

export async function fetchGuildList() {
  const { data, error } = await supabase.rpc('fetch_guild_list');
  if (error) throw error;
  return (data ?? []).map((r) => ({ guildId: r.guild_id, name: r.name, tag: r.tag, memberCount: r.member_count }));
}

export async function fetchGuildMembers(guildId) {
  const { data, error } = await supabase.rpc('fetch_guild_members', { p_guild_id: guildId });
  if (error) throw error;
  return (data ?? []).map((r) => ({ userId: r.user_id, nickname: r.nickname, level: r.level, joinedAt: r.joined_at }));
}

export async function fetchGuildLeaderboard() {
  const { data, error } = await supabase.rpc('fetch_guild_leaderboard');
  if (error) throw error;
  return (data ?? []).map((r) => ({ guildId: r.guild_id, name: r.name, tag: r.tag, memberCount: r.member_count, totalLevel: r.total_level }));
}
