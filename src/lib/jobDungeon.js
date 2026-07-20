// 전직 던전은 같은 레벨대 일반 던전보다 훨씬 강하게 잡음.
// 기본 공격만 연타해서는 못 이기고, 여러 스킬(특히 회복기)을 로테이션 해야 클리어 가능한 수준.
// 6~10차(사용자 요청)는 5차까지의 성장 곡선(~2.1배씩)보다 훨씬 가파르게 잡아서
// "단순 반복 노가다로는 못 뚫는" 진짜 엔드게임 관문이 되게 함.
export const JOB_DUNGEON_BOSS = {
  1: { name: '수호자의 시험', requiredLevel: 30, hp: 2600, atk: 130, def: 90 },
  2: { name: '심판자의 결계', requiredLevel: 60, hp: 6200, atk: 260, def: 220 },
  3: { name: '종언의 제단', requiredLevel: 100, hp: 13000, atk: 430, def: 420 },
  4: { name: '초월자의 관문', requiredLevel: 140, hp: 28000, atk: 780, def: 840 },
  5: { name: '태초의 심판자', requiredLevel: 180, hp: 58000, atk: 1450, def: 1680 },
  6: { name: '멸화의 관문', requiredLevel: 240, hp: 150000, atk: 3300, def: 3800 },
  7: { name: '종언의 회랑', requiredLevel: 300, hp: 340000, atk: 7500, def: 8600 },
  8: { name: '붕괴하는 태양', requiredLevel: 360, hp: 760000, atk: 17000, def: 19500 },
  9: { name: '신좌의 파수꾼', requiredLevel: 420, hp: 1650000, atk: 38000, def: 44000 },
  10: { name: '잊혀진 조율자의 잔영', requiredLevel: 480, hp: 3600000, atk: 85000, def: 98000 },
};

const TIER_TITLE = {
  1: '1차 전직', 2: '2차 전직', 3: '3차 전직', 4: '4차 전직', 5: '5차 전직',
  6: '6차 전직', 7: '7차 전직', 8: '8차 전직', 9: '9차 전직', 10: '10차 전직(최종)',
};

// 6~10차는 레벨만으론 부족하고, 갈수록 조건이 늘어남(사용자 요청) - 무한의 탑 최소층 +
// 가이드미션 최소 진행 + (8차부터) 특정 업적 보유. 서버(start_job_dungeon, 127)가
// 최종 검증하고, 여기는 화면에 조건을 미리 보여주기 위한 안내용 데이터.
export const JOB_DUNGEON_EXTRA_REQ = {
  6: { towerFloor: 20 },
  7: { towerFloor: 40, missionNumber: 15 },
  8: { towerFloor: 60, missionNumber: 25, achievementTitle: '차원의 정복자' },
  9: { towerFloor: 80, missionNumber: 35, achievementTitle: '종말의 위용' },
  10: { towerFloor: 100, missionNumber: 50, achievementTitle: '정점의 지배자' },
};

export function getJobDungeonBoss(tier, element) {
  const base = JOB_DUNGEON_BOSS[tier];
  return {
    name: `${base.name} (${TIER_TITLE[tier]})`,
    element,
    spriteKey: `${element}_1`,
    maxHp: base.hp,
    hp: base.hp,
    atk: base.atk,
    def: base.def,
    isBoss: true,
    tier,
    requiredLevel: base.requiredLevel,
    expReward: Math.round(base.hp * 1.5),
  };
}
