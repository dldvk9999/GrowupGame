import { supabase } from './supabaseClient';
import { speciesKeyToDbId, dbIdToSpeciesKey } from './speciesDbIds';
import { createMonster } from './growth';

/** 로그인 유저의 사육장 몬스터 목록 조회 */
export async function fetchOwnedMonsters(userId) {
  const { data, error } = await supabase
    .from('owned_monsters')
    .select('*, monster_species(*)')
    .eq('user_id', userId)
    .order('caught_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** DB row(owned_monsters) → 전투/성장 로직에서 쓰는 몬스터 객체로 변환 */
export function hydrateMonster(row) {
  const speciesId = dbIdToSpeciesKey[row.species_id];
  return {
    ownedMonsterId: row.id,
    speciesId,
    name: row.monster_species?.name ?? row.nickname ?? speciesId,
    element: row.monster_species?.element,
    level: row.level,
    exp: row.exp,
    hp: row.hp,
    maxHp: row.hp, // 재접속 시 만피 상태로 시작
    atk: row.atk,
    def: row.def,
  };
}

/** 성장 결과(레벨/경험치/스탯/진화)를 DB에 반영 */
export async function persistMonsterGrowth(ownedMonsterId, monster) {
  const { error } = await supabase
    .from('owned_monsters')
    .update({
      level: monster.level,
      exp: monster.exp,
      hp: monster.maxHp, // 승리 후에는 만피로 저장 (다음 접속 시 풀피 시작)
      atk: monster.atk,
      def: monster.def,
      species_id: speciesKeyToDbId[monster.speciesId],
    })
    .eq('id', ownedMonsterId);
  if (error) throw error;
}

/** 최초 로그인 시 스타터 1마리 생성 */
export async function createStarter(userId, speciesKey) {
  const base = createMonster(speciesKey);
  const { data, error } = await supabase
    .from('owned_monsters')
    .insert({
      user_id: userId,
      species_id: speciesKeyToDbId[speciesKey],
      level: base.level,
      exp: base.exp,
      hp: base.maxHp,
      atk: base.atk,
      def: base.def,
      is_active: true,
    })
    .select('*, monster_species(*)')
    .single();
  if (error) throw error;
  return hydrateMonster(data);
}

/**
 * 로그인 시 호출: 기존 몬스터가 있으면 그대로 이어서, 없으면 null 반환
 * (null이면 스타터 선택 화면으로 보내면 됨)
 */
export async function getActiveMonster(userId) {
  const rows = await fetchOwnedMonsters(userId);
  if (!rows.length) return null;
  const active = rows.find((r) => r.is_active) ?? rows[0];
  return hydrateMonster(active);
}

