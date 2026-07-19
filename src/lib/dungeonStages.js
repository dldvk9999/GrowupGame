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

export const DUNGEON_STAGE_COUNT = 500;

// 500층까지 열리면서 HP^1.6 공식이 지수적으로 커져 최고층 보상이 극단적으로
// 커지는 문제를 발견함(500층 경험치 보상이 1230만까지 치솟아 레벨250 기준
// 필요경험치의 150배가 넘음 - 한 번의 클리어로 수백 레벨이 뛰는 밸런스 붕괴).
// 골드는 add_gold의 100만 상한과 맞춰 클램프하고, 경험치도 상식적인 범위로
// 클램프해서 "고층일수록 보상이 크지만 게임이 깨지진 않는" 선을 지킴.
const MAX_DUNGEON_EXP_REWARD = 200000;
const MAX_DUNGEON_GOLD_REWARD = 1000000;

/** 경험치 던전: 경험치 위주, 골드는 조금만 */
export function getExpDungeonStage(stage) {
  const boss = dungeonBoss(stage);
  return {
    ...boss, dungeonType: 'exp', stage,
    expReward: Math.min(MAX_DUNGEON_EXP_REWARD, Math.round(boss.maxHp * 3.2)),
    goldReward: Math.min(MAX_DUNGEON_GOLD_REWARD, Math.round(boss.maxHp * 0.6)),
  };
}

/** 골드 던전: 골드 위주, 경험치는 조금만 */
export function getGoldDungeonStage(stage) {
  const boss = dungeonBoss(stage);
  return {
    ...boss, dungeonType: 'gold', stage,
    expReward: Math.min(MAX_DUNGEON_EXP_REWARD, Math.round(boss.maxHp * 0.6)),
    goldReward: Math.min(MAX_DUNGEON_GOLD_REWARD, Math.round(boss.maxHp * 3.2)),
  };
}

export function getDungeonStage(type, stage) {
  return type === 'exp' ? getExpDungeonStage(stage) : getGoldDungeonStage(stage);
}
