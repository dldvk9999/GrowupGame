// 전직 시 statMultiplier가 growth.js의 레벨 성장 보정에 곱연산으로 추가 적용됨.
// 전직 스킬은 SKILLS(기본 5종)에 추가로 사용 가능해짐 (해금될 때마다 +1개씩 누적).
// 전직 배율은 대폭 강화됨(1차 2배/2차 3.5배/3차 6배/4차 10배/5차 16배) - save_monster_growth RPC의
// 스탯 상한선 공식도 이 최대값에 맞춰 함께 올려야 함 (009/006/011/021 참고, 029에서 갱신).
// 6~10차 전직 추가(레벨 240/300/360/420/480, 최대배율 90배, 최대레벨 500) - 사용자 요청,
// 최대배율이 16.0->90.0으로 바뀌어서 save_monster_growth 상한 공식도 127(마이그레이션)에서 갱신함.
/** 전직 전용 스킬인지 판별하고, 맞다면 몇 차 전직 스킬인지 반환 (아니면 0) */
export function getJobSkillTier(skillId) {
  const m = /^(?:fire|water|grass)_job([1-9]|10)$/.exec(skillId ?? '');
  return m ? Number(m[1]) : 0;
}

/**
 * 전직 스킬일수록(강할수록) 전투 시작 직후 바로 쏘지 못하도록 초기 사용대기시간을 줌.
 * 1차 0.5초, 2차 1.5초, 3차 2.5초, 4차 3.5초, 5차 4.5초 (tier*1000 - 500ms).
 * 전직 스킬이 아니면 0(대기시간 없음).
 */
export function getInitialJobSkillDelayMs(skillId) {
  const tier = getJobSkillTier(skillId);
  return tier > 0 ? tier * 1000 - 500 : 0;
}

/**
 * 전투 시작 시점의 초기 쿨다운 state를 만들어줌 - 전직 스킬은 getInitialJobSkillDelayMs만큼
 * 미리 "쿨다운 중"으로 세팅해서 즉시 사용을 못 하게 하고, 그 시간이 지나면 자동으로 풀림.
 * 반환값을 setCooldowns/setCooldownStarts/setEffectiveCooldowns 세 state에 그대로 써주고,
 * 호출부가 각 스킬마다 setTimeout으로 실제 해제를 걸어줘야 함(아래 applyInitialJobSkillDelays 참고).
 */
export function buildInitialJobSkillCooldowns(availableSkills) {
  const cooldowns = {};
  const cooldownStarts = {};
  const effectiveCooldowns = {};
  const now = Date.now();
  for (const skill of availableSkills ?? []) {
    const delay = getInitialJobSkillDelayMs(skill.id);
    if (delay > 0) {
      cooldowns[skill.id] = true;
      cooldownStarts[skill.id] = now;
      effectiveCooldowns[skill.id] = delay;
    }
  }
  return { cooldowns, cooldownStarts, effectiveCooldowns };
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
    { tier: 6, level: 240, title: '멸화의 초월자', statMultiplier: 24.0,
      skill: { id: 'fire_job6', name: '천지개벽의 불꽃', icon: '🔥', type: 'damage', multiplier: 13.0, cooldown: 18500, description: '6차 전직 전용기' } },
    { tier: 7, level: 300, title: '불꽃의 종언자', statMultiplier: 34.0,
      skill: { id: 'fire_job7', name: '종언의 폭염', icon: '☄️', type: 'damage', multiplier: 15.6, cooldown: 21500, description: '7차 전직 전용기' } },
    { tier: 8, level: 360, title: '태양을 삼킨 자', statMultiplier: 48.0,
      skill: { id: 'fire_job8', name: '태양 붕괴', icon: '💥', type: 'damage', multiplier: 18.4, cooldown: 24500, description: '8차 전직 전용기' } },
    { tier: 9, level: 420, title: '업화의 신좌', statMultiplier: 66.0,
      skill: { id: 'fire_job9', name: '업화의 심판', icon: '🌋', type: 'damage', multiplier: 21.4, cooldown: 27500, description: '9차 전직 전용기' } },
    { tier: 10, level: 480, title: '조율자의 후계자 · 불꽃', statMultiplier: 90.0,
      skill: { id: 'fire_job10', name: '조율자의 불꽃', icon: '👑', type: 'damage', multiplier: 25.0, cooldown: 31000, description: '10차 전직 전용기, 궁극의 일격' } },
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
    { tier: 6, level: 240, title: '심연의 초월자', statMultiplier: 24.0,
      skill: { id: 'water_job6', name: '천지개벽의 해일', icon: '🌊', type: 'damage', multiplier: 13.0, cooldown: 18500, description: '6차 전직 전용기' } },
    { tier: 7, level: 300, title: '만해의 종언자', statMultiplier: 34.0,
      skill: { id: 'water_job7', name: '종언의 폭풍우', icon: '🌪️', type: 'damage', multiplier: 15.6, cooldown: 21500, description: '7차 전직 전용기' } },
    { tier: 8, level: 360, title: '대양을 삼킨 자', statMultiplier: 48.0,
      skill: { id: 'water_job8', name: '대양 붕괴', icon: '💥', type: 'damage', multiplier: 18.4, cooldown: 24500, description: '8차 전직 전용기' } },
    { tier: 9, level: 420, title: '심해의 신좌', statMultiplier: 66.0,
      skill: { id: 'water_job9', name: '심해의 심판', icon: '🌀', type: 'damage', multiplier: 21.4, cooldown: 27500, description: '9차 전직 전용기' } },
    { tier: 10, level: 480, title: '조율자의 후계자 · 물결', statMultiplier: 90.0,
      skill: { id: 'water_job10', name: '조율자의 파도', icon: '👑', type: 'damage', multiplier: 25.0, cooldown: 31000, description: '10차 전직 전용기, 궁극의 일격' } },
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
    { tier: 6, level: 240, title: '태초의 초월자', statMultiplier: 24.0,
      skill: { id: 'grass_job6', name: '천지개벽의 가시', icon: '🌿', type: 'damage', multiplier: 13.0, cooldown: 18500, description: '6차 전직 전용기' } },
    { tier: 7, level: 300, title: '대지의 종언자', statMultiplier: 34.0,
      skill: { id: 'grass_job7', name: '종언의 폭화', icon: '🌸', type: 'damage', multiplier: 15.6, cooldown: 21500, description: '7차 전직 전용기' } },
    { tier: 8, level: 360, title: '만물을 삼킨 자', statMultiplier: 48.0,
      skill: { id: 'grass_job8', name: '대지 붕괴', icon: '💥', type: 'damage', multiplier: 18.4, cooldown: 24500, description: '8차 전직 전용기' } },
    { tier: 9, level: 420, title: '자연의 신좌', statMultiplier: 66.0,
      skill: { id: 'grass_job9', name: '자연의 심판', icon: '🌳', type: 'damage', multiplier: 21.4, cooldown: 27500, description: '9차 전직 전용기' } },
    { tier: 10, level: 480, title: '조율자의 후계자 · 대지', statMultiplier: 90.0,
      skill: { id: 'grass_job10', name: '조율자의 뿌리', icon: '👑', type: 'damage', multiplier: 25.0, cooldown: 31000, description: '10차 전직 전용기, 궁극의 일격' } },
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
