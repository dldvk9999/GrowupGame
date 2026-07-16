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

/** 장비 합성 - 강화수치 10 소모해서 상위등급 아이템의 강화수치를 1 올림 */
export async function synthesizeEquipment(itemKey) {
  const { data, error } = await supabase.rpc('synthesize_equipment', { p_item_key: itemKey });
  if (error) throw error;
  return data?.[0]; // { target_item_key, target_new_level, source_remaining_level }
}

/** 장비 일괄합성 - 가능한 만큼 한번에 반복 합성 */
export async function synthesizeEquipmentBatch(itemKey) {
  const { data, error } = await supabase.rpc('synthesize_equipment_batch', { p_item_key: itemKey });
  if (error) throw error;
  return data?.[0]; // { target_item_key, target_new_level, source_remaining_level, times }
}
