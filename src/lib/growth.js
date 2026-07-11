import { speciesById } from './speciesData';

/** 레벨 n에서 다음 레벨까지 필요한 경험치 */
export function expToNextLevel(level) {
  return Math.round(20 * Math.pow(level, 1.5));
}

/** 종 base 스탯 + 레벨에 따른 성장 보정 */
function scaleStats(species, level) {
  const growth = 1 + (level - 1) * 0.12;
  return {
    maxHp: Math.round(species.baseHp * growth),
    atk: Math.round(species.baseAtk * growth),
    def: Math.round(species.baseDef * growth),
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
  }

  const species = speciesById[speciesId];
  const stats = scaleStats(species, level);
  const hpRatio = monster.maxHp ? monster.hp / monster.maxHp : 1;

  return {
    ...monster,
    level,
    exp,
    speciesId,
    name: species.name,
    element: species.element,
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
  return {
    speciesId,
    name: species.name,
    element: species.element,
    level,
    exp: 0,
    maxHp: stats.maxHp,
    hp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
  };
}
