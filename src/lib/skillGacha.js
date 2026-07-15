import { supabase } from './supabaseClient';
import { showToast } from './toast';

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
  if (error) {
    if (error.message.includes('골드')) {
      showToast('골드가 부족합니다.', 'error');
      throw new Error('골드가 부족합니다.');
    }
    throw new Error(error.message);
  }
  return data?.[0]; // { skill_key, new_skill_level, was_duplicate, cost, draw_level }
}

/** 스킬 다회차 뽑기 (1/10/100) - 골드 부족하면 그 시점까지만 뽑고 부분 성공 반환 */
export async function drawSkillBatch(count) {
  const { data, error } = await supabase.rpc('draw_skill_batch', { p_count: count });
  if (error) {
    if (error.message.includes('골드')) {
      showToast('골드가 부족합니다.', 'error');
      throw new Error('골드가 부족합니다.');
    }
    throw new Error(error.message);
  }
  return data ?? []; // 배열, 각 항목이 drawSkill()과 동일한 형태
}

/** 스킬 편성 저장 - 슬롯 개수/보유여부는 서버가 재검증 */
export async function setSkillLoadout(skillKeys) {
  const { error } = await supabase.rpc('set_skill_loadout', { p_skill_keys: skillKeys });
  if (error) throw error;
}
