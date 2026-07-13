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
