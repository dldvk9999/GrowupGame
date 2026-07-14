export const SLOTS = {
  weapon: { label: '무기', statKey: 'atk', base: 6, icon: '⚔️' },
  armor: { label: '보호구', statKey: 'def', base: 6, icon: '🛡️' },
  gloves: { label: '장갑', statKey: 'atk', base: 3, icon: '🧤' },
  shoes: { label: '신발', statKey: 'hp', base: 18, icon: '👢' },
};

export const RARITIES = {
  normal: { label: '노멀', order: 1, color: '#9aa0b8', statMultiplier: 1, price: 80 },
  rare: { label: '레어', order: 2, color: '#3aa8e0', statMultiplier: 1.8, price: 300 },
  epic: { label: '에픽', order: 3, color: '#b566e0', statMultiplier: 2.8, price: 1200 },
  legendary: { label: '전설', order: 4, color: '#f2b705', statMultiplier: 4.2, price: 5000 },
  mythic: { label: '신화', order: 5, color: '#ff5a7a', statMultiplier: 6.5, price: 20000 },
};

/** 4슬롯 × 5등급 = 20개 고정 아이템 카탈로그 */
export const ITEM_CATALOG = Object.entries(SLOTS).flatMap(([slotKey, slot]) =>
  Object.entries(RARITIES).map(([rarityKey, rarity]) => {
    const itemKey = `${slotKey}_${rarityKey}`;
    return {
      itemKey,
      slot: slotKey,
      slotLabel: slot.label,
      icon: slot.icon,
      statKey: slot.statKey,
      rarity: rarityKey,
      rarityLabel: rarity.label,
      rarityOrder: rarity.order,
      color: rarity.color,
      name: `${rarity.label} ${slot.label}`,
      statBonus: Math.round(slot.base * rarity.statMultiplier),
      price: Math.round(rarity.price * (slot.base / 6)),
    };
  })
);

export function getItem(itemKey) {
  return ITEM_CATALOG.find((i) => i.itemKey === itemKey);
}

export const MAX_ENHANCE_LEVEL = 15;

const BASE_RATE_BY_RARITY_ORDER = { 1: 0.9, 2: 0.8, 3: 0.65, 4: 0.45, 5: 0.25 };

/** 강화 성공률/비용 미리보기 (실제 판정은 서버 RPC에서 함, 이건 UI 표시용) */
export function estimateEnhance(item, currentLevel) {
  const base = BASE_RATE_BY_RARITY_ORDER[item.rarityOrder] ?? 0.5;
  const rate = Math.max(base * Math.pow(0.92, currentLevel), 0.05);
  const cost = Math.round(item.price * 0.1 * (1 + currentLevel * 0.5));
  return { rate, cost };
}

/** 강화 수치가 반영된 실제 스탯 보너스 (강화 1당 +8%) */
export function getEnhancedStatBonus(item, enhanceLevel) {
  return Math.round(item.statBonus * (1 + enhanceLevel * 0.08));
}
