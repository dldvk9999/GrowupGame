import { supabase } from './supabaseClient';

/** 랭킹에서 유저 클릭 시 상세 프로필 조회 (migration 166) */
export async function fetchPublicProfile(userId) {
  const { data, error } = await supabase.rpc('fetch_public_profile', { p_user_id: userId });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    nickname: row.nickname,
    equippedTitle: row.equipped_title,
    monsterName: row.monster_name,
    speciesId: row.species_id,
    element: row.element,
    level: row.level,
    exp: row.exp,
    unlockedJobTier: row.unlocked_job_tier,
    combatPower: row.combat_power,
    equippedItems: row.equipped_items ?? [],
    equippedCostumes: row.equipped_costumes ?? [],
    expDungeonCleared: row.exp_dungeon_cleared,
    goldDungeonCleared: row.gold_dungeon_cleared,
    towerHighestFloor: row.tower_highest_floor,
    guildName: row.guild_name,
    guildTag: row.guild_tag,
  };
}
