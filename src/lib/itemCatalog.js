export const SLOTS = {
  weapon: { label: '무기', statKey: 'atk', base: 6, icon: '⚔️' },
  armor: { label: '보호구', statKey: 'def', base: 6, icon: '🛡️' },
  gloves: { label: '장갑', statKey: 'atk', base: 3, icon: '🧤' },
  shoes: { label: '신발', statKey: 'hp', base: 18, icon: '👢' },
};

export const RARITIES = {
  normal: { label: '노멀', order: 1, color: '#9aa0b8', statMultiplier: 1, price: 80, setBonus: 0.03 },
  rare: { label: '레어', order: 2, color: '#3aa8e0', statMultiplier: 1.8, price: 300, setBonus: 0.05 },
  epic: { label: '에픽', order: 3, color: '#b566e0', statMultiplier: 2.8, price: 1200, setBonus: 0.08 },
  legendary: { label: '전설', order: 4, color: '#f2b705', statMultiplier: 4.2, price: 5000, setBonus: 0.12 },
  mythic: { label: '신화', order: 5, color: '#ff5a7a', statMultiplier: 6.5, price: 20000, setBonus: 0.18 },
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

export const MAX_ENHANCE_LEVEL = 1000;

/** 강화 수치가 반영된 실제 스탯 보너스 (강화 1당 +8%, 뽑기 중복으로만 오름) */
export function getEnhancedStatBonus(item, enhanceLevel) {
  return Math.round(item.statBonus * (1 + enhanceLevel * 0.08));
}

// 보유효과: 장착 여부와 상관없이 "갖고만 있어도" 적용되는 소량의 상시 보너스.
// 장착 보너스보다 약하게(기본값의 15%) 잡되, 강화되면 이것도 같이 오름.
const POSSESSION_RATIO = 0.15;

/** 보유효과 스탯 보너스 (장착 안 해도 항상 적용, 강화 수치 반영됨) */
export function getPossessionBonus(item, enhanceLevel) {
  return Math.max(1, Math.round(item.statBonus * POSSESSION_RATIO * (1 + enhanceLevel * 0.08)));
}
