import { supabase } from './supabaseClient';
import { getItem, getEnhancedStatBonus, getPossessionBonus } from './itemCatalog';

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

/** 보유효과 합산 { atk, def, hp } - 장착 여부 상관없이 보유한 아이템 전부 대상, 강화 수치 반영됨 */
export function sumPossessionBonus(inventoryRows) {
  const bonus = { atk: 0, def: 0, hp: 0 };
  for (const row of inventoryRows) {
    const item = getItem(row.item_key);
    if (!item) continue;
    bonus[item.statKey] += getPossessionBonus(item, row.enhance_level ?? 0);
  }
  return bonus;
}

/** 전투에 실제 적용할 총 장비 보너스 = 장착 보너스 + 보유효과 */
export function getTotalEquipmentBonus(inventoryRows) {
  const equipped = sumEquippedBonus(inventoryRows);
  const possession = sumPossessionBonus(inventoryRows);
  return {
    atk: equipped.atk + possession.atk,
    def: equipped.def + possession.def,
    hp: equipped.hp + possession.hp,
  };
}
