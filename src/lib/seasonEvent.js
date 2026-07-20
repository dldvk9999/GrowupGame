import { supabase } from './supabaseClient';

/** 지금 진행 중인 시즌 이벤트(없으면 null) - grant_idle_reward 안의 날짜 판정과 서버에서 동일하게 계산됨 */
export async function fetchActiveSeasonEvent() {
  const { data, error } = await supabase.rpc('fetch_active_season_event');
  if (error) throw error;
  return data?.[0] ?? null;
}

const SEASON_EVENT_TOAST_KEY = 'growupgame-last-season-event-toast';

/** 오늘 아직 이 이벤트 안내를 안 보여줬으면 true(하루 1번만, dailyQuote.js와 동일 패턴) */
export function shouldShowSeasonEventToast(eventKey) {
  const today = new Date().toISOString().slice(0, 10);
  const marker = `${eventKey}:${today}`;
  try {
    if (localStorage.getItem(SEASON_EVENT_TOAST_KEY) === marker) return false;
    localStorage.setItem(SEASON_EVENT_TOAST_KEY, marker);
  } catch {
    // localStorage 없으면 매번 보여줌(치명적이지 않음)
  }
  return true;
}
