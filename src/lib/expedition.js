import { supabase } from './supabaseClient';

export const EXPEDITION_TIERS = {
  short: { label: '짧은 파견', hours: 0.5, icon: '🕐' },
  medium: { label: '중간 파견', hours: 4, icon: '🕓' },
  long: { label: '긴 파견', hours: 12, icon: '🕛' },
};

/** 레벨에 따른 파견 슬롯 개수 - 서버 calc_expedition_slots와 동일 공식 유지할 것(사용자 요청) */
export function calcExpeditionSlots(level) {
  return 1 + Math.floor(Math.max(1, level) / 100);
}

/** 파견 시작 - 슬롯이 꽉 찼으면 서버가 거부 */
export async function startExpedition(tier) {
  const { data, error } = await supabase.rpc('start_expedition', { p_tier: tier });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { id: row.id, startedAt: row.started_at, durationSeconds: row.duration_seconds };
}

/** 파견 보상 수령 - 아직 시간이 안 지났으면 서버가 거부 */
export async function claimExpedition(expeditionId) {
  const { data, error } = await supabase.rpc('claim_expedition', { p_expedition_id: expeditionId });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { gold: row.gold, tier: row.tier };
}

/** 진행 중인 파견 전부 + 총 슬롯 수 - { expeditions: [...], totalSlots } */
export async function fetchMyExpeditions() {
  const { data, error } = await supabase.rpc('fetch_my_expeditions');
  if (error) throw error;
  const rows = data ?? [];
  return {
    expeditions: rows.map((r) => ({ id: r.id, tier: r.tier, startedAt: r.started_at, durationSeconds: r.duration_seconds })),
    totalSlots: rows[0]?.total_slots ?? 1,
  };
}
