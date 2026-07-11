import { supabase } from './supabaseClient';

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

/** 성장 결과(레벨/경험치/스탯/진화)를 DB에 반영 */
export async function persistMonsterGrowth(ownedMonsterId, monster) {
  const { error } = await supabase
    .from('owned_monsters')
    .update({
      level: monster.level,
      exp: monster.exp,
      hp: monster.hp,
      atk: monster.atk,
      def: monster.def,
      species_id: monster.speciesDbId ?? undefined,
    })
    .eq('id', ownedMonsterId);
  if (error) throw error;
}

/** 보스 처치 시 새 몬스터 획득 (포획 시스템: 100% 획득) */
export async function catchMonster(userId, speciesId, initialStats) {
  const { data, error } = await supabase
    .from('owned_monsters')
    .insert({
      user_id: userId,
      species_id: speciesId,
      level: 1,
      exp: 0,
      hp: initialStats.hp,
      atk: initialStats.atk,
      def: initialStats.def,
      is_active: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
