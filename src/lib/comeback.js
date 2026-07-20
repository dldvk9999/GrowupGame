import { supabase } from './supabaseClient';

/**
 * 로그인 시 1회 호출 - 서버가 profiles.last_login_at을 실제로 갱신하면서,
 * 3일 이상 쉬었다 돌아온 경우 축하 우편(골드)을 발송해줌.
 * 실패해도(네트워크 오류 등) 로그인 흐름 자체를 막으면 안 되므로 호출부에서 항상 catch로 감싸 씀.
 * @returns {Promise<{granted: boolean, days_away: number, gold_reward: number} | null>}
 */
export async function claimComebackRewardIfEligible() {
  const { data, error } = await supabase.rpc('record_login_and_grant_comeback_reward');
  if (error) throw error;
  // RPC가 RETURNS TABLE이라 배열로 오므로 첫 행만 사용
  return Array.isArray(data) ? data[0] ?? null : data;
}
