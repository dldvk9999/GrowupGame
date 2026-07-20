import { supabase } from './supabaseClient';

/**
 * 로그인 시 1회 호출 - profiles.last_login_at(102) 기준으로 방치 시간 동안의
 * 골드를 즉시 지급받음(마지막 접속 시각은 갱신하지 않음, 그 역할은 comeback.js 쪽 함수가 맡음).
 * 반드시 comeback.js의 claimComebackRewardIfEligible()보다 "먼저" 호출해야
 * 정확한 방치 시간을 잴 수 있음(comeback 쪽이 last_login_at을 now()로 갱신해버리기 때문).
 * @returns {Promise<{gold: number, offline_seconds: number} | null>}
 */
export async function claimOfflineGoldReward() {
  const { data, error } = await supabase.rpc('claim_offline_gold_reward');
  if (error) throw error;
  return Array.isArray(data) ? data[0] ?? null : data;
}
