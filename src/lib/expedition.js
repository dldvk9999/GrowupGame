import { supabase } from './supabaseClient';

export const EXPEDITION_TIERS = {
  short: { label: '짧은 파견', hours: 0.5, icon: '🕐' },
  medium: { label: '중간 파견', hours: 4, icon: '🕓' },
  long: { label: '긴 파견', hours: 12, icon: '🕛' },
};

/** 파견 시작 - 이미 진행 중인 파견이 있으면 서버가 거부(먼저 수령해야 함) */
export async function startExpedition(tier) {
  const { data, error } = await supabase.rpc('start_expedition', { p_tier: tier });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { startedAt: row.started_at, durationSeconds: row.duration_seconds };
}

/** 파견 보상 수령 - 아직 시간이 안 지났으면 서버가 거부 */
export async function claimExpedition() {
  const { data, error } = await supabase.rpc('claim_expedition');
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { gold: row.gold, tier: row.tier };
}

/** 내 현재 파견 상태(진행중인 게 없으면 null) */
export async function fetchMyExpedition(userId) {
  const { data, error } = await supabase
    .from('expeditions')
    .select('tier, started_at, duration_seconds, claimed')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.claimed) return null;
  return data;
}
