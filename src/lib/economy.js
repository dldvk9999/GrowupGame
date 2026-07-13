import { supabase } from './supabaseClient';

/** 몬스터 처치 시 골드 지급 (RPC로 원자적 증가) */
export async function addGold(userId, amount) {
  const { error } = await supabase.rpc('add_gold', { target_user: userId, amount });
  if (error) throw error;
}

/** 상점 구매 시 골드 차감. 잔액 부족하면 false 반환 */
export async function spendGold(userId, amount) {
  const { data, error } = await supabase.rpc('spend_gold', { target_user: userId, amount });
  if (error) throw error;
  return data; // boolean
}
