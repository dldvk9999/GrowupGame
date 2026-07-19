/**
 * "오늘의 한마디" - 로그인 시 하루 1번(localStorage로 날짜 추적) 보여주는 순수 플레이버 메시지.
 * 게임 메커니즘(확률/보상 등)에 대한 어떤 암시도 하지 않도록 주의해서 작성함 -
 * 실제로 존재하지 않는 "오늘은 운이 좋은 날" 류의 확률 변경 암시는 절대 넣지 않음.
 * 순수 응원/공감/유머 문구만 담아서 접속할 때마다 소소한 재미를 줌.
 */
export const DAILY_QUOTES = [
  '오늘도 몬스터와 함께하는 하루, 시작해볼까요?',
  '작은 성장도 성장이에요. 오늘도 화이팅!',
  '가끔은 그냥 자동사냥만 켜놓고 쉬어가도 괜찮아요.',
  '몬스터도 주인님을 기다리고 있었어요.',
  '오늘 목표 하나만 정해서 클리어해보는 건 어때요?',
  '어제보다 조금 더 강해진 나를 발견해보세요.',
  '가끔은 랭킹 말고 나만의 속도로 즐기는 것도 좋아요.',
  '친구에게 이 게임 이야기 해본 적 있나요?',
  '물 한 잔 마시고, 오늘도 즐거운 플레이 되세요.',
  '레벨업의 손맛, 오늘도 느껴보세요.',
  '무한의 탑, 오늘은 몇 층까지 가볼까요?',
  '꾸준함이 결국 가장 강한 스탯이에요.',
  '뽑기 확률이 궁금하면 언제든 "현재 확률 보기"를 눌러보세요.',
  '연속 접속 기록, 오늘도 이어가볼까요?',
  '로비 랭킹에서 재산 순위도 한번 확인해보세요.',
  '친구를 추천했다면 친구추천 랭킹도 챙겨보세요.',
  '던전을 돌다 보면 가끔 정예 몬스터가 나타나요. 놓치지 마세요!',
  '월드보스를 꾸준히 사냥하면 특별한 테마도 해금할 수 있어요.',
  '몬스터 이름이 고민되면 애칭 추천 버튼을 눌러보세요.',
];

const DAILY_QUOTE_KEY = 'growupgame-last-quote-date';

/** 오늘 아직 안 보여줬으면 랜덤 문구 하나, 이미 봤으면 null */
export function getTodaysQuoteIfNotShown() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(DAILY_QUOTE_KEY) === today) return null;
    localStorage.setItem(DAILY_QUOTE_KEY, today);
  } catch {
    // localStorage 없으면 매번 보여줌(치명적이지 않음)
  }
  return DAILY_QUOTES[Math.floor(Math.random() * DAILY_QUOTES.length)];
}
