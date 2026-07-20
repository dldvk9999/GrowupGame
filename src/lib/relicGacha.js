import { supabase } from './supabaseClient';

/** 유물 뽑기 - 스킬뽑기와 동일 비용/확률, 중복이면 강화 시도(실패 가능) */
export async function drawRelic() {
  const { data, error } = await supabase.rpc('draw_relic');
  if (error) throw new Error(error.message);
  return data?.[0];
}

/** 여러 번 뽑기(순차 호출) - equipmentGacha.js의 drawEquipmentBatch와 달리 서버 배치 RPC가
 * 없어서 클라이언트에서 반복 호출함(유물은 실패 연출 등으로 결과가 더 다양해서 배치
 * RPC로 압축하기보다 개별 결과를 전부 보존하는 쪽을 택함). 골드 부족하면 중간에 멈춤. */
export async function drawRelicBatch(count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    try {
      const res = await drawRelic();
      results.push(res);
    } catch (err) {
      if (results.length === 0) throw err;
      break;
    }
  }
  return results;
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
