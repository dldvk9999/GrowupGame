import { supabase } from './supabaseClient';

/** 슬롯별 누적 뽑기 횟수 { weapon, armor, gloves, shoes } */
export async function fetchEquipmentDrawProgress(userId) {
  const { data, error } = await supabase
    .from('equipment_gacha_progress')
    .select('slot, total_draws')
    .eq('user_id', userId);
  if (error) throw error;
  const progress = { weapon: 0, armor: 0, gloves: 0, shoes: 0 };
  for (const row of data) progress[row.slot] = row.total_draws;
  return progress;
}
