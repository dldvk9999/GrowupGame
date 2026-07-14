import { supabase } from './supabaseClient';
import { speciesKeyToDbId, dbIdToSpeciesKey } from './speciesDbIds';
import { scaleStats } from './growth';
import { speciesById } from './speciesData';
import { getCurrentJobTier } from './jobAdvancement';

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
  const species = speciesById[speciesId];
  const stats = scaleStats(species, row.level);
  const jobTier = getCurrentJobTier(species.element, row.level);
  return {
    ownedMonsterId: row.id,
    speciesId,
    speciesDbId: species.dbId,
    name: species.name,
    element: species.element,
    jobTitle: jobTier?.title ?? null,
    level: row.level,
    exp: row.exp,
    hp: stats.maxHp, // 재접속 시 만피 상태로 시작
    maxHp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
  };
}

/** 성장 결과(레벨/경험치/스탯/진화)를 DB에 반영 - 서버(RPC)에서 상한선 재검증됨 */
export async function persistMonsterGrowth(ownedMonsterId, monster) {
  const { error } = await supabase.rpc('save_monster_growth', {
    p_owned_monster_id: ownedMonsterId,
    p_level: monster.level,
    p_exp: monster.exp,
    p_hp: monster.maxHp, // 승리 후에는 만피로 저장 (다음 접속 시 풀피 시작)
    p_atk: monster.atk,
    p_def: monster.def,
    p_species_id: speciesKeyToDbId[monster.speciesId],
  });
  if (error) throw error;
}

/** 최초 로그인 시 스타터 1마리 생성 - 서버(RPC)에서 종류/스탯을 직접 결정함 */
export async function createStarter(userId, speciesKey) {
  const { data, error } = await supabase.rpc('create_starter_monster', {
    p_species_key: speciesKey,
  });
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

