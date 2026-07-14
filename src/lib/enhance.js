import { supabase } from './supabaseClient';

/** 강화 시도 - 성공/실패 판정은 서버(RPC)에서 함 */
export async function enhanceItem(inventoryId) {
  const { data, error } = await supabase.rpc('enhance_item', { p_inventory_id: inventoryId });
  if (error) throw new Error(error.message.includes('골드') ? '골드가 부족합니다.' : error.message);
  return data?.[0]; // { success, new_level, cost, rate }
}
