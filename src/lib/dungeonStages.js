const ELEMENTS = ['fire', 'water', 'grass'];

function dungeonBoss(stage) {
  const element = ELEMENTS[stage % ELEMENTS.length];
  // 난이도 재상향: 체력/공격력/방어력 계수를 올림
  const hp = Math.round(220 + Math.pow(stage, 1.6) * 185);
  const atk = Math.round(20 + Math.pow(stage, 1.5) * 13);
  const def = Math.round(15 + Math.pow(stage, 1.4) * 9);
  return {
    name: `던전 ${stage}층 보스`,
    element,
    spriteKey: `${element}_1`,
    maxHp: hp,
    hp,
    atk,
    def,
    isBoss: true,
  };
}

export const DUNGEON_STAGE_COUNT = 10;

/** 경험치 던전: 경험치 위주, 골드는 조금만 */
export function getExpDungeonStage(stage) {
  const boss = dungeonBoss(stage);
  return { ...boss, dungeonType: 'exp', stage, expReward: Math.round(boss.maxHp * 3.2), goldReward: Math.round(boss.maxHp * 0.6) };
}

/** 골드 던전: 골드 위주, 경험치는 조금만 */
export function getGoldDungeonStage(stage) {
  const boss = dungeonBoss(stage);
  return { ...boss, dungeonType: 'gold', stage, expReward: Math.round(boss.maxHp * 0.6), goldReward: Math.round(boss.maxHp * 3.2) };
}

export function getDungeonStage(type, stage) {
  return type === 'exp' ? getExpDungeonStage(stage) : getGoldDungeonStage(stage);
}
