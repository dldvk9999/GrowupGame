// 속성 상성 시스템 (신규, 사용자 요청) - 불 > 풀 > 물 > 불 순환(고전 3속성 상성).
// 배율을 온건하게 잡음(유리 1.25배 / 불리 0.8배, 무관계는 1배) - 기존 스테이지/던전
// 난이도 곡선(HP/ATK/DEF 공식)을 건드리지 않고도 "상성이 있다"는 전략적 재미를
// 더하는 선에서 그치도록, 극단적인 배율(예: 2배/0.5배)은 피함. 필요시 나중에
// 실제 반응을 보고 배율만 조정하면 됨(다른 밸런스 수치들과 동일한 원칙).
const ADVANTAGE = { fire: 'grass', grass: 'water', water: 'fire' };

export const ELEMENT_ADVANTAGE_MULT = 1.25;
export const ELEMENT_DISADVANTAGE_MULT = 0.8;

/**
 * 공격 측 속성이 방어 측 속성에 상성상 유리/불리/무관인지에 따른 데미지 배율.
 * 둘 중 하나라도 속성 정보가 없으면(구버전 데이터 등) 안전하게 1배(무효과) 반환.
 */
export function getElementMultiplier(attackerElement, defenderElement) {
  if (!attackerElement || !defenderElement || attackerElement === defenderElement) return 1;
  if (ADVANTAGE[attackerElement] === defenderElement) return ELEMENT_ADVANTAGE_MULT;
  if (ADVANTAGE[defenderElement] === attackerElement) return ELEMENT_DISADVANTAGE_MULT;
  return 1;
}

/** UI에 "유리/불리/무관" 안내 문구를 붙일 때 쓰는 짧은 판정 - 'advantage' | 'disadvantage' | 'neutral' */
export function getElementRelation(attackerElement, defenderElement) {
  const mult = getElementMultiplier(attackerElement, defenderElement);
  if (mult > 1) return 'advantage';
  if (mult < 1) return 'disadvantage';
  return 'neutral';
}

export const ELEMENT_LABEL = { fire: '불', water: '물', grass: '풀' };
