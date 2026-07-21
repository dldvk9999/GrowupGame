import { supabase } from './supabaseClient';

export const FREE_DRAW_TYPES = ['weapon', 'armor', 'gloves', 'shoes', 'skill', 'relic'];

/** 5종(무기/방어구/장갑/신발/스킬) 각각 오늘 무료뽑기를 이미 썼는지 조회 */
export async function fetchDailyFreeDrawState(userId) {
  const { data, error } = await supabase
    .from('daily_free_draw_state')
    .select('draw_type, last_claim_date')
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

/** state(fetchDailyFreeDrawState 결과)를 { weapon: bool, armor: bool, ... } 형태로 변환 */
export function buildFreeDrawUsedMap(state) {
  const today = new Date().toISOString().slice(0, 10);
  const usedMap = {};
  for (const type of FREE_DRAW_TYPES) {
    const row = state?.find((r) => r.draw_type === type);
    usedMap[type] = row?.last_claim_date === today;
  }
  return usedMap;
}

/** 무료 뽑기 - type: 'weapon' | 'armor' | 'gloves' | 'shoes' | 'skill' */
export async function claimDailyFreeDraw(type) {
  const { data, error } = await supabase.rpc('claim_daily_free_draw', { p_type: type });
  if (error) throw new Error(error.message);
  return data?.[0] ?? data;
}
