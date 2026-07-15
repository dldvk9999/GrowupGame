import { supabase } from './supabaseClient';

/** 내가 보유한 스킬 목록 */
export async function fetchUserSkills(userId) {
  const { data, error } = await supabase
    .from('user_skills')
    .select('*')
    .eq('user_id', userId)
    .order('acquired_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** 스킬 뽑기 1회 - 등급/중복합성 판정은 서버(RPC)에서 함 */
export async function drawSkill() {
  const { data, error } = await supabase.rpc('draw_skill');
  if (error) throw new Error(error.message.includes('골드') ? '골드가 부족합니다.' : error.message);
  return data?.[0]; // { skill_key, new_skill_level, was_duplicate, cost, draw_level }
}

/** 스킬 편성 저장 - 슬롯 개수/보유여부는 서버가 재검증 */
export async function setSkillLoadout(skillKeys) {
  const { error } = await supabase.rpc('set_skill_loadout', { p_skill_keys: skillKeys });
  if (error) throw error;
}
