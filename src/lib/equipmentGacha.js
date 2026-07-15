import { supabase } from './supabaseClient';
import { showToast } from './toast';

/** 장비 뽑기 1회 - 슬롯/등급 판정은 서버(RPC)에서 함 */
export async function drawEquipment() {
  const { data, error } = await supabase.rpc('draw_equipment');
  if (error) {
    if (error.message.includes('골드')) {
      showToast('골드가 부족합니다.', 'error');
      throw new Error('골드가 부족합니다.');
    }
    throw new Error(error.message);
  }
  return data?.[0]; // { item_key, slot, rarity, cost, draw_level }
}

/** 장비 다회차 뽑기 (1/10/100) - 골드 부족하면 그 시점까지만 뽑고 부분 성공 반환 */
export async function drawEquipmentBatch(count) {
  const { data, error } = await supabase.rpc('draw_equipment_batch', { p_count: count });
  if (error) {
    if (error.message.includes('골드')) {
      showToast('골드가 부족합니다.', 'error');
      throw new Error('골드가 부족합니다.');
    }
    throw new Error(error.message);
  }
  return data ?? [];
}
