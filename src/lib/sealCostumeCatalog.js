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

// (신규, 사용자 요청) 봉인 세트효과 - 4종(무기/갑주/건틀릿/족갑) 전부 "장착"하면
// 실전투 데미지 250% 증폭(총 3.5배: 기존 데미지 + 250%). 순수 코스튬(전투 스탯 무관)
// 설계 원칙을 깨는 예외라 의도적으로 "전부 장착"이라는 무거운 조건(파편 600개 구매 +
// 4슬롯 전부 코스튬으로 채워야 함 - 실장비 코스튬을 포기해야 함)을 걸어서 신중하게 설계함.
export const SEAL_SET_DAMAGE_MULTIPLIER = 3.5; // "250% 증폭" = 기존 100% + 250% = 350%
const SEAL_SET_ITEM_KEYS = SEAL_COSTUME_CATALOG.map((i) => i.itemKey);

/** 봉인 코스튬 4종을 전부 장착 중인지(코스튬 목록 기준, 실제 장비와 무관) */
export function hasFullSealCostumeSet(equippedCostumeKeys) {
  const equipped = new Set(equippedCostumeKeys ?? []);
  return SEAL_SET_ITEM_KEYS.every((key) => equipped.has(key));
}
