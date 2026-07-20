import { supabase } from './supabaseClient';

/**
 * 로그인 시 1회 호출 - profiles.last_offline_claim_at(106) 기준으로 방치 시간 동안의
 * 골드를 즉시 지급받음. 이 함수 자체가 매 호출마다 체크포인트를 now()로 갱신하므로
 * (102의 last_login_at과는 별개 컬럼) 호출 순서를 신경 쓸 필요 없음 - comeback.js와
 * 완전히 독립적으로 아무 때나 호출해도 안전함(103 최초 설계는 last_login_at을 공유하며
 * comeback 쪽에만 갱신을 맡겼는데, 반복 호출 시 무제한 파밍이 가능한 치명적 취약점이라
 * 106에서 전용 컬럼+자체갱신 방식으로 수정함, harness/security.md 참고).
 * @returns {Promise<{gold: number, offline_seconds: number} | null>}
 */
export async function claimOfflineGoldReward() {
  const { data, error } = await supabase.rpc('claim_offline_gold_reward');
  if (error) throw error;
  return Array.isArray(data) ? data[0] ?? null : data;
}
