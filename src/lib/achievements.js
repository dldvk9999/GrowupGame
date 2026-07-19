import { supabase } from './supabaseClient';

/**
 * 칭호를 주는 업적 -> 칭호 텍스트 매핑. 서버 set_equipped_title RPC의 CASE문과
 * 반드시 동기화되어야 함(한쪽만 고치면 클라 UI에 칭호 버튼이 안 뜨거나, 서버가 거부함).
 */
export const TITLE_BY_ACHIEVEMENT = {
  level_180: '정점의 지배자',
  job_tier_5: '전설의 전사',
  stage_clear_1000: '차원의 정복자',
  gacha_5000: '행운의 화신',
  pvp_win_50: '투기장의 지배자',
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
  { key: 'job_tier_5', category: 'job', icon: '🏆', title: '5차 전직 (최종)', desc: '5차 전직 달성', reward: 15000, target: 5, stat: 'jobTier' },

  { key: 'stage_clear_10', category: 'stage', icon: '🗺️', title: '초보 모험가', desc: '스테이지 10개 클리어', reward: 500, target: 10, stat: 'stageCleared' },
  { key: 'stage_clear_100', category: 'stage', icon: '🧭', title: '숙련 모험가', desc: '스테이지 100개 클리어', reward: 3000, target: 100, stat: 'stageCleared' },
  { key: 'stage_clear_500', category: 'stage', icon: '🏔️', title: '베테랑 모험가', desc: '스테이지 500개 클리어', reward: 15000, target: 500, stat: 'stageCleared' },
  { key: 'stage_clear_1000', category: 'stage', icon: '🌌', title: '전설의 모험가', desc: '스테이지 1000개(전체) 클리어', reward: 40000, target: 1000, stat: 'stageCleared' },

  { key: 'gacha_100', category: 'gacha', icon: '🎰', title: '뽑기 입문', desc: '스킬+장비 통산 뽑기 100회', reward: 1000, target: 100, stat: 'gachaTotal' },
  { key: 'gacha_1000', category: 'gacha', icon: '🎲', title: '뽑기 중독', desc: '스킬+장비 통산 뽑기 1,000회', reward: 5000, target: 1000, stat: 'gachaTotal' },
  { key: 'gacha_5000', category: 'gacha', icon: '💎', title: '뽑기의 화신', desc: '스킬+장비 통산 뽑기 5,000회', reward: 20000, target: 5000, stat: 'gachaTotal' },

  { key: 'pvp_win_1', category: 'pvp', icon: '🎯', title: '첫 승리', desc: 'PvP 첫 승 달성', reward: 300, target: 1, stat: 'pvpWins' },
  { key: 'pvp_win_10', category: 'pvp', icon: '🥊', title: '투기장 신인', desc: 'PvP 10승 달성', reward: 1500, target: 10, stat: 'pvpWins' },
  { key: 'pvp_win_50', category: 'pvp', icon: '⚡', title: '투기장 강자', desc: 'PvP 50승 달성', reward: 6000, target: 50, stat: 'pvpWins' },

  { key: 'world_boss_participate', category: 'worldboss', icon: '🐉', title: '용과의 조우', desc: '월드보스에게 피해를 입혀보기', reward: 500, target: 1, stat: 'worldBossDamage' },

  { key: 'full_set_equipped', category: 'gear', icon: '🎽', title: '완벽한 세트', desc: '4슬롯을 전부 같은 등급으로 장착하기', reward: 3000, target: 1, stat: 'fullSetEquipped' },

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

  { key: 'founder', category: 'special', icon: '🌟', title: '얼리버드', desc: '2026년 8월 1일 이전 가입', reward: 5000, target: 1, stat: 'isFounder' },

  { key: 'tower_10', category: 'special', icon: '🗼', title: '탑의 초입', desc: '무한의 탑 10층 돌파', reward: 4000, target: 10, stat: 'towerHighestFloor' },
  { key: 'tower_30', category: 'special', icon: '🏯', title: '구름 위 수련자', desc: '무한의 탑 30층 돌파', reward: 15000, target: 30, stat: 'towerHighestFloor' },
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
