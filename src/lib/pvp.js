import { supabase } from './supabaseClient';

/** 내 현재 전투력 (서버가 계산, 만피 기준) */
export async function fetchMyCombatPower() {
  const { data, error } = await supabase.rpc('fetch_my_combat_power');
  if (error) throw error;
  return data;
}

/** PvP 대결 시작 - 매칭+전투+보상까지 서버에서 한번에 처리됨 */
export async function startPvpBattle() {
  const { data, error } = await supabase.rpc('start_pvp_battle');
  if (error) throw new Error(error.message);
  return data?.[0];
}

/** 최근 PvP 전적 */
export async function fetchPvpHistory(userId, limit = 20) {
  const { data, error } = await supabase
    .from('pvp_battle_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/** PvP 상점 진열대 동기화(1시간마다 자동 갱신) 후 목록 조회 */
export async function fetchPvpShop() {
  const syncRes = await supabase.rpc('sync_pvp_shop');
  if (syncRes.error) throw syncRes.error;

  const { data, error } = await supabase
    .from('pvp_shop_listings')
    .select('*')
    .order('slot_index', { ascending: true });
  if (error) throw error;
  return data;
}

/** 내가 보유한 PvP 코스튬 목록 */
export async function fetchMyCostumes(userId) {
  const { data, error } = await supabase
    .from('pvp_costume_inventory')
    .select('item_key')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map((r) => r.item_key));
}

/** PvP 코스튬 구매 */
export async function buyPvpCostume(listingId) {
  const { error } = await supabase.rpc('buy_pvp_costume', { p_listing_id: listingId });
  if (error) throw error;
}
