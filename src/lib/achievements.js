import { supabase } from './supabaseClient';

/**
 * 칭호를 주는 업적 -> 칭호 텍스트 매핑. 서버 set_equipped_title RPC의 CASE문과
 * 반드시 동기화되어야 함(한쪽만 고치면 클라 UI에 칭호 버튼이 안 뜨거나, 서버가 거부함).
 */
export const TITLE_BY_ACHIEVEMENT = {
  level_180: '정점의 지배자',
  job_tier_5: '전설의 전사',
  job_tier_10: '조율자의 계승자',
  stage_clear_1000: '차원의 정복자',
  gacha_5000: '행운의 화신',
  pvp_win_50: '투기장의 강자',
  pvp_win_300: '투기장의 지배자',
  attendance_month: '성실한 조련사',
  full_set_equipped: '완벽주의자',
  founder: '얼리버드',
  costume_master: '패셔니스타',
  power_1m: '종말의 위용',
  referral_20: '전도사',
};

/** 칭호 장착/해제 (p_achievement_key가 null이면 해제) */
export async function setEquippedTitle(achievementKey) {
  const { error } = await supabase.rpc('set_equipped_title', { p_achievement_key: achievementKey });
  if (error) throw new Error(error.message);
}


/**
 * 업적 카탈로그 (정적 데이터, 서버 achievement_claims 테이블과 achievement_key로 매칭).
 * checkProgress(stats)는 현재 진행도를 { current, target } 형태로 계산해서 프로그레스바에 씀.
 * stats 구조: { level, jobTier, stageCleared, gachaTotal, pvpWins, attendanceTotal }
 */
export const ACHIEVEMENT_CATALOG = [
  { key: 'level_10', category: 'growth', icon: '🌱', title: '첫걸음', desc: '몬스터 레벨 10 달성', reward: 500, target: 10, stat: 'level' },
  { key: 'level_30', category: 'growth', icon: '🔥', title: '전직의 문턱', desc: '몬스터 레벨 30 달성', reward: 1500, target: 30, stat: 'level' },
  { key: 'level_60', category: 'growth', icon: '⚔️', title: '숙련된 조련사', desc: '몬스터 레벨 60 달성', reward: 3000, target: 60, stat: 'level' },
  { key: 'level_100', category: 'growth', icon: '💪', title: '백의 벽', desc: '몬스터 레벨 100 달성', reward: 6000, target: 100, stat: 'level' },
  { key: 'level_140', category: 'growth', icon: '🌟', title: '초월의 시작', desc: '몬스터 레벨 140 달성', reward: 10000, target: 140, stat: 'level' },
  { key: 'level_180', category: 'growth', icon: '👑', title: '정점에 서다', desc: '몬스터 레벨 180 달성', reward: 20000, target: 180, stat: 'level' },

  { key: 'job_tier_1', category: 'job', icon: '🎖️', title: '1차 전직', desc: '1차 전직 달성', reward: 1000, target: 1, stat: 'jobTier' },
  { key: 'job_tier_3', category: 'job', icon: '🏅', title: '3차 전직', desc: '3차 전직 달성', reward: 5000, target: 3, stat: 'jobTier' },
  { key: 'job_tier_5', category: 'job', icon: '🏆', title: '5차 전직', desc: '5차 전직 달성', reward: 15000, target: 5, stat: 'jobTier' },
  { key: 'job_tier_10', category: 'job', icon: '👑', title: '10차 전직 (최종)', desc: '10차 전직 달성 - 진정한 조율자의 계승자', reward: 100000, target: 10, stat: 'jobTier' },

  { key: 'stage_clear_10', category: 'stage', icon: '🗺️', title: '초보 모험가', desc: '스테이지 10개 클리어', reward: 500, target: 10, stat: 'stageCleared' },
  { key: 'stage_clear_100', category: 'stage', icon: '🧭', title: '숙련 모험가', desc: '스테이지 100개 클리어', reward: 3000, target: 100, stat: 'stageCleared' },
  { key: 'stage_clear_500', category: 'stage', icon: '🏔️', title: '베테랑 모험가', desc: '스테이지 500개 클리어', reward: 15000, target: 500, stat: 'stageCleared' },
  { key: 'stage_clear_1000', category: 'stage', icon: '🌌', title: '차원의 정복자', desc: '스테이지 1000개(전체) 클리어', reward: 40000, target: 1000, stat: 'stageCleared' },

  { key: 'gacha_100', category: 'gacha', icon: '🎰', title: '뽑기 입문', desc: '스킬+장비 통산 뽑기 100회', reward: 1000, target: 100, stat: 'gachaTotal' },
  { key: 'gacha_1000', category: 'gacha', icon: '🎲', title: '뽑기 중독', desc: '스킬+장비 통산 뽑기 1,000회', reward: 5000, target: 1000, stat: 'gachaTotal' },
  { key: 'gacha_5000', category: 'gacha', icon: '💎', title: '뽑기의 화신', desc: '스킬+장비 통산 뽑기 5,000회', reward: 20000, target: 5000, stat: 'gachaTotal' },

  { key: 'skill_collector', category: 'gacha', icon: '📚', title: '만능 마스터', desc: '스킬 50종 전부 보유하기', reward: 25000, target: 50, stat: 'ownedSkillCount' },

  { key: 'pvp_win_1', category: 'pvp', icon: '🎯', title: '첫 승리', desc: 'PvP 첫 승 달성', reward: 300, target: 1, stat: 'pvpWins' },
  { key: 'pvp_win_10', category: 'pvp', icon: '🥊', title: '투기장 신인', desc: 'PvP 10승 달성', reward: 1500, target: 10, stat: 'pvpWins' },
  { key: 'pvp_win_50', category: 'pvp', icon: '⚡', title: '투기장 강자', desc: 'PvP 50승 달성', reward: 6000, target: 50, stat: 'pvpWins' },

  { key: 'pvp_win_100', category: 'pvp', icon: '👑', title: '투기장의 전설', desc: 'PvP 100승 달성 (다이아몬드 티어)', reward: 25000, target: 100, stat: 'pvpWins' },
  { key: 'pvp_win_300', category: 'pvp', icon: '🏛️', title: '투기장의 지배자', desc: 'PvP 300승 달성', reward: 40000, target: 300, stat: 'pvpWins' },

  { key: 'pvp_revenge_10', category: 'pvp', icon: '🔁', title: '복수의 화신', desc: '복수전 10승 달성', reward: 8000, target: 10, stat: 'revengeWins' },

  { key: 'lifetime_gold_1m', category: 'special', icon: '💵', title: '동전 모으기', desc: '누적 골드 획득 1,000,000 달성 (지금 보유액이 아니라 지금까지 번 총액)', reward: 2000, target: 1000000, stat: 'lifetimeGold' },
  { key: 'lifetime_gold_50m', category: 'special', icon: '💰', title: '골드러시', desc: '누적 골드 획득 50,000,000 달성', reward: 15000, target: 50000000, stat: 'lifetimeGold' },
  { key: 'lifetime_gold_500m', category: 'special', icon: '🏦', title: '재벌 조련사', desc: '누적 골드 획득 500,000,000 달성', reward: 50000, target: 500000000, stat: 'lifetimeGold' },

  { key: 'world_boss_participate', category: 'worldboss', icon: '🐉', title: '용과의 조우', desc: '월드보스에게 피해를 입혀보기', reward: 500, target: 1, stat: 'worldBossDamage' },

  { key: 'worldboss_damage_30m', category: 'worldboss', icon: '🗡️', title: '용의 사냥꾼', desc: '월드보스 누적 피해량 30,000,000 달성', reward: 8000, target: 30000000, stat: 'worldBossTotalDamage' },
  { key: 'worldboss_damage_300m', category: 'worldboss', icon: '🐲', title: '용살자', desc: '월드보스 누적 피해량 300,000,000 달성', reward: 40000, target: 300000000, stat: 'worldBossTotalDamage' },

  { key: 'full_set_equipped', category: 'gear', icon: '🎽', title: '완벽한 세트', desc: '4슬롯을 전부 같은 등급으로 장착하기', reward: 3000, target: 1, stat: 'fullSetEquipped' },
  { key: 'equip_collection_10', category: 'gear', icon: '📦', title: '수집가의 눈', desc: '역대 보유한 고유 장비 10종 달성 (20종 중)', reward: 4000, target: 10, stat: 'uniqueItemCount' },
  { key: 'equip_collection_20', category: 'gear', icon: '🏛️', title: '장비 명예의 전당', desc: '4슬롯×5등급 장비를 전부 한 번씩 보유하기 (20/20)', reward: 20000, target: 20, stat: 'uniqueItemCount' },

  { key: 'relic_collector', category: 'special', icon: '🏺', title: '유물 수집가', desc: '유물 20종 보유 (50종 중)', reward: 6000, target: 20, stat: 'relicCount' },
  { key: 'relic_master', category: 'special', icon: '💎', title: '유물의 대가', desc: '유물 하나를 200강까지 강화', reward: 30000, target: 200, stat: 'maxRelicLevel' },

  { key: 'max_enhance', category: 'gear', icon: '🔨', title: '만렙 대장장이', desc: '장비 하나를 +1000까지 강화하기', reward: 30000, target: 1000, stat: 'maxEnhanceLevel' },

  { key: 'costume_collector', category: 'gear', icon: '👗', title: '코스튬 수집가', desc: 'PvP 코스튬 5종 이상 보유하기', reward: 2000, target: 5, stat: 'costumeCount' },
  { key: 'costume_master', category: 'gear', icon: '👑', title: '패셔니스타', desc: 'PvP 코스튬 20종 전부 수집하기', reward: 10000, target: 20, stat: 'costumeCount' },

  { key: 'power_10k', category: 'special', icon: '💪', title: '강자의 서막', desc: '전투력 10,000 달성', reward: 3000, target: 10000, stat: 'combatPower' },
  { key: 'power_100k', category: 'special', icon: '🔱', title: '압도적인 힘', desc: '전투력 100,000 달성', reward: 12000, target: 100000, stat: 'combatPower' },
  { key: 'power_1m', category: 'special', icon: '☄️', title: '종말의 위용', desc: '전투력 1,000,000 달성', reward: 50000, target: 1000000, stat: 'combatPower' },

  { key: 'dungeon_depth_100', category: 'stage', icon: '🏰', title: '던전 탐험가', desc: '경험치/골드 던전 100층 돌파', reward: 5000, target: 100, stat: 'dungeonDepth' },
  { key: 'dungeon_depth_300', category: 'stage', icon: '🕯️', title: '던전 정복자', desc: '경험치/골드 던전 300층 돌파', reward: 20000, target: 300, stat: 'dungeonDepth' },
  { key: 'dungeon_depth_500', category: 'stage', icon: '👹', title: '심연의 지배자', desc: '경험치/골드 던전 500층 완주', reward: 80000, target: 500, stat: 'dungeonDepth' },

  { key: 'referral_5', category: 'special', icon: '🌱', title: '작은 씨앗', desc: '친구 5명 추천 성공', reward: 5000, target: 5, stat: 'referralCount' },
  { key: 'referral_20', category: 'special', icon: '🌳', title: '전도사', desc: '친구 20명 추천 성공', reward: 25000, target: 20, stat: 'referralCount' },

  { key: 'attendance_week', category: 'attendance', icon: '📅', title: '일주일 개근', desc: '누적 출석 7회', reward: 2000, target: 7, stat: 'attendanceTotal' },
  { key: 'attendance_month', category: 'attendance', icon: '🗓️', title: '한달 개근', desc: '누적 출석 30회', reward: 10000, target: 30, stat: 'attendanceTotal' },
  { key: 'attendance_100', category: 'attendance', icon: '💯', title: '백일기도', desc: '누적 출석 100회', reward: 30000, target: 100, stat: 'attendanceTotal' },
  { key: 'attendance_200', category: 'attendance', icon: '🏵️', title: '영원한 동반자', desc: '누적 출석 200회', reward: 60000, target: 200, stat: 'attendanceTotal' },

  { key: 'attendance_365', category: 'attendance', icon: '🎂', title: '1년의 여정', desc: '누적 출석 365회', reward: 120000, target: 365, stat: 'attendanceTotal' },

  { key: 'founder', category: 'special', icon: '🌟', title: '얼리버드', desc: '2026년 8월 1일 이전 가입', reward: 5000, target: 1, stat: 'isFounder' },

  { key: 'tower_10', category: 'special', icon: '🗼', title: '탑의 초입', desc: '무한의 탑 10층 돌파', reward: 4000, target: 10, stat: 'towerHighestFloor' },
  { key: 'tower_30', category: 'special', icon: '🏯', title: '구름 위 수련자', desc: '무한의 탑 30층 돌파', reward: 15000, target: 30, stat: 'towerHighestFloor' },

  { key: 'tower_100', category: 'special', icon: '🌌', title: '천공의 도전자', desc: '무한의 탑 100층 돌파', reward: 60000, target: 100, stat: 'towerHighestFloor' },
  { key: 'streak_10', category: 'special', icon: '🔥', title: '겁 없는 도전자', desc: '연승 던전 10연승 달성', reward: 4000, target: 10, stat: 'streakBest' },
  { key: 'streak_25', category: 'special', icon: '🎲', title: '멈출 줄 모르는 승부사', desc: '연승 던전 25연승 달성', reward: 18000, target: 25, stat: 'streakBest' },
  { key: 'streak_50', category: 'special', icon: '👹', title: '불멸의 연승왕', desc: '연승 던전 50연승 달성', reward: 70000, target: 50, stat: 'streakBest' },
  { key: 'seal_fragments_100', category: 'special', icon: '🧩', title: '봉인의 수집가', desc: '봉인의 파편 100개 이상 누적', reward: 3000, target: 100, stat: 'sealFragments' },
  { key: 'seal_fragments_500', category: 'special', icon: '🗝️', title: '봉인 해제자', desc: '봉인의 파편 500개 이상 누적', reward: 15000, target: 500, stat: 'sealFragments' },
  { key: 'seal_fragments_2000', category: 'special', icon: '🌌', title: '봉인 파괴자', desc: '봉인의 파편 2000개 이상 누적', reward: 60000, target: 2000, stat: 'sealFragments' },
  { key: 'seal_costume_set', category: 'gear', icon: '🗝️', title: '봉인의 계승자', desc: '봉인의 상점 코스튬 4종 전부 구매', reward: 8000, target: 4, stat: 'sealCostumeCount' },

  // ---- 아래부터 대량 추가된 업적(사용자 요청 - 총 약 200개로 확장) ----
  { key: 'level_20', category: 'growth', icon: '🌿', title: '작은 성장', desc: '몬스터 레벨 20 달성', reward: 1500, target: 20, stat: 'level' },
  { key: 'level_40', category: 'growth', icon: '🔥', title: '불타는 의지', desc: '몬스터 레벨 40 달성', reward: 2500, target: 40, stat: 'level' },
  { key: 'level_50', category: 'growth', icon: '⛰️', title: '반환점', desc: '몬스터 레벨 50 달성', reward: 2800, target: 50, stat: 'level' },
  { key: 'level_70', category: 'growth', icon: '🌊', title: '흐름을 타다', desc: '몬스터 레벨 70 달성', reward: 4200, target: 70, stat: 'level' },
  { key: 'level_80', category: 'growth', icon: '💠', title: '다듬어진 힘', desc: '몬스터 레벨 80 달성', reward: 4800, target: 80, stat: 'level' },
  { key: 'level_90', category: 'growth', icon: '🌪️', title: '폭풍의 전조', desc: '몬스터 레벨 90 달성', reward: 5500, target: 90, stat: 'level' },
  { key: 'level_110', category: 'growth', icon: '✨', title: '빛나는 재능', desc: '몬스터 레벨 110 달성', reward: 7000, target: 110, stat: 'level' },
  { key: 'level_120', category: 'growth', icon: '🎇', title: '불꽃의 절정', desc: '몬스터 레벨 120 달성', reward: 8000, target: 120, stat: 'level' },
  { key: 'level_150', category: 'growth', icon: '🌈', title: '무지개 너머', desc: '몬스터 레벨 150 달성', reward: 12000, target: 150, stat: 'level' },
  { key: 'level_160', category: 'growth', icon: '🏹', title: '정예의 반열', desc: '몬스터 레벨 160 달성', reward: 13500, target: 160, stat: 'level' },
  { key: 'level_170', category: 'growth', icon: '🗡️', title: '칼날의 경지', desc: '몬스터 레벨 170 달성', reward: 15000, target: 170, stat: 'level' },
  { key: 'level_190', category: 'growth', icon: '🛡️', title: '철벽의 수호자', desc: '몬스터 레벨 190 달성', reward: 22000, target: 190, stat: 'level' },
  { key: 'level_200', category: 'growth', icon: '👑', title: '이백의 벽', desc: '몬스터 레벨 200 달성', reward: 24000, target: 200, stat: 'level' },
  { key: 'level_220', category: 'growth', icon: '🌠', title: '유성의 궤적', desc: '몬스터 레벨 220 달성', reward: 30000, target: 220, stat: 'level' },
  { key: 'level_250', category: 'growth', icon: '🔮', title: '신비의 영역', desc: '몬스터 레벨 250 달성', reward: 38000, target: 250, stat: 'level' },
  { key: 'level_280', category: 'growth', icon: '⚡', title: '벼락의 화신', desc: '몬스터 레벨 280 달성', reward: 45000, target: 280, stat: 'level' },
  { key: 'level_300', category: 'growth', icon: '🌌', title: '삼백의 전설', desc: '몬스터 레벨 300 달성', reward: 55000, target: 300, stat: 'level' },
  { key: 'level_350', category: 'growth', icon: '🏔️', title: '태산을 넘어', desc: '몬스터 레벨 350 달성', reward: 75000, target: 350, stat: 'level' },
  { key: 'level_400', category: 'growth', icon: '☀️', title: '태양의 반열', desc: '몬스터 레벨 400 달성', reward: 95000, target: 400, stat: 'level' },
  { key: 'level_450', category: 'growth', icon: '🌙', title: '달빛 수호자', desc: '몬스터 레벨 450 달성', reward: 120000, target: 450, stat: 'level' },
  { key: 'level_500', category: 'growth', icon: '💫', title: '만렙의 정점', desc: '몬스터 레벨 500 달성', reward: 150000, target: 500, stat: 'level' },
  { key: 'job_tier_2', category: 'job', icon: '🎖️', title: '2차 전직', desc: '2차 전직 달성', reward: 2500, target: 2, stat: 'jobTier' },
  { key: 'job_tier_4', category: 'job', icon: '🏅', title: '4차 전직', desc: '4차 전직 달성', reward: 9000, target: 4, stat: 'jobTier' },
  { key: 'job_tier_6', category: 'job', icon: '⚜️', title: '6차 전직', desc: '6차 전직 달성', reward: 28000, target: 6, stat: 'jobTier' },
  { key: 'job_tier_7', category: 'job', icon: '🔱', title: '7차 전직', desc: '7차 전직 달성', reward: 42000, target: 7, stat: 'jobTier' },
  { key: 'job_tier_8', category: 'job', icon: '👁️', title: '8차 전직', desc: '8차 전직 달성', reward: 60000, target: 8, stat: 'jobTier' },
  { key: 'job_tier_9', category: 'job', icon: '🌀', title: '9차 전직', desc: '9차 전직 달성', reward: 80000, target: 9, stat: 'jobTier' },
  { key: 'stage_clear_25', category: 'stage', icon: '🗺️', title: '길 위의 초심자', desc: '스테이지 25개 클리어', reward: 800, target: 25, stat: 'stageCleared' },
  { key: 'stage_clear_50', category: 'stage', icon: '🧭', title: '나침반의 주인', desc: '스테이지 50개 클리어', reward: 1500, target: 50, stat: 'stageCleared' },
  { key: 'stage_clear_150', category: 'stage', icon: '🏞️', title: '산맥을 넘어', desc: '스테이지 150개 클리어', reward: 4500, target: 150, stat: 'stageCleared' },
  { key: 'stage_clear_200', category: 'stage', icon: '🏕️', title: '야영지의 전설', desc: '스테이지 200개 클리어', reward: 6000, target: 200, stat: 'stageCleared' },
  { key: 'stage_clear_300', category: 'stage', icon: '🌋', title: '화산 지대 정복', desc: '스테이지 300개 클리어', reward: 9000, target: 300, stat: 'stageCleared' },
  { key: 'stage_clear_400', category: 'stage', icon: '🏜️', title: '사막을 건너', desc: '스테이지 400개 클리어', reward: 13000, target: 400, stat: 'stageCleared' },
  { key: 'stage_clear_600', category: 'stage', icon: '🌊', title: '대양을 가르다', desc: '스테이지 600개 클리어', reward: 22000, target: 600, stat: 'stageCleared' },
  { key: 'stage_clear_700', category: 'stage', icon: '🗻', title: '설산 정복자', desc: '스테이지 700개 클리어', reward: 27000, target: 700, stat: 'stageCleared' },
  { key: 'stage_clear_800', category: 'stage', icon: '🌌', title: '은하의 끝에서', desc: '스테이지 800개 클리어', reward: 32000, target: 800, stat: 'stageCleared' },
  { key: 'stage_clear_900', category: 'stage', icon: '🕳️', title: '차원의 문턱', desc: '스테이지 900개 클리어', reward: 36000, target: 900, stat: 'stageCleared' },
  { key: 'gacha_250', category: 'gacha', icon: '🎟️', title: '뽑기 초보 탈출', desc: '스킬+장비 통산 뽑기 250회', reward: 1300, target: 250, stat: 'gachaTotal' },
  { key: 'gacha_500', category: 'gacha', icon: '🎫', title: '뽑기 애호가', desc: '스킬+장비 통산 뽑기 500회', reward: 2200, target: 500, stat: 'gachaTotal' },
  { key: 'gacha_2000', category: 'gacha', icon: '🎰', title: '뽑기 마니아', desc: '스킬+장비 통산 뽑기 2,000회', reward: 8000, target: 2000, stat: 'gachaTotal' },
  { key: 'gacha_3000', category: 'gacha', icon: '🎲', title: '뽑기 베테랑', desc: '스킬+장비 통산 뽑기 3,000회', reward: 11000, target: 3000, stat: 'gachaTotal' },
  { key: 'gacha_7500', category: 'gacha', icon: '🃏', title: '뽑기 장인', desc: '스킬+장비 통산 뽑기 7,500회', reward: 16000, target: 7500, stat: 'gachaTotal' },
  { key: 'gacha_10000', category: 'gacha', icon: '💠', title: '만 번의 손길', desc: '스킬+장비 통산 뽑기 10,000회', reward: 28000, target: 10000, stat: 'gachaTotal' },
  { key: 'gacha_15000', category: 'gacha', icon: '🌟', title: '뽑기의 구도자', desc: '스킬+장비 통산 뽑기 15,000회', reward: 35000, target: 15000, stat: 'gachaTotal' },
  { key: 'gacha_20000', category: 'gacha', icon: '👑', title: '뽑기의 제왕', desc: '스킬+장비 통산 뽑기 20,000회', reward: 45000, target: 20000, stat: 'gachaTotal' },
  { key: 'pvp_win_5', category: 'pvp', icon: '🥋', title: '다섯 번의 승리', desc: 'PvP 5승 달성', reward: 700, target: 5, stat: 'pvpWins' },
  { key: 'pvp_win_25', category: 'pvp', icon: '🎯', title: '투기장 유망주', desc: 'PvP 25승 달성', reward: 3200, target: 25, stat: 'pvpWins' },
  { key: 'pvp_win_75', category: 'pvp', icon: '⚔️', title: '투기장 숙련자', desc: 'PvP 75승 달성', reward: 9500, target: 75, stat: 'pvpWins' },
  { key: 'pvp_win_150', category: 'pvp', icon: '🛡️', title: '투기장 정예', desc: 'PvP 150승 달성', reward: 16000, target: 150, stat: 'pvpWins' },
  { key: 'pvp_win_200', category: 'pvp', icon: '🔥', title: '투기장 파괴자', desc: 'PvP 200승 달성', reward: 20000, target: 200, stat: 'pvpWins' },
  { key: 'pvp_win_250', category: 'pvp', icon: '💥', title: '연전연승', desc: 'PvP 250승 달성', reward: 30000, target: 250, stat: 'pvpWins' },
  { key: 'pvp_win_400', category: 'pvp', icon: '🏹', title: '투기장 지배자의 길', desc: 'PvP 400승 달성', reward: 45000, target: 400, stat: 'pvpWins' },
  { key: 'pvp_win_500', category: 'pvp', icon: '👹', title: '오백승의 위엄', desc: 'PvP 500승 달성', reward: 60000, target: 500, stat: 'pvpWins' },
  { key: 'pvp_win_750', category: 'pvp', icon: '🌪️', title: '투기장의 재앙', desc: 'PvP 750승 달성', reward: 80000, target: 750, stat: 'pvpWins' },
  { key: 'pvp_win_1000', category: 'pvp', icon: '👑', title: '천 번의 승리', desc: 'PvP 1000승 달성', reward: 120000, target: 1000, stat: 'pvpWins' },
  { key: 'pvp_revenge_1', category: 'pvp', icon: '🔁', title: '첫 복수', desc: '복수전 1승 달성', reward: 400, target: 1, stat: 'revengeWins' },
  { key: 'pvp_revenge_5', category: 'pvp', icon: '🔂', title: '복수의 시작', desc: '복수전 5승 달성', reward: 2000, target: 5, stat: 'revengeWins' },
  { key: 'pvp_revenge_25', category: 'pvp', icon: '⚔️', title: '되갚음의 달인', desc: '복수전 25승 달성', reward: 9000, target: 25, stat: 'revengeWins' },
  { key: 'pvp_revenge_50', category: 'pvp', icon: '💢', title: '복수귀', desc: '복수전 50승 달성', reward: 16000, target: 50, stat: 'revengeWins' },
  { key: 'pvp_revenge_100', category: 'pvp', icon: '👹', title: '복수의 화신 II', desc: '복수전 100승 달성', reward: 28000, target: 100, stat: 'revengeWins' },
  { key: 'lifetime_gold_100000', category: 'special', icon: '🪙', title: '첫 재산', desc: '누적 골드 획득 100,000 달성', reward: 300, target: 100000, stat: 'lifetimeGold' },
  { key: 'lifetime_gold_5000000', category: 'special', icon: '💵', title: '동전 부자', desc: '누적 골드 획득 5,000,000 달성', reward: 4000, target: 5000000, stat: 'lifetimeGold' },
  { key: 'lifetime_gold_10000000', category: 'special', icon: '💴', title: '금고를 채우다', desc: '누적 골드 획득 10,000,000 달성', reward: 7000, target: 10000000, stat: 'lifetimeGold' },
  { key: 'lifetime_gold_20000000', category: 'special', icon: '💶', title: '창고지기', desc: '누적 골드 획득 20,000,000 달성', reward: 10000, target: 20000000, stat: 'lifetimeGold' },
  { key: 'lifetime_gold_100000000', category: 'special', icon: '💷', title: '억만장자의 길', desc: '누적 골드 획득 100,000,000 달성', reward: 22000, target: 100000000, stat: 'lifetimeGold' },
  { key: 'lifetime_gold_200000000', category: 'special', icon: '🏦', title: '금고 관리인', desc: '누적 골드 획득 200,000,000 달성', reward: 32000, target: 200000000, stat: 'lifetimeGold' },
  { key: 'lifetime_gold_300000000', category: 'special', icon: '💰', title: '재물의 수호자', desc: '누적 골드 획득 300,000,000 달성', reward: 42000, target: 300000000, stat: 'lifetimeGold' },
  { key: 'lifetime_gold_1000000000', category: 'special', icon: '🏛️', title: '십억의 탑', desc: '누적 골드 획득 1,000,000,000 달성', reward: 75000, target: 1000000000, stat: 'lifetimeGold' },
  { key: 'lifetime_gold_2000000000', category: 'special', icon: '👑', title: '재벌의 왕좌', desc: '누적 골드 획득 2,000,000,000 달성', reward: 110000, target: 2000000000, stat: 'lifetimeGold' },
  { key: 'lifetime_gold_5000000000', category: 'special', icon: '🌟', title: '전설의 곳간', desc: '누적 골드 획득 5,000,000,000 달성', reward: 170000, target: 5000000000, stat: 'lifetimeGold' },
  { key: 'worldboss_damage_1000000', category: 'worldboss', icon: '🐾', title: '용의 흔적', desc: '월드보스 누적 피해량 1,000,000 달성', reward: 700, target: 1000000, stat: 'worldBossTotalDamage' },
  { key: 'worldboss_damage_5000000', category: 'worldboss', icon: '🗡️', title: '용의 상처', desc: '월드보스 누적 피해량 5,000,000 달성', reward: 2500, target: 5000000, stat: 'worldBossTotalDamage' },
  { key: 'worldboss_damage_10000000', category: 'worldboss', icon: '⚔️', title: '용맹한 도전자', desc: '월드보스 누적 피해량 10,000,000 달성', reward: 4500, target: 10000000, stat: 'worldBossTotalDamage' },
  { key: 'worldboss_damage_50000000', category: 'worldboss', icon: '🔥', title: '불꽃의 사냥꾼', desc: '월드보스 누적 피해량 50,000,000 달성', reward: 14000, target: 50000000, stat: 'worldBossTotalDamage' },
  { key: 'worldboss_damage_100000000', category: 'worldboss', icon: '🌪️', title: '폭풍의 사냥꾼', desc: '월드보스 누적 피해량 100,000,000 달성', reward: 24000, target: 100000000, stat: 'worldBossTotalDamage' },
  { key: 'worldboss_damage_150000000', category: 'worldboss', icon: '🐲', title: '용살자의 길', desc: '월드보스 누적 피해량 150,000,000 달성', reward: 32000, target: 150000000, stat: 'worldBossTotalDamage' },
  { key: 'worldboss_damage_200000000', category: 'worldboss', icon: '👹', title: '용살자 II', desc: '월드보스 누적 피해량 200,000,000 달성', reward: 38000, target: 200000000, stat: 'worldBossTotalDamage' },
  { key: 'worldboss_damage_500000000', category: 'worldboss', icon: '🌌', title: '드래곤 슬레이어', desc: '월드보스 누적 피해량 500,000,000 달성', reward: 70000, target: 500000000, stat: 'worldBossTotalDamage' },
  { key: 'worldboss_damage_600000000', category: 'worldboss', icon: '💫', title: '전설의 용살자', desc: '월드보스 누적 피해량 600,000,000 달성', reward: 82000, target: 600000000, stat: 'worldBossTotalDamage' },
  { key: 'worldboss_damage_1000000000', category: 'worldboss', icon: '👑', title: '드래곤 로드', desc: '월드보스 누적 피해량 1,000,000,000 달성', reward: 130000, target: 1000000000, stat: 'worldBossTotalDamage' },
  { key: 'equip_collection_5', category: 'gear', icon: '📦', title: '수집의 시작', desc: '역대 보유한 고유 장비 5종 달성 (20종 중)', reward: 1800, target: 5, stat: 'uniqueItemCount' },
  { key: 'equip_collection_15', category: 'gear', icon: '🏛️', title: '명예의 전당 입성', desc: '역대 보유한 고유 장비 15종 달성 (20종 중)', reward: 12000, target: 15, stat: 'uniqueItemCount' },
  { key: 'relic_collector_5', category: 'special', icon: '🏺', title: '첫 유물', desc: '유물 5종 보유 (50종 중)', reward: 1000, target: 5, stat: 'relicCount' },
  { key: 'relic_collector_10', category: 'special', icon: '⚱️', title: '유물 애호가', desc: '유물 10종 보유 (50종 중)', reward: 2500, target: 10, stat: 'relicCount' },
  { key: 'relic_collector_30', category: 'special', icon: '🗿', title: '유물 감정가', desc: '유물 30종 보유 (50종 중)', reward: 12000, target: 30, stat: 'relicCount' },
  { key: 'relic_collector_40', category: 'special', icon: '💠', title: '유물 학자', desc: '유물 40종 보유 (50종 중)', reward: 20000, target: 40, stat: 'relicCount' },
  { key: 'relic_collector_50', category: 'special', icon: '👑', title: '유물 명예의 전당', desc: '유물 50종 보유 (50종 중)', reward: 35000, target: 50, stat: 'relicCount' },
  { key: 'relic_master_25', category: 'special', icon: '💎', title: '유물 연마 I', desc: '유물 하나를 25강까지 강화', reward: 3000, target: 25, stat: 'maxRelicLevel' },
  { key: 'relic_master_50', category: 'special', icon: '💎', title: '유물 연마 II', desc: '유물 하나를 50강까지 강화', reward: 7000, target: 50, stat: 'maxRelicLevel' },
  { key: 'relic_master_75', category: 'special', icon: '💎', title: '유물 연마 III', desc: '유물 하나를 75강까지 강화', reward: 13000, target: 75, stat: 'maxRelicLevel' },
  { key: 'relic_master_100', category: 'special', icon: '💎', title: '유물 연마 IV', desc: '유물 하나를 100강까지 강화', reward: 20000, target: 100, stat: 'maxRelicLevel' },
  { key: 'relic_master_150', category: 'special', icon: '💎', title: '유물 연마 V', desc: '유물 하나를 150강까지 강화', reward: 27000, target: 150, stat: 'maxRelicLevel' },
  { key: 'max_enhance_100', category: 'gear', icon: '🔨', title: '견습 대장장이', desc: '장비 하나를 +100까지 강화하기', reward: 3000, target: 100, stat: 'maxEnhanceLevel' },
  { key: 'max_enhance_300', category: 'gear', icon: '⚒️', title: '숙련 대장장이', desc: '장비 하나를 +300까지 강화하기', reward: 9000, target: 300, stat: 'maxEnhanceLevel' },
  { key: 'max_enhance_500', category: 'gear', icon: '🛠️', title: '명장 대장장이', desc: '장비 하나를 +500까지 강화하기', reward: 16000, target: 500, stat: 'maxEnhanceLevel' },
  { key: 'max_enhance_700', category: 'gear', icon: '🔥', title: '전설의 대장장이', desc: '장비 하나를 +700까지 강화하기', reward: 22000, target: 700, stat: 'maxEnhanceLevel' },
  { key: 'costume_collector_1', category: 'gear', icon: '👘', title: '첫 코스튬', desc: 'PvP 코스튬 1종 이상 보유하기', reward: 500, target: 1, stat: 'costumeCount' },
  { key: 'costume_collector_10', category: 'gear', icon: '👔', title: '옷장 정리', desc: 'PvP 코스튬 10종 이상 보유하기', reward: 4000, target: 10, stat: 'costumeCount' },
  { key: 'costume_collector_15', category: 'gear', icon: '🧥', title: '패션 감각', desc: 'PvP 코스튬 15종 이상 보유하기', reward: 7000, target: 15, stat: 'costumeCount' },
  { key: 'power_1000', category: 'special', icon: '🌱', title: '첫 힘', desc: '전투력 1,000 달성', reward: 500, target: 1000, stat: 'combatPower' },
  { key: 'power_5000', category: 'special', icon: '💪', title: '자라나는 힘', desc: '전투력 5,000 달성', reward: 1800, target: 5000, stat: 'combatPower' },
  { key: 'power_50000', category: 'special', icon: '🔱', title: '강자의 반열', desc: '전투력 50,000 달성', reward: 7000, target: 50000, stat: 'combatPower' },
  { key: 'power_300000', category: 'special', icon: '⚡', title: '압도적 존재감', desc: '전투력 300,000 달성', reward: 20000, target: 300000, stat: 'combatPower' },
  { key: 'power_500000', category: 'special', icon: '🌪️', title: '폭풍의 힘', desc: '전투력 500,000 달성', reward: 32000, target: 500000, stat: 'combatPower' },
  { key: 'power_3000000', category: 'special', icon: '☄️', title: '별을 부수는 힘', desc: '전투력 3,000,000 달성', reward: 65000, target: 3000000, stat: 'combatPower' },
  { key: 'power_5000000', category: 'special', icon: '🌌', title: '우주적 존재', desc: '전투력 5,000,000 달성', reward: 85000, target: 5000000, stat: 'combatPower' },
  { key: 'power_10000000', category: 'special', icon: '👑', title: '신화급 존재', desc: '전투력 10,000,000 달성', reward: 120000, target: 10000000, stat: 'combatPower' },
  { key: 'power_50000000', category: 'special', icon: '💫', title: '절대자', desc: '전투력 50,000,000 달성', reward: 160000, target: 50000000, stat: 'combatPower' },
  { key: 'power_100000000', category: 'special', icon: '♾️', title: '무한의 힘', desc: '전투력 100,000,000 달성', reward: 200000, target: 100000000, stat: 'combatPower' },
  { key: 'dungeon_depth_10', category: 'stage', icon: '🕳️', title: '던전 입구', desc: '경험치/골드 던전 10층 돌파', reward: 500, target: 10, stat: 'dungeonDepth' },
  { key: 'dungeon_depth_50', category: 'stage', icon: '🏰', title: '던전 초입 탐험', desc: '경험치/골드 던전 50층 돌파', reward: 2200, target: 50, stat: 'dungeonDepth' },
  { key: 'dungeon_depth_150', category: 'stage', icon: '🕯️', title: '던전 심층부', desc: '경험치/골드 던전 150층 돌파', reward: 7000, target: 150, stat: 'dungeonDepth' },
  { key: 'dungeon_depth_200', category: 'stage', icon: '👻', title: '그림자의 영역', desc: '경험치/골드 던전 200층 돌파', reward: 9500, target: 200, stat: 'dungeonDepth' },
  { key: 'dungeon_depth_250', category: 'stage', icon: '💀', title: '해골의 방', desc: '경험치/골드 던전 250층 돌파', reward: 12000, target: 250, stat: 'dungeonDepth' },
  { key: 'dungeon_depth_350', category: 'stage', icon: '🔥', title: '불지옥 관문', desc: '경험치/골드 던전 350층 돌파', reward: 25000, target: 350, stat: 'dungeonDepth' },
  { key: 'dungeon_depth_400', category: 'stage', icon: '❄️', title: '빙하 지대', desc: '경험치/골드 던전 400층 돌파', reward: 35000, target: 400, stat: 'dungeonDepth' },
  { key: 'dungeon_depth_450', category: 'stage', icon: '🌑', title: '칠흑의 심연', desc: '경험치/골드 던전 450층 돌파', reward: 55000, target: 450, stat: 'dungeonDepth' },
  { key: 'referral_1', category: 'special', icon: '🌱', title: '첫 추천', desc: '친구 1명 추천 성공', reward: 1000, target: 1, stat: 'referralCount' },
  { key: 'referral_3', category: 'special', icon: '🌿', title: '작은 인연', desc: '친구 3명 추천 성공', reward: 2500, target: 3, stat: 'referralCount' },
  { key: 'referral_10', category: 'special', icon: '🌳', title: '나무를 심다', desc: '친구 10명 추천 성공', reward: 8000, target: 10, stat: 'referralCount' },
  { key: 'referral_15', category: 'special', icon: '🌲', title: '숲의 시작', desc: '친구 15명 추천 성공', reward: 13000, target: 15, stat: 'referralCount' },
  { key: 'referral_30', category: 'special', icon: '🏞️', title: '전도사의 길', desc: '친구 30명 추천 성공', reward: 32000, target: 30, stat: 'referralCount' },
  { key: 'referral_50', category: 'special', icon: '🌍', title: '세계를 잇다', desc: '친구 50명 추천 성공', reward: 55000, target: 50, stat: 'referralCount' },
  { key: 'attendance_3', category: 'attendance', icon: '📆', title: '사흘의 정성', desc: '누적 출석 3회', reward: 800, target: 3, stat: 'attendanceTotal' },
  { key: 'attendance_14', category: 'attendance', icon: '🗓️', title: '2주 개근', desc: '누적 출석 14회', reward: 3500, target: 14, stat: 'attendanceTotal' },
  { key: 'attendance_50', category: 'attendance', icon: '📅', title: '오십일의 약속', desc: '누적 출석 50회', reward: 15000, target: 50, stat: 'attendanceTotal' },
  { key: 'attendance_75', category: 'attendance', icon: '📔', title: '75일의 인연', desc: '누적 출석 75회', reward: 22000, target: 75, stat: 'attendanceTotal' },
  { key: 'attendance_150', category: 'attendance', icon: '📘', title: '반년의 정성', desc: '누적 출석 150회', reward: 40000, target: 150, stat: 'attendanceTotal' },
  { key: 'attendance_250', category: 'attendance', icon: '📗', title: '일상이 된 조련', desc: '누적 출석 250회', reward: 70000, target: 250, stat: 'attendanceTotal' },
  { key: 'attendance_300', category: 'attendance', icon: '📙', title: '거의 다 왔어요', desc: '누적 출석 300회', reward: 90000, target: 300, stat: 'attendanceTotal' },
  { key: 'attendance_500', category: 'attendance', icon: '📕', title: '오백일의 약속', desc: '누적 출석 500회', reward: 150000, target: 500, stat: 'attendanceTotal' },
  { key: 'attendance_730', category: 'attendance', icon: '🎊', title: '2년의 여정', desc: '누적 출석 730회', reward: 220000, target: 730, stat: 'attendanceTotal' },
  { key: 'tower_5', category: 'special', icon: '🗼', title: '탑 앞에 서다', desc: '무한의 탑 5층 돌파', reward: 1500, target: 5, stat: 'towerHighestFloor' },
  { key: 'tower_15', category: 'special', icon: '🏯', title: '계단을 오르다', desc: '무한의 탑 15층 돌파', reward: 6000, target: 15, stat: 'towerHighestFloor' },
  { key: 'tower_20', category: 'special', icon: '⛩️', title: '중턱의 전망', desc: '무한의 탑 20층 돌파', reward: 8500, target: 20, stat: 'towerHighestFloor' },
  { key: 'tower_40', category: 'special', icon: '🌫️', title: '안개의 층', desc: '무한의 탑 40층 돌파', reward: 18000, target: 40, stat: 'towerHighestFloor' },
  { key: 'tower_50', category: 'special', icon: '☁️', title: '구름 위 도전', desc: '무한의 탑 50층 돌파', reward: 25000, target: 50, stat: 'towerHighestFloor' },
  { key: 'tower_60', category: 'special', icon: '🌤️', title: '하늘길 개척자', desc: '무한의 탑 60층 돌파', reward: 32000, target: 60, stat: 'towerHighestFloor' },
  { key: 'tower_70', category: 'special', icon: '🌈', title: '무지개 층계', desc: '무한의 탑 70층 돌파', reward: 40000, target: 70, stat: 'towerHighestFloor' },
  { key: 'tower_80', category: 'special', icon: '✨', title: '빛나는 고도', desc: '무한의 탑 80층 돌파', reward: 48000, target: 80, stat: 'towerHighestFloor' },
  { key: 'tower_90', category: 'special', icon: '🌠', title: '정상이 보인다', desc: '무한의 탑 90층 돌파', reward: 55000, target: 90, stat: 'towerHighestFloor' },
  { key: 'tower_150', category: 'special', icon: '🌌', title: '성층권 돌파', desc: '무한의 탑 150층 돌파', reward: 90000, target: 150, stat: 'towerHighestFloor' },
  { key: 'tower_200', category: 'special', icon: '👑', title: '천공의 지배자', desc: '무한의 탑 200층 돌파', reward: 130000, target: 200, stat: 'towerHighestFloor' },
];

export const ACHIEVEMENT_CATEGORY_LABEL = {
  growth: '🌱 성장', job: '🎖️ 전직', stage: '🗺️ 스테이지', gacha: '🎰 뽑기', pvp: '🥊 PvP', worldboss: '🐉 월드보스', gear: '🎽 장비', attendance: '📅 출석', special: '🌟 특별',
};

/** 내가 이미 수령한 업적 키 목록 */
export async function fetchClaimedAchievements(userId) {
  const { data, error } = await supabase
    .from('achievement_claims')
    .select('achievement_key')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.achievement_key));
}

/** 업적 보상 수령 (서버가 실제 상태로 재검증) */
export async function claimAchievement(achievementKey) {
  const { data, error } = await supabase.rpc('claim_achievement', { p_achievement_key: achievementKey });
  if (error) throw new Error(error.message);
  return data; // reward gold amount
}

/** 지금 조건을 채운 업적을 전부 한 번에 수령(신규, 사용자 요청) */
export async function claimAllAchievements() {
  const { data, error } = await supabase.rpc('claim_all_achievements');
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { claimedCount: row?.claimed_count ?? 0, totalReward: row?.total_reward ?? 0, claimedKeys: row?.claimed_keys ?? [] };
}

/** 업적 달성 개수 랭킹 TOP20 */
export async function fetchAchievementLeaderboard() {
  const { data, error } = await supabase.rpc('fetch_achievement_leaderboard');
  if (error) throw error;
  return data ?? [];
}

/** 내 업적 랭킹 순위 (업적 하나도 없으면 null) */
export async function fetchMyAchievementRank() {
  const { data, error } = await supabase.rpc('fetch_my_achievement_rank');
  if (error) throw error;
  return data;
}
