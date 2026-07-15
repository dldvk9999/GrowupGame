// 전직 시 statMultiplier가 growth.js의 레벨 성장 보정에 곱연산으로 추가 적용됨.
// 전직 스킬은 SKILLS(기본 5종)에 추가로 사용 가능해짐 (해금될 때마다 +1개씩 누적).
export const JOB_TIERS = {
  fire: [
    { tier: 1, level: 30, title: '작열의 전사', statMultiplier: 1.25,
      skill: { id: 'fire_job1', name: '작열 폭발', icon: '💢', type: 'damage', multiplier: 3.6, cooldown: 6500, description: '1차 전직 전용기' } },
    { tier: 2, level: 60, title: '화염 군주', statMultiplier: 1.55,
      skill: { id: 'fire_job2', name: '멸화의 파도', icon: '🌋', type: 'damage', multiplier: 4.6, cooldown: 8000, description: '2차 전직 전용기' } },
    { tier: 3, level: 100, title: '멸화의 지배자', statMultiplier: 1.9,
      skill: { id: 'fire_job3', name: '종언의 불꽃', icon: '☀️', type: 'damage', multiplier: 6.2, cooldown: 10000, description: '3차 전직 전용기, 최강의 일격' } },
  ],
  water: [
    { tier: 1, level: 30, title: '심연의 전사', statMultiplier: 1.25,
      skill: { id: 'water_job1', name: '해일 강타', icon: '💢', type: 'damage', multiplier: 3.6, cooldown: 6500, description: '1차 전직 전용기' } },
    { tier: 2, level: 60, title: '파도의 지배자', statMultiplier: 1.55,
      skill: { id: 'water_job2', name: '심연의 소용돌이', icon: '🌊', type: 'damage', multiplier: 4.6, cooldown: 8000, description: '2차 전직 전용기' } },
    { tier: 3, level: 100, title: '해왕', statMultiplier: 1.9,
      skill: { id: 'water_job3', name: '태초의 해일', icon: '🌀', type: 'damage', multiplier: 6.2, cooldown: 10000, description: '3차 전직 전용기, 최강의 일격' } },
  ],
  grass: [
    { tier: 1, level: 30, title: '숲의 전사', statMultiplier: 1.25,
      skill: { id: 'grass_job1', name: '가시 폭풍', icon: '💢', type: 'damage', multiplier: 3.6, cooldown: 6500, description: '1차 전직 전용기' } },
    { tier: 2, level: 60, title: '대지의 수호자', statMultiplier: 1.55,
      skill: { id: 'grass_job2', name: '고대수의 분노', icon: '🌳', type: 'damage', multiplier: 4.6, cooldown: 8000, description: '2차 전직 전용기' } },
    { tier: 3, level: 100, title: '태초의 정령왕', statMultiplier: 1.9,
      skill: { id: 'grass_job3', name: '만물의 개화', icon: '🌸', type: 'damage', multiplier: 6.2, cooldown: 10000, description: '3차 전직 전용기, 최강의 일격' } },
  ],
};

/** 해당 레벨에서 "전직 조건을 만족한" 가장 높은 단계 번호(0~3). 실제 적용과는 별개 - 전직 던전을 깨야 진짜 적용됨 */
export function getEligibleTierNumber(element, level) {
  const tiers = JOB_TIERS[element] ?? [];
  let n = 0;
  for (const t of tiers) {
    if (level >= t.level) n = t.tier;
  }
  return n;
}

/** 실제로 전직 던전을 깨서 적용된 단계 (owned_monsters.unlocked_job_tier 기준) */
export function getAppliedTier(element, unlockedJobTier) {
  if (!unlockedJobTier) return null;
  return (JOB_TIERS[element] ?? [])[unlockedJobTier - 1] ?? null;
}

/** 실제 적용된(unlockedJobTier까지) 전직 단계들 (스킬 누적용) */
export function getUnlockedJobTiers(element, unlockedJobTier) {
  return (JOB_TIERS[element] ?? []).filter((t) => t.tier <= (unlockedJobTier ?? 0));
}

/** 전직 스킬까지 합친 사용 가능 스킬 목록 (실제 적용된 전직 기준) */
export function getAvailableSkills(baseSkills, element, unlockedJobTier) {
  const unlocked = getUnlockedJobTiers(element, unlockedJobTier);
  return [...baseSkills, ...unlocked.map((t) => t.skill)];
}

/** 전직 조건은 만족했지만(레벨업) 아직 전직 던전을 안 깬 상태인지 */
export function hasPendingJobAdvancement(element, level, unlockedJobTier) {
  return getEligibleTierNumber(element, level) > (unlockedJobTier ?? 0);
}

/** 화면에 표시할 스프라이트 키 - 전직했으면 진화단계 대신 전직 전용 외형을 우선 표시 */
export function getDisplaySpriteKey(speciesId, element, unlockedJobTier) {
  if (unlockedJobTier > 0) return `${element}_job${unlockedJobTier}`;
  return speciesId;
}
