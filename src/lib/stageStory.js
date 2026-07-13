import { getChapterName, getChapterElement, TOTAL_CHAPTERS } from './stages';

const HOOK = [
  '이 지역 몬스터들의 눈빛이 심상치 않다.',
  '균형이 무너진 흔적이 여기저기 남아있다.',
  '주민들이 도움을 청하며 몰려든다.',
  '오래된 봉인의 균열이 발견됐다.',
  '누군가 이 땅을 일부러 어지럽히고 있는 듯하다.',
  '작은 이상 징후가 점점 커지고 있다.',
  '이곳을 지나던 조련사들이 하나둘 소식이 끊겼다.',
  '지도에 없는 길이 새로 열렸다.',
  '기운이 요동치는 게 피부로 느껴진다.',
  '오래된 전설이 다시 현실이 되려 한다.',
];

const SUBSTAGE_FLAVOR = [
  '몬스터 한 마리가 앞을 가로막는다.',
  '경계하는 눈빛의 몬스터와 마주쳤다.',
  '기운이 불안정한 몬스터가 다가온다.',
  '숨어있던 몬스터가 튀어나왔다.',
  '지쳐 보이는 몬스터, 하지만 방심은 금물.',
  '무리에서 떨어져 나온 몬스터를 발견했다.',
  '더 강한 기운을 뿜는 몬스터가 나타났다.',
  '주변 몬스터들이 술렁이기 시작한다.',
  '심상치 않은 기운의 몬스터, 보스가 가까운 듯하다.',
];

/** 챕터(대스테이지) 진입 시 보여줄 스토리 한 조각 */
export function getChapterStory(chapter) {
  const name = getChapterName(chapter);
  const element = getChapterElement(chapter);
  const elementLabel = { fire: '화속성', water: '수속성', grass: '초속성' }[element];
  const hook = HOOK[(chapter - 1) % HOOK.length];

  if (chapter === TOTAL_CHAPTERS) {
    return {
      title: `${name} · 최후의 장`,
      body: `마침내 폭주의 근원지, ${name}에 도착했다. 이곳에서 균형을 되찾을 수 있을지, 모든 것이 결정된다. ${hook}`,
    };
  }

  return {
    title: `Chapter ${chapter} · ${name}`,
    body: `여정은 ${name}(으)로 이어진다. 이 지역은 ${elementLabel} 기운이 유독 강하게 느껴진다. ${hook}`,
  };
}

/** 스테이지(소스테이지) 진입 시 전투 로그에 띄울 짧은 한 줄 */
export function getStageFlavor(chapter, stage) {
  if (stage === 10) {
    return `${getChapterName(chapter)} 깊은 곳, 강력한 기운이 느껴진다. 보스전이다!`;
  }
  return SUBSTAGE_FLAVOR[(chapter + stage) % SUBSTAGE_FLAVOR.length];
}
