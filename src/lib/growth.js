import { speciesById } from './speciesData';
import { getAppliedTier, JOB_TIERS } from './jobAdvancement';

export const MAX_LEVEL = 500; // 10차 전직(레벨480) 확장에 맞춰 최대 레벨을 500으로 설정(사용자 요청)

/** 레벨 n에서 다음 레벨까지 필요한 경험치 */
export function expToNextLevel(level) {
  return Math.round(20 * Math.pow(level, 1.5));
}

/** 종 base 스탯 + 레벨 성장 + "실제 적용된" 전직 배율(unlockedJobTier 기준) 반영 */
export function scaleStats(species, level, unlockedJobTier = 0) {
  const growth = 1 + (level - 1) * 0.12;
  const tier = getAppliedTier(species.element, unlockedJobTier);
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
 * 전직은 레벨만으로 자동 적용되지 않음 - 전직 던전을 깨야 unlockedJobTier가 올라가고,
 * 그전까지는 "전직 가능" 알림만 뜸 (events에 안내 문구 추가).
 *
 * monster: { level, exp, speciesId, hp, maxHp, atk, def, unlockedJobTier }
 * 반환값: 갱신된 monster + { events: string[] } (로그 출력용)
 */
export function applyExpGain(monster, gainedExp) {
  let level = monster.level;
  let exp = monster.exp + gainedExp;
  let speciesId = monster.speciesId;
  const unlockedJobTier = monster.unlockedJobTier ?? 0;
  const events = [];

  while (level < MAX_LEVEL && exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level);
    level += 1;
    events.push(`레벨 ${level} 달성!`);

    const species = speciesById[speciesId];
    if (species?.evolveLevel && level >= species.evolveLevel && species.evolvesTo) {
      speciesId = species.evolvesTo;
      const next = speciesById[speciesId];
      events.push(`${next.name}(으)로 진화했다!`);
    }

    const crossedTier = (JOB_TIERS[speciesById[speciesId].element] ?? []).find((t) => t.level === level);
    if (crossedTier && crossedTier.tier > unlockedJobTier) {
      events.push(`전직 조건 달성! (${crossedTier.title}) 전직 던전에 도전해보세요.`);
    }
  }
  if (level >= MAX_LEVEL) exp = 0; // 만렙 도달 후엔 경험치가 무의미하게 계속 쌓이지 않도록 고정

  const species = speciesById[speciesId];
  const stats = scaleStats(species, level, unlockedJobTier);
  const hpRatio = monster.maxHp ? monster.hp / monster.maxHp : 1;
  const jobTier = getAppliedTier(species.element, unlockedJobTier);

  return {
    ...monster,
    level,
    exp,
    speciesId,
    speciesDbId: species.dbId,
    name: species.name,
    element: species.element,
    jobTitle: jobTier?.title ?? null,
    unlockedJobTier,
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
  const stats = scaleStats(species, level, 0);
  return {
    speciesId,
    speciesDbId: species.dbId,
    name: species.name,
    element: species.element,
    jobTitle: null,
    unlockedJobTier: 0,
    level,
    exp: 0,
    maxHp: stats.maxHp,
    hp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
  };
}
