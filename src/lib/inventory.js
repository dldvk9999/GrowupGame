import { supabase } from './supabaseClient';
import { getItem, getEnhancedStatBonus } from './itemCatalog';
import { showToast } from './toast';

/** 내 인벤토리 조회 */
export async function fetchInventory(userId) {
  const { data, error } = await supabase
    .from('user_inventory')
    .select('*')
    .eq('user_id', userId)
    .order('acquired_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** 아이템 구매 - 가격/슬롯은 서버 카탈로그 기준으로 검증되고, 골드 차감도 원자적으로 처리됨 */
export async function buyItem(userId, itemKey) {
  const { data, error } = await supabase.rpc('buy_item', { p_item_key: itemKey });
  if (error) {
    if (error.message.includes('골드')) {
      showToast('골드가 부족합니다.', 'error');
      throw new Error('골드가 부족합니다.');
    }
    throw new Error(error.message);
  }
  return data;
}

/** 장착: 같은 슬롯의 기존 장착템은 자동 해제 후 교체 */
export async function equipItem(userId, inventoryId, slot) {
  const { error: unequipError } = await supabase
    .from('user_inventory')
    .update({ equipped: false })
    .eq('user_id', userId)
    .eq('slot', slot)
    .eq('equipped', true);
  if (unequipError) throw unequipError;

  const { error } = await supabase
    .from('user_inventory')
    .update({ equipped: true })
    .eq('id', inventoryId);
  if (error) throw error;
}

export async function unequipItem(inventoryId) {
  const { error } = await supabase
    .from('user_inventory')
    .update({ equipped: false })
    .eq('id', inventoryId);
  if (error) throw error;
}

/** 장착 중인 아이템들의 스탯 보너스 합산 { atk, def, hp } - 강화 수치 반영됨 */
export function sumEquippedBonus(inventoryRows) {
  const bonus = { atk: 0, def: 0, hp: 0 };
  for (const row of inventoryRows) {
    if (!row.equipped) continue;
    const item = getItem(row.item_key);
    if (!item) continue;
    bonus[item.statKey] += getEnhancedStatBonus(item, row.enhance_level ?? 0);
  }
  return bonus;
}
