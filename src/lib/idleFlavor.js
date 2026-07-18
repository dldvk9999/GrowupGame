/**
 * 자동사냥 처치 로그에 가끔(낮은 확률로) 섞이는 재미용 대사 풀.
 * 순수 텍스트 콘텐츠 - 게임 로직/보상엔 전혀 영향 없음, 몰입감/개성 부여 목적.
 */
export const IDLE_FLAVOR_LINES = [
  '오늘도 열심히 사냥하는 중...',
  '이 정도는 몸풀기지!',
  '다음 상대는 누구지?',
  '슬슬 손이 풀리는데?',
  '주인님, 저 잘하고 있죠?',
  '한 마리 더!',
  '레벨업이 머지않았어요.',
  '이 구역은 제가 접수합니다.',
  '전직하면 더 세질 텐데...',
  '뽑기 좀 하고 올까...',
  '오늘 컨디션 최고예요!',
  '다음 챕터가 기대되네요.',
];

/** 낮은 확률(기본 12%)로 랜덤 대사 하나를 뽑고, 아니면 null */
export function maybePickIdleFlavor(chance = 0.12) {
  if (Math.random() >= chance) return null;
  return IDLE_FLAVOR_LINES[Math.floor(Math.random() * IDLE_FLAVOR_LINES.length)];
}
