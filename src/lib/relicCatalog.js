// 서버 supabase/migrations/119_relic_system.sql의 relic_catalog 시드와 반드시 동일하게 유지할 것.
// effectMode: 'flat'(고정 수치) | 'percent'(비율 %). rarityMult는 itemCatalog.js RARITIES와 동일 배율.
export const RELIC_CATALOG = [
  { relicKey: 'relic_hp_flat_normal', name: '낡은 생명의 유물', icon: '💗', rarity: 'normal', rarityOrder: 1, effectCategory: 'hp', effectMode: 'flat', baseValue: 15, rarityMult: 1.0 },
  { relicKey: 'relic_hp_percent_normal', name: '낡은 심장의 유물', icon: '❤️', rarity: 'normal', rarityOrder: 1, effectCategory: 'hp', effectMode: 'percent', baseValue: 0.8, rarityMult: 1.0 },
  { relicKey: 'relic_atk_flat_normal', name: '낡은 칼날의 유물', icon: '🗡️', rarity: 'normal', rarityOrder: 1, effectCategory: 'atk', effectMode: 'flat', baseValue: 2, rarityMult: 1.0 },
  { relicKey: 'relic_atk_percent_normal', name: '낡은 맹공의 유물', icon: '⚔️', rarity: 'normal', rarityOrder: 1, effectCategory: 'atk', effectMode: 'percent', baseValue: 0.8, rarityMult: 1.0 },
  { relicKey: 'relic_def_flat_normal', name: '낡은 방패의 유물', icon: '🛡️', rarity: 'normal', rarityOrder: 1, effectCategory: 'def', effectMode: 'flat', baseValue: 2, rarityMult: 1.0 },
  { relicKey: 'relic_def_percent_normal', name: '낡은 철벽의 유물', icon: '🔰', rarity: 'normal', rarityOrder: 1, effectCategory: 'def', effectMode: 'percent', baseValue: 0.8, rarityMult: 1.0 },
  { relicKey: 'relic_cooldown_percent_normal', name: '낡은 신속의 유물', icon: '⏱️', rarity: 'normal', rarityOrder: 1, effectCategory: 'cooldown', effectMode: 'percent', baseValue: 0.6, rarityMult: 1.0 },
  { relicKey: 'relic_gold_percent_normal', name: '낡은 재물의 유물', icon: '💰', rarity: 'normal', rarityOrder: 1, effectCategory: 'gold', effectMode: 'percent', baseValue: 0.8, rarityMult: 1.0 },
  { relicKey: 'relic_exp_percent_normal', name: '낡은 지혜의 유물', icon: '📖', rarity: 'normal', rarityOrder: 1, effectCategory: 'exp', effectMode: 'percent', baseValue: 0.8, rarityMult: 1.0 },
  { relicKey: 'relic_buff_percent_normal', name: '낡은 축복의 유물', icon: '✨', rarity: 'normal', rarityOrder: 1, effectCategory: 'buff', effectMode: 'percent', baseValue: 0.8, rarityMult: 1.0 },
  { relicKey: 'relic_hp_flat_rare', name: '빛나는 생명의 유물', icon: '💗', rarity: 'rare', rarityOrder: 2, effectCategory: 'hp', effectMode: 'flat', baseValue: 15, rarityMult: 1.8 },
  { relicKey: 'relic_hp_percent_rare', name: '빛나는 심장의 유물', icon: '❤️', rarity: 'rare', rarityOrder: 2, effectCategory: 'hp', effectMode: 'percent', baseValue: 0.8, rarityMult: 1.8 },
  { relicKey: 'relic_atk_flat_rare', name: '빛나는 칼날의 유물', icon: '🗡️', rarity: 'rare', rarityOrder: 2, effectCategory: 'atk', effectMode: 'flat', baseValue: 2, rarityMult: 1.8 },
  { relicKey: 'relic_atk_percent_rare', name: '빛나는 맹공의 유물', icon: '⚔️', rarity: 'rare', rarityOrder: 2, effectCategory: 'atk', effectMode: 'percent', baseValue: 0.8, rarityMult: 1.8 },
  { relicKey: 'relic_def_flat_rare', name: '빛나는 방패의 유물', icon: '🛡️', rarity: 'rare', rarityOrder: 2, effectCategory: 'def', effectMode: 'flat', baseValue: 2, rarityMult: 1.8 },
  { relicKey: 'relic_def_percent_rare', name: '빛나는 철벽의 유물', icon: '🔰', rarity: 'rare', rarityOrder: 2, effectCategory: 'def', effectMode: 'percent', baseValue: 0.8, rarityMult: 1.8 },
  { relicKey: 'relic_cooldown_percent_rare', name: '빛나는 신속의 유물', icon: '⏱️', rarity: 'rare', rarityOrder: 2, effectCategory: 'cooldown', effectMode: 'percent', baseValue: 0.6, rarityMult: 1.8 },
  { relicKey: 'relic_gold_percent_rare', name: '빛나는 재물의 유물', icon: '💰', rarity: 'rare', rarityOrder: 2, effectCategory: 'gold', effectMode: 'percent', baseValue: 0.8, rarityMult: 1.8 },
  { relicKey: 'relic_exp_percent_rare', name: '빛나는 지혜의 유물', icon: '📖', rarity: 'rare', rarityOrder: 2, effectCategory: 'exp', effectMode: 'percent', baseValue: 0.8, rarityMult: 1.8 },
  { relicKey: 'relic_buff_percent_rare', name: '빛나는 축복의 유물', icon: '✨', rarity: 'rare', rarityOrder: 2, effectCategory: 'buff', effectMode: 'percent', baseValue: 0.8, rarityMult: 1.8 },
  { relicKey: 'relic_hp_flat_epic', name: '찬란한 생명의 유물', icon: '💗', rarity: 'epic', rarityOrder: 3, effectCategory: 'hp', effectMode: 'flat', baseValue: 15, rarityMult: 2.8 },
  { relicKey: 'relic_hp_percent_epic', name: '찬란한 심장의 유물', icon: '❤️', rarity: 'epic', rarityOrder: 3, effectCategory: 'hp', effectMode: 'percent', baseValue: 0.8, rarityMult: 2.8 },
  { relicKey: 'relic_atk_flat_epic', name: '찬란한 칼날의 유물', icon: '🗡️', rarity: 'epic', rarityOrder: 3, effectCategory: 'atk', effectMode: 'flat', baseValue: 2, rarityMult: 2.8 },
  { relicKey: 'relic_atk_percent_epic', name: '찬란한 맹공의 유물', icon: '⚔️', rarity: 'epic', rarityOrder: 3, effectCategory: 'atk', effectMode: 'percent', baseValue: 0.8, rarityMult: 2.8 },
  { relicKey: 'relic_def_flat_epic', name: '찬란한 방패의 유물', icon: '🛡️', rarity: 'epic', rarityOrder: 3, effectCategory: 'def', effectMode: 'flat', baseValue: 2, rarityMult: 2.8 },
  { relicKey: 'relic_def_percent_epic', name: '찬란한 철벽의 유물', icon: '🔰', rarity: 'epic', rarityOrder: 3, effectCategory: 'def', effectMode: 'percent', baseValue: 0.8, rarityMult: 2.8 },
  { relicKey: 'relic_cooldown_percent_epic', name: '찬란한 신속의 유물', icon: '⏱️', rarity: 'epic', rarityOrder: 3, effectCategory: 'cooldown', effectMode: 'percent', baseValue: 0.6, rarityMult: 2.8 },
  { relicKey: 'relic_gold_percent_epic', name: '찬란한 재물의 유물', icon: '💰', rarity: 'epic', rarityOrder: 3, effectCategory: 'gold', effectMode: 'percent', baseValue: 0.8, rarityMult: 2.8 },
  { relicKey: 'relic_exp_percent_epic', name: '찬란한 지혜의 유물', icon: '📖', rarity: 'epic', rarityOrder: 3, effectCategory: 'exp', effectMode: 'percent', baseValue: 0.8, rarityMult: 2.8 },
  { relicKey: 'relic_buff_percent_epic', name: '찬란한 축복의 유물', icon: '✨', rarity: 'epic', rarityOrder: 3, effectCategory: 'buff', effectMode: 'percent', baseValue: 0.8, rarityMult: 2.8 },
  { relicKey: 'relic_hp_flat_legendary', name: '전설의 생명의 유물', icon: '💗', rarity: 'legendary', rarityOrder: 4, effectCategory: 'hp', effectMode: 'flat', baseValue: 15, rarityMult: 4.2 },
  { relicKey: 'relic_hp_percent_legendary', name: '전설의 심장의 유물', icon: '❤️', rarity: 'legendary', rarityOrder: 4, effectCategory: 'hp', effectMode: 'percent', baseValue: 0.8, rarityMult: 4.2 },
  { relicKey: 'relic_atk_flat_legendary', name: '전설의 칼날의 유물', icon: '🗡️', rarity: 'legendary', rarityOrder: 4, effectCategory: 'atk', effectMode: 'flat', baseValue: 2, rarityMult: 4.2 },
  { relicKey: 'relic_atk_percent_legendary', name: '전설의 맹공의 유물', icon: '⚔️', rarity: 'legendary', rarityOrder: 4, effectCategory: 'atk', effectMode: 'percent', baseValue: 0.8, rarityMult: 4.2 },
  { relicKey: 'relic_def_flat_legendary', name: '전설의 방패의 유물', icon: '🛡️', rarity: 'legendary', rarityOrder: 4, effectCategory: 'def', effectMode: 'flat', baseValue: 2, rarityMult: 4.2 },
  { relicKey: 'relic_def_percent_legendary', name: '전설의 철벽의 유물', icon: '🔰', rarity: 'legendary', rarityOrder: 4, effectCategory: 'def', effectMode: 'percent', baseValue: 0.8, rarityMult: 4.2 },
  { relicKey: 'relic_cooldown_percent_legendary', name: '전설의 신속의 유물', icon: '⏱️', rarity: 'legendary', rarityOrder: 4, effectCategory: 'cooldown', effectMode: 'percent', baseValue: 0.6, rarityMult: 4.2 },
  { relicKey: 'relic_gold_percent_legendary', name: '전설의 재물의 유물', icon: '💰', rarity: 'legendary', rarityOrder: 4, effectCategory: 'gold', effectMode: 'percent', baseValue: 0.8, rarityMult: 4.2 },
  { relicKey: 'relic_exp_percent_legendary', name: '전설의 지혜의 유물', icon: '📖', rarity: 'legendary', rarityOrder: 4, effectCategory: 'exp', effectMode: 'percent', baseValue: 0.8, rarityMult: 4.2 },
  { relicKey: 'relic_buff_percent_legendary', name: '전설의 축복의 유물', icon: '✨', rarity: 'legendary', rarityOrder: 4, effectCategory: 'buff', effectMode: 'percent', baseValue: 0.8, rarityMult: 4.2 },
  { relicKey: 'relic_hp_flat_mythic', name: '신화의 생명의 유물', icon: '💗', rarity: 'mythic', rarityOrder: 5, effectCategory: 'hp', effectMode: 'flat', baseValue: 15, rarityMult: 6.5 },
  { relicKey: 'relic_hp_percent_mythic', name: '신화의 심장의 유물', icon: '❤️', rarity: 'mythic', rarityOrder: 5, effectCategory: 'hp', effectMode: 'percent', baseValue: 0.8, rarityMult: 6.5 },
  { relicKey: 'relic_atk_flat_mythic', name: '신화의 칼날의 유물', icon: '🗡️', rarity: 'mythic', rarityOrder: 5, effectCategory: 'atk', effectMode: 'flat', baseValue: 2, rarityMult: 6.5 },
  { relicKey: 'relic_atk_percent_mythic', name: '신화의 맹공의 유물', icon: '⚔️', rarity: 'mythic', rarityOrder: 5, effectCategory: 'atk', effectMode: 'percent', baseValue: 0.8, rarityMult: 6.5 },
  { relicKey: 'relic_def_flat_mythic', name: '신화의 방패의 유물', icon: '🛡️', rarity: 'mythic', rarityOrder: 5, effectCategory: 'def', effectMode: 'flat', baseValue: 2, rarityMult: 6.5 },
  { relicKey: 'relic_def_percent_mythic', name: '신화의 철벽의 유물', icon: '🔰', rarity: 'mythic', rarityOrder: 5, effectCategory: 'def', effectMode: 'percent', baseValue: 0.8, rarityMult: 6.5 },
  { relicKey: 'relic_cooldown_percent_mythic', name: '신화의 신속의 유물', icon: '⏱️', rarity: 'mythic', rarityOrder: 5, effectCategory: 'cooldown', effectMode: 'percent', baseValue: 0.6, rarityMult: 6.5 },
  { relicKey: 'relic_gold_percent_mythic', name: '신화의 재물의 유물', icon: '💰', rarity: 'mythic', rarityOrder: 5, effectCategory: 'gold', effectMode: 'percent', baseValue: 0.8, rarityMult: 6.5 },
  { relicKey: 'relic_exp_percent_mythic', name: '신화의 지혜의 유물', icon: '📖', rarity: 'mythic', rarityOrder: 5, effectCategory: 'exp', effectMode: 'percent', baseValue: 0.8, rarityMult: 6.5 },
  { relicKey: 'relic_buff_percent_mythic', name: '신화의 축복의 유물', icon: '✨', rarity: 'mythic', rarityOrder: 5, effectCategory: 'buff', effectMode: 'percent', baseValue: 0.8, rarityMult: 6.5 },
];

export function getRelic(relicKey) {
  return RELIC_CATALOG.find((r) => r.relicKey === relicKey);
}

export const RELIC_CATEGORY_LABEL = {"hp": "체력", "atk": "공격력", "def": "방어력", "cooldown": "스킬 쿨타임", "gold": "골드 획득", "exp": "경험치 획득", "buff": "버프 효과"};

export const MAX_RELIC_LEVEL = 200;
export const MAX_RELIC_EQUIP = 3;

/** 강화 레벨 반영된 실제 효과치 (server calc_relic_bonus와 동일 공식: base*rarityMult*(1+level*0.03)) */
export function getRelicEffectiveValue(relic, level) {
  return relic.baseValue * relic.rarityMult * (1 + level * 0.03);
}

/** 다음 중복 강화 시도 성공 확률 (server draw_relic과 동일 공식) */
export function getRelicEnhanceSuccessChance(currentLevel) {
  return Math.max(0.30, 1 - currentLevel * 0.0035);
}

/** 효과 설명 텍스트 (예: '공격력 +12.3% 증가') */
export function formatRelicEffect(relic, level = 0) {
  const value = getRelicEffectiveValue(relic, level);
  const unit = relic.effectMode === 'percent' ? '%' : '';
  const verb = relic.effectCategory === 'cooldown' ? '감소' : '증가';
  const sign = relic.effectCategory === 'cooldown' ? '-' : '+';
  return `${RELIC_CATEGORY_LABEL[relic.effectCategory]} ${sign}${value.toFixed(relic.effectMode === 'percent' ? 1 : 0)}${unit} ${verb}`;
}
