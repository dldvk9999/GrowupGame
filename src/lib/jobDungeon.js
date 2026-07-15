// 전직 던전은 같은 레벨대 일반 던전보다 훨씬 강하게 잡음.
// 기본 공격만 연타해서는 못 이기고, 여러 스킬(특히 회복기)을 로테이션 해야 클리어 가능한 수준.
export const JOB_DUNGEON_BOSS = {
  1: { name: '수호자의 시험', requiredLevel: 30, hp: 2600, atk: 130 },
  2: { name: '심판자의 결계', requiredLevel: 60, hp: 6200, atk: 260 },
  3: { name: '종언의 제단', requiredLevel: 100, hp: 13000, atk: 430 },
};

const TIER_TITLE = { 1: '1차 전직', 2: '2차 전직', 3: '3차 전직' };

export function getJobDungeonBoss(tier, element) {
  const base = JOB_DUNGEON_BOSS[tier];
  return {
    name: `${base.name} (${TIER_TITLE[tier]})`,
    element,
    spriteKey: `${element}_1`,
    maxHp: base.hp,
    hp: base.hp,
    atk: base.atk,
    isBoss: true,
    tier,
    requiredLevel: base.requiredLevel,
    expReward: Math.round(base.hp * 1.5),
  };
}
