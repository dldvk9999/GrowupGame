// supabase/migrations/006 + 017의 skill_catalog 시드와 동일한 값으로 유지할 것.
// type별 base(=power) 해석:
//  - damage: 공격력 배율 / heal: 최대체력 대비 회복비율
//  - stun: 기절 지속시간(초) / dot: 틱당 데미지 배율(ticks, tickInterval과 함께 사용)
//  - buff_atk, buff_def: 스탯 증가 배율(예 0.3 = +30%) / haste: 쿨타임 감소 비율(예 0.3 = -30%)
//  - buff_atk/buff_def/haste는 duration(ms) 동안 지속됨
export const SKILL_CATALOG = [
  // ---------- 노멀 ----------
  { skillKey: 'basic_strike', name: '기본 찌르기', icon: '🗡️', rarity: 'normal', rarityOrder: 1, type: 'damage', base: 1.00, cooldown: 800, description: '기본 공격' },
  { skillKey: 'quick_slash', name: '속사 베기', icon: '💨', rarity: 'normal', rarityOrder: 1, type: 'damage', base: 1.05, cooldown: 900, description: '빠르고 가벼운 연속 베기' },
  { skillKey: 'stone_throw', name: '돌팔매', icon: '🪨', rarity: 'normal', rarityOrder: 1, type: 'damage', base: 1.02, cooldown: 850, description: '돌을 던져 공격' },
  { skillKey: 'double_jab', name: '연속 잽', icon: '👊', rarity: 'normal', rarityOrder: 1, type: 'damage', base: 1.08, cooldown: 950, description: '빠르게 두 번 타격' },
  { skillKey: 'minor_heal', name: '작은 회복', icon: '💧', rarity: 'normal', rarityOrder: 1, type: 'heal', base: 0.10, cooldown: 5000, description: '체력을 소량 회복' },
  { skillKey: 'light_bandage', name: '가벼운 붕대', icon: '🩹', rarity: 'normal', rarityOrder: 1, type: 'heal', base: 0.12, cooldown: 5200, description: '상처를 간단히 감쌈' },
  { skillKey: 'dazing_blow', name: '현기증 강타', icon: '💫', rarity: 'normal', rarityOrder: 1, type: 'stun', base: 1.0, cooldown: 9000, description: '적을 잠시 멍하게 만듦' },
  { skillKey: 'rust_thorn', name: '녹슨 가시', icon: '🥀', rarity: 'normal', rarityOrder: 1, type: 'dot', base: 0.30, cooldown: 7000, ticks: 4, tickInterval: 1500, description: '가시가 박혀 지속 피해' },
  { skillKey: 'battle_cry', name: '기합', icon: '📣', rarity: 'normal', rarityOrder: 1, type: 'buff_atk', base: 0.15, cooldown: 15000, duration: 10000, description: '기합을 넣어 공격력 상승' },
  { skillKey: 'quick_step', name: '재빠른 발놀림', icon: '🌀', rarity: 'normal', rarityOrder: 1, type: 'haste', base: 0.15, cooldown: 20000, duration: 8000, description: '재사용 대기시간 감소' },

  // ---------- 레어 ----------
  { skillKey: 'flame_bolt', name: '화염탄', icon: '🔥', rarity: 'rare', rarityOrder: 2, type: 'damage', base: 1.40, cooldown: 1800, description: '화염 구체를 발사' },
  { skillKey: 'aqua_jet', name: '물살 가르기', icon: '🌊', rarity: 'rare', rarityOrder: 2, type: 'damage', base: 1.45, cooldown: 1900, description: '물살로 강하게 베어냄' },
  { skillKey: 'ice_shard', name: '얼음 파편', icon: '🧊', rarity: 'rare', rarityOrder: 2, type: 'damage', base: 1.42, cooldown: 1750, description: '날카로운 얼음 조각 발사' },
  { skillKey: 'wind_cut', name: '바람가르기', icon: '🍃', rarity: 'rare', rarityOrder: 2, type: 'damage', base: 1.48, cooldown: 1850, description: '바람의 칼날로 베어냄' },
  { skillKey: 'field_heal', name: '야전 치유', icon: '✳️', rarity: 'rare', rarityOrder: 2, type: 'heal', base: 0.15, cooldown: 5500, description: '전투 중 상처를 응급 치료' },
  { skillKey: 'soothing_rain', name: '진정의 비', icon: '🌧️', rarity: 'rare', rarityOrder: 2, type: 'heal', base: 0.17, cooldown: 5600, description: '비가 상처를 씻어내며 회복' },
  { skillKey: 'concussive_wave', name: '뇌진탕 파동', icon: '💢', rarity: 'rare', rarityOrder: 2, type: 'stun', base: 1.3, cooldown: 10000, description: '충격파로 적을 기절시킴' },
  { skillKey: 'venom_spike', name: '맹독 가시', icon: '☠️', rarity: 'rare', rarityOrder: 2, type: 'dot', base: 0.42, cooldown: 7500, ticks: 4, tickInterval: 1500, description: '맹독이 퍼져 지속 피해' },
  { skillKey: 'iron_skin', name: '강철 피부', icon: '🛡️', rarity: 'rare', rarityOrder: 2, type: 'buff_def', base: 0.22, cooldown: 16000, duration: 10000, description: '피부가 강철처럼 단단해짐' },
  { skillKey: 'adrenaline', name: '아드레날린', icon: '💉', rarity: 'rare', rarityOrder: 2, type: 'haste', base: 0.20, cooldown: 20000, duration: 8000, description: '더 빠르게 움직임' },

  // ---------- 에픽 ----------
  { skillKey: 'thunder_strike', name: '뇌격', icon: '⚡', rarity: 'epic', rarityOrder: 3, type: 'damage', base: 1.96, cooldown: 2800, description: '번개를 내리쳐 강타' },
  { skillKey: 'shadow_fang', name: '그림자 송곳니', icon: '🌑', rarity: 'epic', rarityOrder: 3, type: 'damage', base: 2.00, cooldown: 2900, description: '그림자 속에서 급습' },
  { skillKey: 'plasma_burst', name: '플라즈마 폭발', icon: '🔆', rarity: 'epic', rarityOrder: 3, type: 'damage', base: 1.98, cooldown: 2750, description: '고에너지 폭발' },
  { skillKey: 'blade_dance', name: '칼춤', icon: '🗡️', rarity: 'epic', rarityOrder: 3, type: 'damage', base: 2.02, cooldown: 2850, description: '연속 베기 콤보' },
  { skillKey: 'greater_heal', name: '상급 치유', icon: '💠', rarity: 'epic', rarityOrder: 3, type: 'heal', base: 0.20, cooldown: 6000, description: '깊은 상처까지 회복' },
  { skillKey: 'phoenix_feather', name: '불사조 깃털', icon: '🪶', rarity: 'epic', rarityOrder: 3, type: 'heal', base: 0.22, cooldown: 6100, description: '불사조의 깃털이 생명력을 불어넣음' },
  { skillKey: 'gravity_crush', name: '중력 압박', icon: '🌌', rarity: 'epic', rarityOrder: 3, type: 'stun', base: 1.6, cooldown: 11000, description: '중력으로 짓눌러 움직임을 봉인' },
  { skillKey: 'corrosive_mist', name: '부식 안개', icon: '☁️', rarity: 'epic', rarityOrder: 3, type: 'dot', base: 0.60, cooldown: 8000, ticks: 4, tickInterval: 1500, description: '부식성 안개가 서서히 갉아먹음' },
  { skillKey: 'berserk', name: '광폭화', icon: '😤', rarity: 'epic', rarityOrder: 3, type: 'buff_atk', base: 0.30, cooldown: 17000, duration: 10000, description: '이성을 놓고 힘을 폭발시킴' },
  { skillKey: 'time_warp', name: '시간 왜곡', icon: '⏳', rarity: 'epic', rarityOrder: 3, type: 'haste', base: 0.28, cooldown: 21000, duration: 8000, description: '시간의 흐름을 왜곡시켜 가속함' },

  // ---------- 전설 ----------
  { skillKey: 'dragon_roar', name: '용의 포효', icon: '🐲', rarity: 'legendary', rarityOrder: 4, type: 'damage', base: 2.74, cooldown: 4200, description: '용의 기운을 담은 포효' },
  { skillKey: 'void_pierce', name: '공허 관통', icon: '🌀', rarity: 'legendary', rarityOrder: 4, type: 'damage', base: 2.80, cooldown: 4300, description: '차원을 가르는 일격' },
  { skillKey: 'meteor_fall', name: '운석 낙하', icon: '☄️', rarity: 'legendary', rarityOrder: 4, type: 'damage', base: 2.76, cooldown: 4250, description: '하늘에서 운석을 떨어뜨림' },
  { skillKey: 'soul_reap', name: '영혼 수확', icon: '👻', rarity: 'legendary', rarityOrder: 4, type: 'damage', base: 2.82, cooldown: 4350, description: '영혼을 베어내는 일격' },
  { skillKey: 'sanctuary', name: '성역의 가호', icon: '🕊️', rarity: 'legendary', rarityOrder: 4, type: 'heal', base: 0.28, cooldown: 7000, description: '성역의 축복으로 회복' },
  { skillKey: 'divine_light', name: '신성한 빛', icon: '✴️', rarity: 'legendary', rarityOrder: 4, type: 'heal', base: 0.32, cooldown: 7100, description: '신성한 빛이 상처를 치유함' },
  { skillKey: 'chrono_lock', name: '시간 결박', icon: '⏱️', rarity: 'legendary', rarityOrder: 4, type: 'stun', base: 2.0, cooldown: 12000, description: '시간을 멈춰 적을 결박함' },
  { skillKey: 'plague_curse', name: '역병의 저주', icon: '🦠', rarity: 'legendary', rarityOrder: 4, type: 'dot', base: 0.85, cooldown: 8500, ticks: 4, tickInterval: 1500, description: '역병이 온몸에 퍼짐' },
  { skillKey: 'aegis_wall', name: '이지스 방벽', icon: '🏰', rarity: 'legendary', rarityOrder: 4, type: 'buff_def', base: 0.42, cooldown: 18000, duration: 10000, description: '전설의 방패가 몸을 감쌈' },
  { skillKey: 'quicksilver', name: '수은의 가속', icon: '🌠', rarity: 'legendary', rarityOrder: 4, type: 'haste', base: 0.38, cooldown: 22000, duration: 8000, description: '수은처럼 유동적으로 가속함' },

  // ---------- 신화 ----------
  { skillKey: 'world_ender', name: '종말의 일격', icon: '☄️', rarity: 'mythic', rarityOrder: 5, type: 'damage', base: 3.84, cooldown: 6500, description: '세상을 가르는 궁극기' },
  { skillKey: 'genesis_blast', name: '창세의 폭발', icon: '✨', rarity: 'mythic', rarityOrder: 5, type: 'damage', base: 3.90, cooldown: 6600, description: '태초의 힘을 폭발시킴' },
  { skillKey: 'apocalypse', name: '종말의 격류', icon: '🌊', rarity: 'mythic', rarityOrder: 5, type: 'damage', base: 3.86, cooldown: 6600, description: '모든 것을 휩쓰는 격류' },
  { skillKey: 'starfall', name: '별의 추락', icon: '🌟', rarity: 'mythic', rarityOrder: 5, type: 'damage', base: 3.92, cooldown: 6700, description: '별이 떨어져 대지를 강타' },
  { skillKey: 'eternal_life', name: '불멸의 축복', icon: '👑', rarity: 'mythic', rarityOrder: 5, type: 'heal', base: 0.40, cooldown: 9000, description: '불멸에 가까운 회복력' },
  { skillKey: 'genesis_rebirth', name: '창세의 재생', icon: '🌈', rarity: 'mythic', rarityOrder: 5, type: 'heal', base: 0.46, cooldown: 9100, description: '창세의 힘으로 완전히 재생함' },
  { skillKey: 'absolute_zero', name: '절대영도', icon: '❄️', rarity: 'mythic', rarityOrder: 5, type: 'stun', base: 2.5, cooldown: 13000, description: '모든 움직임을 얼려버림' },
  { skillKey: 'entropy_decay', name: '엔트로피 붕괴', icon: '🕳️', rarity: 'mythic', rarityOrder: 5, type: 'dot', base: 1.20, cooldown: 9000, ticks: 4, tickInterval: 1500, description: '존재 자체가 서서히 붕괴함' },
  { skillKey: 'godspeed', name: '신속', icon: '⚡', rarity: 'mythic', rarityOrder: 5, type: 'buff_atk', base: 0.60, cooldown: 19000, duration: 10000, description: '신의 속도로 공격력이 폭증함' },
  { skillKey: 'singularity', name: '특이점', icon: '🕳️', rarity: 'mythic', rarityOrder: 5, type: 'haste', base: 0.50, cooldown: 23000, duration: 8000, description: '특이점이 시간을 압축시킴' },
];

export const RARITY_LABEL = { normal: '노멀', rare: '레어', epic: '에픽', legendary: '전설', mythic: '신화' };
export const RARITY_COLOR = { normal: '#9aa0b8', rare: '#3aa8e0', epic: '#b566e0', legendary: '#f2b705', mythic: '#ff5a7a' };

export function getSkillDef(skillKey) {
  return SKILL_CATALOG.find((s) => s.skillKey === skillKey);
}

/**
 * 스킬레벨(1~100)에 따른 실제 수치(배율/회복비율/기절시간/틱데미지/버프량/쿨감량).
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
        duration: def.duration,
        ticks: def.ticks,
        tickInterval: def.tickInterval,
        description: `${def.description} (Lv.${level})`,
      };
    })
    .filter(Boolean);
}
