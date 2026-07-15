/**
 * 방어력에 따른 데미지 경감. 고전 RPG식 수렴 공식(100/(100+def))을 사용해서,
 * 방어력이 아무리 높아도 데미지가 완전히 0이 되지는 않되(최소 1) 후반부로 갈수록
 * 공격력만으로 밀어붙이기 어렵게 만듦.
 */
export function mitigateDamage(rawDamage, defenderDef) {
  const def = defenderDef ?? 0;
  const mitigated = rawDamage * (100 / (100 + def));
  return Math.max(1, Math.round(mitigated));
}
