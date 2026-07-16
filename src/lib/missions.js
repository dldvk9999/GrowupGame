import { supabase } from './supabaseClient';

// 여러 화면(전투/던전/뽑기)에서 미션 진행도를 올리면 App.jsx의 플로팅 버튼 state도
// 같이 갱신되도록 하는 간단한 pub-sub 버스 (toast.js와 동일 패턴)
const listeners = new Set();
export function subscribeMissionUpdate(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notifyMissionUpdate(row) {
  listeners.forEach((fn) => fn(row));
}

export const MISSION_META = {
  kill_monsters: { icon: '⚔️', label: (t) => `몬스터 ${t}마리 잡기` },
  spend_gold: { icon: '💰', label: (t) => `골드 ${t.toLocaleString()} 사용하기` },
  login_minutes: { icon: '⏱️', label: (t) => `${t}분 접속 유지하기` },
  use_skills: { icon: '🎯', label: (t) => `스킬 ${t}회 사용하기` },
  job_tier1: { icon: '✨', label: () => '1차 전직 던전 클리어하기' },
  job_tier2: { icon: '✨', label: () => '2차 전직 던전 클리어하기' },
  job_tier3: { icon: '✨', label: () => '3차 전직 던전 클리어하기' },
  equip_skill_slot: { icon: '🆕', label: () => '새로 열린 스킬 슬롯 채우기' },
};

export function getMissionLabel(missionKey, target) {
  const meta = MISSION_META[missionKey];
  if (!meta) return missionKey;
  return meta.label(target);
}

export function getMissionIcon(missionKey) {
  return MISSION_META[missionKey]?.icon ?? '📋';
}

export async function fetchOrInitMissionState() {
  const { data, error } = await supabase.rpc('init_mission_state');
  if (error) throw error;
  return data;
}

/** 미션 진행도 증가 + 구독자(플로팅 버튼)에게 통지 - 실패해도 게임 진행엔 영향 없어서 에러를 조용히 삼킴 */
export async function bumpMission(missionKey, amount) {
  try {
    const { data, error } = await supabase.rpc('increment_mission_progress', {
      p_mission_key: missionKey,
      p_amount: amount,
    });
    if (error) throw error;
    notifyMissionUpdate(data);
    return data;
  } catch (err) {
    console.error('미션 진행도 갱신 실패', err);
    return null;
  }
}

export async function claimMissionReward() {
  const { data, error } = await supabase.rpc('claim_mission_reward');
  if (error) throw error;
  return data;
}
