import { supabase } from './supabaseClient';
import { getJobSkillTier } from './jobAdvancement';

export const MAX_JOB_SKILL_ENHANCE_LEVEL = 50;
export const JOB_SKILL_ENHANCE_PER_LEVEL = 0.02; // 강화 1레벨당 +2%

/** 강화 1회당 필요 루비 - 서버 calc_job_skill_enhance_cost와 동일 공식 유지할 것 */
export function calcJobSkillEnhanceCost(tier, currentLevel) {
  return Math.round(tier * 10 + currentLevel * tier * 2);
}

/** 강화 레벨을 반영한 스킬 배율 - 서버는 실제 전투 계산을 안 하므로(전투는 클라이언트),
 * 이 배율 자체가 곧 실제 데미지에 반영되는 값. jobAdvancement.js의 스킬 정의는 안 건드리고
 * BattleScreen 등에서 이 함수로 배율만 보정해서 사용 */
export function getEnhancedJobSkillMultiplier(skill, enhancements) {
  const jobTier = getJobSkillTier(skill.id);
  if (jobTier === 0) return skill.multiplier;
  const level = enhancements?.[skill.id] ?? 0;
  return skill.multiplier * (1 + level * JOB_SKILL_ENHANCE_PER_LEVEL);
}

export async function fetchMyJobSkillEnhancements() {
  const { data, error } = await supabase.rpc('fetch_my_job_skill_enhancements');
  if (error) throw error;
  const map = {};
  for (const row of data ?? []) map[row.skill_id] = row.level;
  return map;
}

export async function enhanceJobSkill(skillId) {
  const { data, error } = await supabase.rpc('enhance_job_skill', { p_skill_id: skillId });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { newLevel: row.new_level, rubiesSpent: row.rubies_spent, rubiesBalance: row.rubies_balance };
}
