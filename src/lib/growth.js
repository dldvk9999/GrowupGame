import { speciesById } from './speciesData';
import { getCurrentJobTier } from './jobAdvancement';

/** 레벨 n에서 다음 레벨까지 필요한 경험치 */
export function expToNextLevel(level) {
  return Math.round(20 * Math.pow(level, 1.5));
}

/** 종 base 스탯 + 레벨 성장 + 전직 배율 반영 (다른 모듈에서도 재사용) */
export function scaleStats(species, level) {
  const growth = 1 + (level - 1) * 0.12;
  const tier = getCurrentJobTier(species.element, level);
  const jobMultiplier = tier?.statMultiplier ?? 1;
  return {
    maxHp: Math.round(species.baseHp * growth * jobMultiplier),
    atk: Math.round(species.baseAtk * growth * jobMultiplier),
    def: Math.round(species.baseDef * growth * jobMultiplier),
  };
}

/**
 * 경험치를 몬스터에 적용. 레벨업이 여러 번 겹치는 것도 처리하고,
 * evolveLevel에 도달하면 자동으로 다음 종으로 진화시킴.
 *
 * monster: { level, exp, speciesId, hp, maxHp, atk, def }
 * 반환값: 갱신된 monster + { events: string[] } (로그 출력용)
 */
export function applyExpGain(monster, gainedExp) {
  let level = monster.level;
  let exp = monster.exp + gainedExp;
  let speciesId = monster.speciesId;
  const events = [];

  while (exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level);
    level += 1;
    events.push(`레벨 ${level} 달성!`);

    const species = speciesById[speciesId];
    if (species?.evolveLevel && level >= species.evolveLevel && species.evolvesTo) {
      speciesId = species.evolvesTo;
      const next = speciesById[speciesId];
      events.push(`${next.name}(으)로 진화했다!`);
    }

    const tier = getCurrentJobTier(speciesById[speciesId].element, level);
    if (tier && tier.level === level) {
      events.push(`${tier.title}(으)로 전직했다! 전용 스킬 [${tier.skill.name}] 습득!`);
    }
  }

  const species = speciesById[speciesId];
  const stats = scaleStats(species, level);
  const hpRatio = monster.maxHp ? monster.hp / monster.maxHp : 1;
  const jobTier = getCurrentJobTier(species.element, level);

  return {
    ...monster,
    level,
    exp,
    speciesId,
    speciesDbId: species.dbId,
    name: species.name,
    element: species.element,
    jobTitle: jobTier?.title ?? null,
    maxHp: stats.maxHp,
    hp: Math.round(stats.maxHp * hpRatio),
    atk: stats.atk,
    def: stats.def,
    events,
  };
}

/** 초기 몬스터 객체 생성 (레벨 1 기준) */
export function createMonster(speciesId, level = 1) {
  const species = speciesById[speciesId];
  const stats = scaleStats(species, level);
  const jobTier = getCurrentJobTier(species.element, level);
  return {
    speciesId,
    speciesDbId: species.dbId,
    name: species.name,
    element: species.element,
    jobTitle: jobTier?.title ?? null,
    level,
    exp: 0,
    maxHp: stats.maxHp,
    hp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
  };
}
