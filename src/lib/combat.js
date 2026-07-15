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

/**
 * 전투력(CP) - 공격력/방어력/최대체력을 하나의 지표로 합산.
 * 공격력이 가장 크게 반영되고(스킬 배율 때문에 실질 딜에 가장 직결),
 * 방어력은 mitigateDamage 공식상 효율이 체감되므로 중간 가중치,
 * 체력은 생존력 관점에서 가장 낮은 가중치로 환산.
 */
export function calculateCombatPower(monster) {
  if (!monster) return 0;
  const atkScore = (monster.atk ?? 0) * 4.5;
  const defScore = (monster.def ?? 0) * 3.2;
  const hpScore = (monster.maxHp ?? monster.hp ?? 0) * 0.6;
  return Math.round(atkScore + defScore + hpScore);
}
