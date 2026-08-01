import { supabase } from './supabaseClient';

/**
 * 연승 던전 보스 스탯(레벨+연승 스케일) - 서버 calc_streak_dungeon_boss와 동일 공식 유지할 것.
 * 연승(streak)이 오를수록 지수적으로 강해져서(1.75/1.55/1.45 지수), 무한정 이어가기가
 * 무모해지도록 설계됨 - "지금 수령"이라는 선택지가 항상 매력적이게 만드는 핵심 장치.
 */
export function getStreakDungeonBoss(level, streak) {
  const lv = Math.max(1, level);
  const st = Math.max(1, streak);
  const maxHp = Math.round(700 + Math.pow(lv, 1.35) * 18 + Math.pow(st, 1.75) * 260);
  const atk = Math.round(45 + Math.pow(lv, 1.15) * 3.6 + Math.pow(st, 1.55) * 17);
  const def = Math.round(30 + Math.pow(lv, 1.05) * 2.6 + Math.pow(st, 1.45) * 11);
  return {
    name: `${st}연승 광전사`,
    icon: '🔥',
    maxHp, hp: maxHp, atk, def,
    expReward: Math.round(maxHp * 0.06),
  };
}

/**
 * 연승 보상 골드 미리보기(화면 표시용) - 서버 calc_streak_dungeon_gold와 동일 공식 유지할 것.
 * 실제 지급액은 항상 서버(bank_streak_dungeon)가 최종 계산 - 이건 순수 안내용 추정치.
 */
export function previewStreakDungeonGold(level, streak) {
  const lv = Math.max(1, level);
  const st = Math.max(1, streak);
  const base = 220 + Math.pow(lv, 1.25) * 6;
  return Math.min(2000000, Math.round(base * Math.pow(1.3, st - 1))); // (수정) 100만 -> 200만
}

/** 내 최고 연승 기록 조회 (tower.js의 fetchMyTowerProgress와 동일 패턴) */
export async function fetchMyStreakDungeonBest(userId) {
  const { data, error } = await supabase
    .from('streak_dungeon_best')
    .select('best_streak')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.best_streak ?? 0;
}

export async function fetchStreakDungeonAttemptsToday() {
  const { data, error } = await supabase.rpc('fetch_streak_dungeon_attempts_today');
  if (error) throw error;
  return data ?? 0;
}

/** 새로고침/재접속 후 이어서 진행 중인 연승이 있으면 복원 */
export async function fetchMyActiveStreakDungeon() {
  const { data, error } = await supabase.rpc('fetch_my_active_streak_dungeon');
  if (error) throw error;
  const row = data?.[0];
  return row ? { sessionId: row.session_id, streak: row.streak } : null;
}

export async function startStreakDungeon() {
  const { data, error } = await supabase.rpc('start_streak_dungeon');
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { sessionId: row.session_id, streak: row.streak };
}

/** 승리 후 "이어서 도전" - 보상은 아직 지급 안 됨, 다음 연승 보스 정보만 갱신 */
export async function continueStreakDungeon(sessionId) {
  const { data, error } = await supabase.rpc('continue_streak_dungeon', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { streak: row.streak, goldPreview: row.gold_preview };
}

/** "지금 수령" - 골드 확정 지급 */
export async function bankStreakDungeon(sessionId) {
  const { data, error } = await supabase.rpc('bank_streak_dungeon', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return { gold: row.gold, finalStreak: row.final_streak };
}

/** 패배 시 포기 - 이번 판 보상 소멸 */
export async function forfeitStreakDungeon(sessionId) {
  const { error } = await supabase.rpc('forfeit_streak_dungeon', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
}

export async function fetchStreakDungeonLeaderboard() {
  const { data, error } = await supabase.rpc('fetch_streak_dungeon_leaderboard');
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyStreakDungeonRank() {
  const { data, error } = await supabase.rpc('fetch_my_streak_dungeon_rank');
  if (error) throw error;
  return data;
}
