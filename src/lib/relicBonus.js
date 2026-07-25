import { RELIC_CATALOG, getRelic, getRelicEffectiveValue, getRelicPossessionValue } from './relicCatalog';

/**
 * 유물 효과 합산 - 장착된(equipped=true) 최대 5개는 전액 반영 + **보유한 유물 전부**(장착 여부
 * 무관, 신규 사용자 요청)는 10%만 추가로 반영("보유효과"). 기존엔 유물만 장비/스킬과 달리
 * 보유효과가 아예 없었는데(장착개수 제한이 유일한 안전장치), 이번 요청으로 장비/스킬과
 * 같은 패턴을 갖추되 비율을 작게(10%) 잡아서 "장착개수 제한"이라는 기존 안전장치는 그대로 둠.
 * ATK/DEF/HP: flat 유물들의 합에 percent 유물들의 합(%)을 곱해서 "최종 flat 보너스"로
 * 반환(057 세트효과가 장비 보너스 소계에만 5%를 곱하는 것과 동일한 철학 - 몬스터 기본
 * 스탯 자체는 건드리지 않고, 보너스 소계에만 비율을 적용). 서버 calc_relic_bonus(119/120/141)는
 * 몬스터 기본스탯까지 포함해서 비율을 곱하므로 완전히 동일한 수치는 아니지만(다른
 * 클라이언트 계산 전투들도 이미 서버 PvP 계산과 100% 일치하진 않음, security.md 참고),
 * 유물의 체감 효과를 주는 목적으로는 충분함.
 * 쿨타임/골드/경험치/버프는 %만 반환(호출부에서 각자 곱해서 사용).
 */
export function getTotalRelicBonus(userRelics) {
  const flat = { atk: 0, def: 0, hp: 0 };
  const pct = { atk: 0, def: 0, hp: 0, gold: 0, exp: 0, cooldown: 0, buff: 0 };

  function addToAccumulators(relic, value) {
    if (relic.effectMode === 'flat') {
      if (relic.effectCategory === 'atk') flat.atk += value;
      else if (relic.effectCategory === 'def') flat.def += value;
      else if (relic.effectCategory === 'hp') flat.hp += value;
    } else if (relic.effectCategory in pct) {
      pct[relic.effectCategory] += value;
    }
  }

  for (const row of userRelics ?? []) {
    const relic = getRelic(row.relic_key);
    if (!relic) continue;
    const level = row.level ?? 0;
    // 보유효과 - 장착 여부와 무관하게 전부 적용
    addToAccumulators(relic, getRelicPossessionValue(relic, level));
    // 장착효과 - 장착 중인 것만 전액 추가 반영
    if (row.equipped) {
      addToAccumulators(relic, getRelicEffectiveValue(relic, level));
    }
  }

  return {
    atk: Math.round(flat.atk * (1 + pct.atk / 100)),
    def: Math.round(flat.def * (1 + pct.def / 100)),
    hp: Math.round(flat.hp * (1 + pct.hp / 100)),
    pctGold: pct.gold,
    pctExp: pct.exp,
    pctCooldown: pct.cooldown,
    pctBuff: pct.buff,
  };
}

export { RELIC_CATALOG };
