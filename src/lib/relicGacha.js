import { supabase } from './supabaseClient';

/** 유물 뽑기 - 스킬뽑기와 동일 비용/확률, 중복이면 강화 시도(실패 가능) */
export async function drawRelic() {
  const { data, error } = await supabase.rpc('draw_relic');
  if (error) throw new Error(error.message);
  return data?.[0];
}

/** 여러 번 뽑기(1/10/100) - 서버 draw_relic_batch가 반복문을 한 번에 처리해서 반환.
 * ⚠️ 예전엔 draw_relic()을 N번 순차 await로 호출했는데, 매번 왕복 네트워크 레이턴시가
 * 그대로 누적돼서 100회뽑기가 장비/스킬 뽑기(둘 다 서버측 배치 RPC가 있음)보다
 * 눈에 띄게 오래 걸렸음(사용자 제보) - 서버 배치 RPC로 교체해서 한 번의 요청으로 끝남. */
export async function drawRelicBatch(count) {
  const { data, error } = await supabase.rpc('draw_relic_batch', { p_count: count });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** 내 유물 보유 목록(레벨/장착여부 포함) */
export async function fetchMyRelics(userId) {
  const { data, error } = await supabase
    .from('user_relics')
    .select('relic_key, level, equipped')
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

/** 유물 장착 편성 저장(최대 3개, 서버가 보유여부/개수 검증) */
export async function setRelicLoadout(relicKeys) {
  const { error } = await supabase.rpc('set_relic_loadout', { p_relic_keys: relicKeys });
  if (error) throw new Error(error.message);
}
