const ELEMENTS = ['fire', 'water', 'grass'];

function dungeonBoss(stage) {
  const element = ELEMENTS[stage % ELEMENTS.length];
  // 난이도 재상향: 체력/공격력/방어력 계수를 올림
  // 공격력 계수를 체력/방어력보다 더 크게 올려서(13→15) 방어구/신발(DEF/HP)의 상대적
  // 가치가 커지게 함(getDungeonAttackInterval의 공격속도 증가와 함께 적용, 사용자 요청)
  const hp = Math.round(220 + Math.pow(stage, 1.6) * 185);
  const atk = Math.round(20 + Math.pow(stage, 1.5) * 15);
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

/**
 * 던전 층수에 비례해 적의 공격 텀(ms)이 점점 짧아짐(=더 빨리 때림) - 사용자 요청.
 * 메인 스테이지(stages.js의 getEnemyAttackInterval)와 같은 취지 - 공격력만 오르는 게
 * 아니라 공격 빈도도 늘어나야 방어구/신발(DEF/HP)의 "누적 피해 완화" 가치가 커짐.
 * 던전은 매 층이 이미 "보스"라 별도 보스 배율은 안 두고, 최대 500층 범위에 맞춰
 * 최저 700ms 바닥으로 감소폭만 다르게 잡음(메인 스테이지는 최대 1000이라 감소 기울기가 다름).
 */
export function getDungeonAttackInterval(stage) {
  return Math.max(700, Math.round(1900 - stage * 2.2));
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
