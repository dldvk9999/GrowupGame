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

/**
 * 장착 중인 아이템들의 스탯 보너스 합산 { atk, def, hp } - 강화 수치 반영됨.
 * **세트 효과**: 4슬롯(무기/방어구/장갑/신발)을 전부 장착하고 등급이 모두 같으면
 * 세트 보너스로 최종 합산치에 +5%를 더 얹어줌(예: 신화 4종 풀세트). 등급이 하나라도
 * 다르거나 4슬롯 중 하나라도 비어있으면 세트 보너스 없음 — 순수 장착 보너스로만 판정하고
 * 보유효과(sumPossessionBonus)에는 적용 안 됨(장착해야만 받는 혜택으로 의도함).
 */
export function sumEquippedBonus(inventoryRows) {
  const bonus = { atk: 0, def: 0, hp: 0 };
  const equippedRarities = {}; // slot -> rarity, 세트효과 판정용
  for (const row of inventoryRows) {
    if (!row.equipped) continue;
    const item = getItem(row.item_key);
    if (!item) continue;
    bonus[item.statKey] += getEnhancedStatBonus(item, row.enhance_level ?? 0);
    equippedRarities[item.slot] = item.rarity;
  }
  if (isFullSetEquipped(equippedRarities)) {
    bonus.atk = Math.round(bonus.atk * 1.05);
    bonus.def = Math.round(bonus.def * 1.05);
    bonus.hp = Math.round(bonus.hp * 1.05);
  }
  return bonus;
}

/** 4슬롯(weapon/armor/gloves/shoes) 전부 장착 + 등급 전부 동일한지 판정 */
export function isFullSetEquipped(equippedRarities) {
  const slots = ['weapon', 'armor', 'gloves', 'shoes'];
  const rarities = slots.map((s) => equippedRarities[s]);
  if (rarities.some((r) => !r)) return false;
  return rarities.every((r) => r === rarities[0]);
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
