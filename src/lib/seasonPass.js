import { supabase } from './supabaseClient';

export const SEASON_PASS_MAX_TIER = 20;

/** 티어별 필요 포인트/보상 미리보기(서버 CASE문과 반드시 동기화 - claim_season_tier, migration 178) */
export function getSeasonTierInfo(tier) {
  const required = tier * 150;
  const gold = tier === 20 ? 6000 : tier % 5 === 0 ? 3000 : 800 + tier * 100;
  const rubies = tier === 20 ? 15 : tier % 5 === 0 ? 6 : 0;
  return { required, gold, rubies };
}

export async function fetchMySeasonPass() {
  const { data, error } = await supabase.rpc('fetch_my_season_pass');
  if (error) throw error;
  const row = data?.[0];
  return {
    seasonKey: row?.season_key,
    points: row?.points ?? 0,
    claimedTiers: row?.claimed_tiers ?? [],
  };
}

export async function claimSeasonTier(tier) {
  const { data, error } = await supabase.rpc('claim_season_tier', { p_tier: tier });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { newGold: row.new_gold, newRubies: row.new_rubies };
}
