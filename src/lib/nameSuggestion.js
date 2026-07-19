/**
 * 몬스터 애칭 랜덤 추천 - 이름 짓기가 부담스러운 유저를 위한 순수 편의기능.
 * 속성별로 어울리는 이름 후보를 미리 준비해두고 무작위로 하나 골라줌.
 * 서버 관여 없음, 그냥 클라이언트에서 후보 하나를 뽑아 입력창에 채워줄 뿐.
 */
const NAME_POOL = {
  fire: ['이그니스', '블레이즈', '엠버', '화르륵이', '홍염', '불꽃이', '스칼렛', '파이로'],
  water: ['아쿠아', '리플', '마린', '물방울이', '청록이', '웨이브', '이슬이', '나이아드'],
  grass: ['클로버', '이파리', '숲돌이', '초록이', '새싹이', '테라', '모스', '플로라'],
};

/** 속성에 맞는 이름 하나를 무작위로 추천 */
export function suggestMonsterName(element) {
  const pool = NAME_POOL[element] ?? [...NAME_POOL.fire, ...NAME_POOL.water, ...NAME_POOL.grass];
  return pool[Math.floor(Math.random() * pool.length)];
}
