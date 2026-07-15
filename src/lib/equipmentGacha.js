import { supabase } from './supabaseClient';
import { showToast } from './toast';

/** 슬롯 고정 장비 뽑기 1회 - 등급 판정/중복시 자동강화는 서버(RPC)에서 함 */
export async function drawEquipment(slot) {
  const { data, error } = await supabase.rpc('draw_equipment', { p_slot: slot });
  if (error) {
    if (error.message.includes('골드')) {
      showToast('골드가 부족합니다.', 'error');
      throw new Error('골드가 부족합니다.');
    }
    throw new Error(error.message);
  }
  return data?.[0]; // { item_key, slot, rarity, was_duplicate, new_enhance_level, cost, draw_level }
}

/** 슬롯 고정 장비 다회차 뽑기 (1/10/100) */
export async function drawEquipmentBatch(slot, count) {
  const { data, error } = await supabase.rpc('draw_equipment_batch', { p_slot: slot, p_count: count });
  if (error) {
    if (error.message.includes('골드')) {
      showToast('골드가 부족합니다.', 'error');
      throw new Error('골드가 부족합니다.');
    }
    throw new Error(error.message);
  }
  return data ?? [];
}
