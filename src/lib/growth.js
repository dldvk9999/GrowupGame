import { speciesById } from './speciesData';
import { getAppliedTier, JOB_TIERS } from './jobAdvancement';

export const MAX_LEVEL = 500; // 10차 전직(레벨480) 확장에 맞춰 최대 레벨을 500으로 설정(사용자 요청)

// (신규, 사용자 요청) 정예레벨: 레벨 500(현재 만렙) 달성 후 시작되는 별도의 2차 성장축.
// "던전 클리어 경험치를 대폭 낮춰서 만렙까지 몇 개월씩 걸리게" 만든 것과 함께 도입된
// 밸런스 조정 - 만렙을 찍은 뒤에도 얻는 경험치가 그냥 버려지지 않고 정예레벨로 이어지도록
// 해서, "만렙 이후 할 게 없어짐"을 방지함. 최대 100레벨, 커브는 일반 레벨(20*lv^1.5)보다
// 훨씬 가파르게(2000*lv^1.8) 잡아서 정예레벨 100 전체 총량이 일반 레벨 500 총량(약 4,460만)의
// 약 6.7배(약 3억)가 되도록 설계함 - "일반 만렙보다 몇 배는 더 걸리는" 진짜 장기 목표.
// ⚠️ 지금은 순수 카운터(스탯 보너스 없음) - 추후 이 레벨을 기준으로 던전 입장 제한을 만들
// 예정이라 harness/todo.md에 후속 과제로 기록해둠. 정확한 소요 기간은 추정치라 실제 반응을
// 보고 커브를 재조정할 수 있음(다른 밸런스 수치들과 동일한 원칙).
export const MAX_ELITE_LEVEL = 100;

/** 레벨 n에서 다음 레벨까지 필요한 경험치 */
export function expToNextLevel(level) {
  return Math.round(20 * Math.pow(level, 1.5));
}

/** 정예레벨 n에서 다음 정예레벨까지 필요한 경험치(일반 레벨보다 훨씬 가파름) */
export function eliteExpToNextLevel(eliteLevel) {
  return Math.round(2000 * Math.pow(Math.max(1, eliteLevel), 1.8));
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
  let eliteLevel = monster.eliteLevel ?? 0;
  let eliteExp = monster.eliteExp ?? 0;
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
  if (level >= MAX_LEVEL) {
    // (신규) 만렙 이후엔 남은 경험치를 버리지 않고 정예레벨로 그대로 이어감
    eliteExp += exp;
    exp = 0;
    while (eliteLevel < MAX_ELITE_LEVEL && eliteExp >= eliteExpToNextLevel(eliteLevel)) {
      eliteExp -= eliteExpToNextLevel(eliteLevel);
      eliteLevel += 1;
      events.push(`✨ 정예 레벨 ${eliteLevel} 달성!`);
    }
    if (eliteLevel >= MAX_ELITE_LEVEL) eliteExp = 0; // 정예 만렙 도달 후엔 경험치 고정
  }

  const species = speciesById[speciesId];
  const stats = scaleStats(species, level, unlockedJobTier);
  const hpRatio = monster.maxHp ? monster.hp / monster.maxHp : 1;
  const jobTier = getAppliedTier(species.element, unlockedJobTier);

  return {
    ...monster,
    level,
    exp,
    eliteLevel,
    eliteExp,
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
    eliteLevel: 0,
    eliteExp: 0,
    maxHp: stats.maxHp,
    hp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
  };
}
