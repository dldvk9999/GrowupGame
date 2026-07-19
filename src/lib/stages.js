// 챕터(대스테이지) 1~100 × 스테이지(소스테이지) 1~10 = 총 1000 스테이지.
// 각 챕터의 10번째 스테이지는 보스로, 같은 챕터 1~9번보다 확실히 강하게 스케일링됨.

const ADJ = ['타오르는', '얼어붙은', '속삭이는', '무너진', '잠든', '뒤틀린', '메마른', '빛나는', '저주받은', '떠오르는'];
const NOUN = ['협곡', '호수', '숲', '폐허', '설원', '동굴', '사막', '늪지', '고원', '심연'];
const ENEMY_BASE_NAME = {
  fire: ['불여우', '화염 임프', '용암 골렘', '불도마뱀'],
  water: ['물귀신', '얼음 정령', '해파리 유령', '늪지 뱀'],
  grass: ['가시덩굴', '독버섯', '숲의 파수꾼', '나무 정령'],
};

export const TOTAL_CHAPTERS = 100;
export const STAGES_PER_CHAPTER = 10;
export const TOTAL_STAGES = TOTAL_CHAPTERS * STAGES_PER_CHAPTER;

/** 스테이지 좌표 <-> 순번(1~1000) 변환 */
export function toStageIndex(chapter, stage) {
  return (chapter - 1) * STAGES_PER_CHAPTER + stage;
}
export function fromStageIndex(index) {
  const chapter = Math.floor((index - 1) / STAGES_PER_CHAPTER) + 1;
  const stage = ((index - 1) % STAGES_PER_CHAPTER) + 1;
  return { chapter, stage };
}

export function getChapterName(chapter) {
  const adj = ADJ[(chapter - 1) % ADJ.length];
  const noun = NOUN[Math.floor((chapter - 1) / ADJ.length) % NOUN.length];
  return `${adj} ${noun}`;
}

export function getChapterElement(chapter) {
  const cycle = ['fire', 'water', 'grass'];
  return cycle[(chapter - 1) % cycle.length];
}

/** 자동 사냥용 필드 몬스터 - 항상 안전(공격력 0), 보상은 레벨/챕터가 높을수록 크게 늘어남 */
export function getIdleMonster(chapter, playerLevel = 1) {
  const element = getChapterElement(chapter);
  const names = ENEMY_BASE_NAME[element];
  const name = '들판의 ' + names[(chapter + playerLevel) % names.length];
  // 챕터/레벨 가중치를 올려서 후반부로 갈수록 자동사냥 보상 체감이 뚜렷하게 커지도록 함
  const hp = Math.max(10, Math.round(8 + chapter * 2.0 + playerLevel * 3.0));
  return {
    name,
    element,
    spriteKey: `${element}_1`,
    maxHp: hp,
    hp,
    atk: 0,
    expReward: Math.max(2, Math.round(hp * 0.19)),
    goldReward: Math.max(5, Math.round(hp * 0.15) * 5 * 8),
  };
}

/** 특정 스테이지의 적 데이터 생성 (절차적 스케일링) */
export function getStageEnemy(chapter, stage) {
  const index = toStageIndex(chapter, stage);
  const isBoss = stage === STAGES_PER_CHAPTER;
  const element = getChapterElement(chapter);
  const names = ENEMY_BASE_NAME[element];
  const baseName = names[(chapter + stage) % names.length];

  // 전체 진행도(index)에 비례해 서서히 강해짐 + 보스는 같은 챕터 잡몹보다 확실히 강하게
  // 계단식 상승 2단계:
  //  - chapterStep: 챕터(10스테이지) 단위로 계단식 상승 (챕터당 +5%, 10스테이지 넘어갈 때마다 체감)
  //  - midChapterStep: 같은 챕터 안에서도 5번째 스테이지부터 추가로 한 단계 더 강해짐 (5스테이지마다 체감)
  // 기본 스케일링/보스 배율 자체도 대폭 상향함 (전직을 거듭할수록 스테이지가 너무 쉬워지는 문제 대응)
  //
  // NORMAL_MONSTER_BOOST: 일반 몹(보스 아닌 스테이지)만 추가로 1.8배 상향.
  // 실측 결과 보스 배율(hp×3.0/atk×2.6)에 비해 일반 몹이 상대적으로 너무 물렁해서
  // (예: lv119·3차전직·신화4강 장비 기준 32-3 잡몹이 스킬 1방에 4타면 끝나고, 받는 피해는 체력의 2%도 안 됨)
  // 보스는 그대로 두고 일반 몹만 별도로 올림.
  const NORMAL_MONSTER_BOOST = 1.8;
  const chapterStep = 1 + (chapter - 1) * 0.05;
  const midChapterStep = stage >= 5 ? 1.15 : 1;
  const stepMultiplier = chapterStep * midChapterStep * (isBoss ? 1 : NORMAL_MONSTER_BOOST);
  const hp = Math.round((30 + index * 7.5 * (isBoss ? 3.0 : 1)) * stepMultiplier);
  const atk = Math.round((4 + index * 0.85 * (isBoss ? 2.6 : 1)) * stepMultiplier);
  const def = Math.round((3 + index * 0.4 * (isBoss ? 2.2 : 1)) * stepMultiplier);

  return {
    stageIndex: index,
    chapter,
    stage,
    isBoss,
    element,
    name: isBoss ? `${getChapterName(chapter)}의 수호자` : baseName,
    spriteKey: `${element}_1`,
    maxHp: hp,
    hp,
    atk,
    def,
    expReward: Math.round(hp * (isBoss ? 1.15 : 0.65)),
    goldReward: (Math.round(hp * (isBoss ? 0.9 : 0.4)) + stage * 2) * 5,
  };
}
