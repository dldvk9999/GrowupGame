import { supabase } from './supabaseClient';

/** 루비 던전 보스 스탯(레벨 스케일) - 서버 calc_ruby_dungeon_boss와 동일 공식 유지할 것 */
export function getRubyDungeonBoss(level, elementIcon = '💎') {
  const lv = Math.max(1, level);
  const maxHp = Math.round(1500 + Math.pow(lv, 1.5) * 40);
  const atk = Math.round(80 + Math.pow(lv, 1.3) * 6);
  const def = Math.round(60 + Math.pow(lv, 1.2) * 4);
  return {
    name: '루비 수호자',
    spriteKey: 'ruby_guardian',
    icon: elementIcon,
    element: 'fire', // (신규, 사용자 요청) 속성상성 계산용 - 루비=붉은 보석 테마라 화(불) 속성으로 고정
    maxHp, hp: maxHp, atk, def,
    expReward: Math.round(maxHp * 0.0125), // (수정, 사용자 요청) 0.05 -> 0.0125, 던전 밸런스 조정과 동일 비율
  };
}

export async function fetchRubyDungeonAttemptsToday() {
  const { data, error } = await supabase.rpc('fetch_ruby_dungeon_attempts_today');
  if (error) throw error;
  return data ?? 0;
}

export async function startRubyDungeon() {
  const { data, error } = await supabase.rpc('start_ruby_dungeon');
  if (error) throw new Error(error.message);
  return data; // session id
}

export async function claimRubyDungeonReward(sessionId) {
  const { data, error } = await supabase.rpc('claim_ruby_dungeon_reward', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  return data; // 획득한 루비 개수
}
