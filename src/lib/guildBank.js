import { supabase } from './supabaseClient';

/** 길드 창고에 골드 기부 */
export async function donateToGuildBank(amount) {
  const { data, error } = await supabase.rpc('donate_to_guild_bank', { p_amount: amount });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { newGold: row.new_gold, newBankGold: Number(row.new_bank_gold) };
}

/** 길드 창고에서 인출해 특정 길드원에게 우편으로 지급 - 길드장만 가능 */
export async function withdrawFromGuildBank(amount, targetUserId) {
  const { data, error } = await supabase.rpc('withdraw_from_guild_bank', {
    p_amount: amount,
    p_target_user_id: targetUserId,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { newBankGold: Number(row.new_bank_gold) };
}

/** 길드 창고 최근 활동 로그(기부/인출) 20건 */
export async function fetchGuildBankLog() {
  const { data, error } = await supabase.rpc('fetch_guild_bank_log');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    nickname: row.nickname,
    amount: Number(row.amount),
    targetNickname: row.target_nickname,
    createdAt: row.created_at,
  }));
}
