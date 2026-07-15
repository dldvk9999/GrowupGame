// supabase/migrations/006의 skill_catalog 시드와 동일한 값으로 유지할 것.
export const SKILL_CATALOG = [
  { skillKey: 'basic_strike', name: '기본 찌르기', icon: '🗡️', rarity: 'normal', rarityOrder: 1, type: 'damage', base: 1.00, cooldown: 800, description: '기본 공격' },
  { skillKey: 'quick_slash', name: '속사 베기', icon: '💨', rarity: 'normal', rarityOrder: 1, type: 'damage', base: 1.05, cooldown: 900, description: '빠르고 가벼운 연속 베기' },
  { skillKey: 'minor_heal', name: '작은 회복', icon: '💧', rarity: 'normal', rarityOrder: 1, type: 'heal', base: 0.10, cooldown: 5000, description: '체력을 소량 회복' },
  { skillKey: 'flame_bolt', name: '화염탄', icon: '🔥', rarity: 'rare', rarityOrder: 2, type: 'damage', base: 1.40, cooldown: 1800, description: '화염 구체를 발사' },
  { skillKey: 'aqua_jet', name: '물살 가르기', icon: '🌊', rarity: 'rare', rarityOrder: 2, type: 'damage', base: 1.45, cooldown: 1900, description: '물살로 강하게 베어냄' },
  { skillKey: 'field_heal', name: '야전 치유', icon: '✳️', rarity: 'rare', rarityOrder: 2, type: 'heal', base: 0.15, cooldown: 5500, description: '전투 중 상처를 응급 치료' },
  { skillKey: 'thunder_strike', name: '뇌격', icon: '⚡', rarity: 'epic', rarityOrder: 3, type: 'damage', base: 1.96, cooldown: 2800, description: '번개를 내리쳐 강타' },
  { skillKey: 'shadow_fang', name: '그림자 송곳니', icon: '🌑', rarity: 'epic', rarityOrder: 3, type: 'damage', base: 2.00, cooldown: 2900, description: '그림자 속에서 급습' },
  { skillKey: 'greater_heal', name: '상급 치유', icon: '💠', rarity: 'epic', rarityOrder: 3, type: 'heal', base: 0.20, cooldown: 6000, description: '깊은 상처까지 회복' },
  { skillKey: 'dragon_roar', name: '용의 포효', icon: '🐲', rarity: 'legendary', rarityOrder: 4, type: 'damage', base: 2.74, cooldown: 4200, description: '용의 기운을 담은 포효' },
  { skillKey: 'void_pierce', name: '공허 관통', icon: '🌀', rarity: 'legendary', rarityOrder: 4, type: 'damage', base: 2.80, cooldown: 4300, description: '차원을 가르는 일격' },
  { skillKey: 'sanctuary', name: '성역의 가호', icon: '🕊️', rarity: 'legendary', rarityOrder: 4, type: 'heal', base: 0.28, cooldown: 7000, description: '성역의 축복으로 회복' },
  { skillKey: 'world_ender', name: '종말의 일격', icon: '☄️', rarity: 'mythic', rarityOrder: 5, type: 'damage', base: 3.84, cooldown: 6500, description: '세상을 가르는 궁극기' },
  { skillKey: 'genesis_blast', name: '창세의 폭발', icon: '✨', rarity: 'mythic', rarityOrder: 5, type: 'damage', base: 3.90, cooldown: 6600, description: '태초의 힘을 폭발시킴' },
  { skillKey: 'eternal_life', name: '불멸의 축복', icon: '👑', rarity: 'mythic', rarityOrder: 5, type: 'heal', base: 0.40, cooldown: 9000, description: '불멸에 가까운 회복력' },
];

export const RARITY_LABEL = { normal: '노멀', rare: '레어', epic: '에픽', legendary: '전설', mythic: '신화' };
export const RARITY_COLOR = { normal: '#9aa0b8', rare: '#3aa8e0', epic: '#b566e0', legendary: '#f2b705', mythic: '#ff5a7a' };

export function getSkillDef(skillKey) {
  return SKILL_CATALOG.find((s) => s.skillKey === skillKey);
}

/**
 * 스킬레벨(1~100)에 따른 실제 배율/회복비율.
 * 레벨100이어도 다음 등급의 "1레벨 기본값"을 못 넘도록 성장폭을 작게 잡음
 * (등급 간 base가 ×1.4씩 벌어져 있고, 레벨100 최대 성장폭은 ×1.297에 불과함)
 */
export function getEffectiveSkillValue(skillDef, skillLevel) {
  return skillDef.base * (1 + (skillLevel - 1) * 0.003);
}

/** 몬스터 레벨에 따른 장착 가능 스킬 슬롯 수 (1~5) */
export function getSkillSlotCount(monsterLevel) {
  if (monsterLevel >= 75) return 5;
  if (monsterLevel >= 50) return 4;
  if (monsterLevel >= 25) return 3;
  if (monsterLevel >= 10) return 2;
  return 1;
}

/**
 * 장착 스킬 키 배열(profiles.equipped_skills) + 보유 스킬(user_skills)을
 * BattleScreen이 바로 쓸 수 있는 스킬 객체 배열로 변환.
 * (기존 5스킬 시스템과 필드 이름을 맞춰서 BattleScreen 로직 재사용: multiplier가 damage 배율이자 heal 비율)
 */
export function resolveLoadout(equippedKeys, userSkills) {
  const levelByKey = new Map((userSkills ?? []).map((s) => [s.skill_key, s.skill_level]));
  return (equippedKeys ?? [])
    .map((key) => {
      const def = getSkillDef(key);
      const level = levelByKey.get(key);
      if (!def || level == null) return null;
      return {
        id: def.skillKey,
        name: def.name,
        icon: def.icon,
        type: def.type,
        multiplier: getEffectiveSkillValue(def, level),
        cooldown: def.cooldown,
        description: `${def.description} (Lv.${level})`,
      };
    })
    .filter(Boolean);
}
