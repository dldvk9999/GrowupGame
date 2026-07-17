// 전직 시 statMultiplier가 growth.js의 레벨 성장 보정에 곱연산으로 추가 적용됨.
// 전직 스킬은 SKILLS(기본 5종)에 추가로 사용 가능해짐 (해금될 때마다 +1개씩 누적).
// 전직 배율은 대폭 강화됨(1차 2배/2차 3.5배/3차 6배/4차 10배/5차 16배) - save_monster_growth RPC의
// 스탯 상한선 공식도 이 최대값(16.0)에 맞춰 함께 올려야 함 (009/006/011/021 참고, 029에서 갱신).
/** 전직 전용 스킬인지 판별하고, 맞다면 몇 차 전직 스킬인지 반환 (아니면 0) */
export function getJobSkillTier(skillId) {
  const m = /^(?:fire|water|grass)_job([1-5])$/.exec(skillId ?? '');
  return m ? Number(m[1]) : 0;
}

export const JOB_TIERS = {
  fire: [
    { tier: 1, level: 30, title: '작열의 전사', statMultiplier: 2.0,
      skill: { id: 'fire_job1', name: '작열 폭발', icon: '💢', type: 'damage', multiplier: 3.6, cooldown: 6500, description: '1차 전직 전용기' } },
    { tier: 2, level: 60, title: '화염 군주', statMultiplier: 3.5,
      skill: { id: 'fire_job2', name: '멸화의 파도', icon: '🌋', type: 'damage', multiplier: 4.6, cooldown: 8000, description: '2차 전직 전용기' } },
    { tier: 3, level: 100, title: '멸화의 지배자', statMultiplier: 6.0,
      skill: { id: 'fire_job3', name: '종언의 불꽃', icon: '☀️', type: 'damage', multiplier: 6.2, cooldown: 10000, description: '3차 전직 전용기' } },
    { tier: 4, level: 140, title: '멸화의 화신', statMultiplier: 10.0,
      skill: { id: 'fire_job4', name: '종말의 불꽃 폭풍', icon: '🔥', type: 'damage', multiplier: 8.2, cooldown: 12500, description: '4차 전직 전용기' } },
    { tier: 5, level: 180, title: '불꽃의 초월자', statMultiplier: 16.0,
      skill: { id: 'fire_job5', name: '멸망의 업화', icon: '🔥', type: 'damage', multiplier: 10.6, cooldown: 15500, description: '5차 전직 전용기, 최강의 일격' } },
  ],
  water: [
    { tier: 1, level: 30, title: '심연의 전사', statMultiplier: 2.0,
      skill: { id: 'water_job1', name: '해일 강타', icon: '💢', type: 'damage', multiplier: 3.6, cooldown: 6500, description: '1차 전직 전용기' } },
    { tier: 2, level: 60, title: '파도의 지배자', statMultiplier: 3.5,
      skill: { id: 'water_job2', name: '심연의 소용돌이', icon: '🌊', type: 'damage', multiplier: 4.6, cooldown: 8000, description: '2차 전직 전용기' } },
    { tier: 3, level: 100, title: '해왕', statMultiplier: 6.0,
      skill: { id: 'water_job3', name: '태초의 해일', icon: '🌀', type: 'damage', multiplier: 6.2, cooldown: 10000, description: '3차 전직 전용기' } },
    { tier: 4, level: 140, title: '심해의 지배자', statMultiplier: 10.0,
      skill: { id: 'water_job4', name: '대해일의 심판', icon: '🌊', type: 'damage', multiplier: 8.2, cooldown: 12500, description: '4차 전직 전용기' } },
    { tier: 5, level: 180, title: '만해의 지배자', statMultiplier: 16.0,
      skill: { id: 'water_job5', name: '태초의 심연', icon: '🌊', type: 'damage', multiplier: 10.6, cooldown: 15500, description: '5차 전직 전용기, 최강의 일격' } },
  ],
  grass: [
    { tier: 1, level: 30, title: '숲의 전사', statMultiplier: 2.0,
      skill: { id: 'grass_job1', name: '가시 폭풍', icon: '💢', type: 'damage', multiplier: 3.6, cooldown: 6500, description: '1차 전직 전용기' } },
    { tier: 2, level: 60, title: '대지의 수호자', statMultiplier: 3.5,
      skill: { id: 'grass_job2', name: '고대수의 분노', icon: '🌳', type: 'damage', multiplier: 4.6, cooldown: 8000, description: '2차 전직 전용기' } },
    { tier: 3, level: 100, title: '태초의 정령왕', statMultiplier: 6.0,
      skill: { id: 'grass_job3', name: '만물의 개화', icon: '🌸', type: 'damage', multiplier: 6.2, cooldown: 10000, description: '3차 전직 전용기' } },
    { tier: 4, level: 140, title: '대자연의 화신', statMultiplier: 10.0,
      skill: { id: 'grass_job4', name: '태초의 개화', icon: '🌿', type: 'damage', multiplier: 8.2, cooldown: 12500, description: '4차 전직 전용기' } },
    { tier: 5, level: 180, title: '태초의 화신', statMultiplier: 16.0,
      skill: { id: 'grass_job5', name: '만물의 근원', icon: '🌿', type: 'damage', multiplier: 10.6, cooldown: 15500, description: '5차 전직 전용기, 최강의 일격' } },
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
