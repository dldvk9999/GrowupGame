import { supabase } from './supabaseClient';
import { getItem } from './itemCatalog';
import { spendGold } from './economy';

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

/** 아이템 구매: 골드 차감 성공 시에만 인벤토리에 추가 */
export async function buyItem(userId, itemKey) {
  const item = getItem(itemKey);
  if (!item) throw new Error('존재하지 않는 아이템입니다.');

  const ok = await spendGold(userId, item.price);
  if (!ok) throw new Error('골드가 부족합니다.');

  const { data, error } = await supabase
    .from('user_inventory')
    .insert({ user_id: userId, item_key: itemKey, slot: item.slot, equipped: false })
    .select()
    .single();
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

/** 장착 중인 아이템들의 스탯 보너스 합산 { atk, def, hp } */
export function sumEquippedBonus(inventoryRows) {
  const bonus = { atk: 0, def: 0, hp: 0 };
  for (const row of inventoryRows) {
    if (!row.equipped) continue;
    const item = getItem(row.item_key);
    if (!item) continue;
    bonus[item.statKey] += item.statBonus;
  }
  return bonus;
}
