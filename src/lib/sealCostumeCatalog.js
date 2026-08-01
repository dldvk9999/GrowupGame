/**
 * 봉인의 상점(162) 전용 코스튬 4종 - 슬롯당 1개, "봉인" 테마.
 * 의도적으로 itemCatalog.js의 ITEM_CATALOG(장비 뽑기용 4슬롯×5등급 크로스곱)와
 * 완전히 분리된 별도 배열로 관리함 - 같이 섞으면 "PvP 코스튬 20종 전부 수집" 업적의
 * 모수(20)가 조용히 깨지기 때문(sealed-dungeon.md 참고).
 */
export const SEAL_COSTUME_CATALOG = [
  { itemKey: 'weapon_seal', slot: 'weapon', slotLabel: '무기', icon: '⚔️', name: '봉인의 검', color: '#8a4fff', price: 150 },
  { itemKey: 'armor_seal', slot: 'armor', slotLabel: '보호구', icon: '🛡️', name: '봉인의 갑주', color: '#8a4fff', price: 150 },
  { itemKey: 'gloves_seal', slot: 'gloves', slotLabel: '장갑', icon: '🧤', name: '봉인의 건틀릿', color: '#8a4fff', price: 150 },
  { itemKey: 'shoes_seal', slot: 'shoes', slotLabel: '신발', icon: '👢', name: '봉인의 족갑', color: '#8a4fff', price: 150 },
];

export function getSealCostumeItem(itemKey) {
  return SEAL_COSTUME_CATALOG.find((i) => i.itemKey === itemKey);
}
