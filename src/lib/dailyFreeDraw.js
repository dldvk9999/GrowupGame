import { supabase } from './supabaseClient';

/** 오늘 무료 뽑기를 이미 썼는지 확인용 상태 조회 */
export async function fetchDailyFreeDrawState(userId) {
  const { data, error } = await supabase
    .from('daily_free_draw_state')
    .select('last_claim_date')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function hasUsedFreeDrawToday(state) {
  if (!state?.last_claim_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return state.last_claim_date === today;
}

/** 무료 뽑기 (p_type: 'skill' | 'equipment', equipment면 slot 필수) */
export async function claimDailyFreeDraw(type, slot) {
  const { data, error } = await supabase.rpc('claim_daily_free_draw', { p_type: type, p_slot: slot ?? null });
  if (error) throw new Error(error.message);
  return data?.[0] ?? data;
}
