/**
 * 뽑기 확률 구간표 - 서버(draw_skill/draw_equipment/draw_relic, 055/119 기준)의 확률 로직을
 * 그대로 미러링한 것. 스킬뽑기/장비뽑기/유물뽑기가 전부 동일한 구간/확률을 공유함.
 * 실제 판정은 항상 서버가 하므로, 여기는 순수 "안내용 표시"일 뿐 로직에 관여하지 않음.
 * ⚠️ 서버의 draw_skill/draw_equipment/draw_relic 확률을 바꾸는 마이그레이션을 만들 때는
 * 반드시 이 표도 함께 갱신해야 함(안 그러면 화면에 뜨는 확률이 실제와 달라짐).
 */
export const GACHA_PROBABILITY_TIERS = [
  { maxLevel: 8, normal: 0.70, rare: 0.25, epic: 0.05, legendary: 0.00, mythic: 0.00 },
  { maxLevel: 18, normal: 0.50, rare: 0.32, epic: 0.15, legendary: 0.03, mythic: 0.00 },
  { maxLevel: 28, normal: 0.32, rare: 0.33, epic: 0.25, legendary: 0.09, mythic: 0.01 },
  { maxLevel: 38, normal: 0.18, rare: 0.27, epic: 0.30, legendary: 0.20, mythic: 0.05 },
  { maxLevel: 48, normal: 0.08, rare: 0.17, epic: 0.30, legendary: 0.32, mythic: 0.13 },
  { maxLevel: Infinity, normal: 0.03, rare: 0.10, epic: 0.25, legendary: 0.37, mythic: 0.25 },
];

/** 현재 뽑기레벨 기준 확률 구간 반환 */
export function getGachaProbability(drawLevel) {
  return GACHA_PROBABILITY_TIERS.find((t) => drawLevel <= t.maxLevel) ?? GACHA_PROBABILITY_TIERS.at(-1);
}
