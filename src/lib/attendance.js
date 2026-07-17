import { supabase } from './supabaseClient';

/** 내 출석 상태 조회 (오늘 이미 받았는지 판단용) */
export async function fetchAttendanceState(userId) {
  const { data, error } = await supabase
    .from('attendance_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data; // null이면 아직 한 번도 출석 안 한 유저
}

/** 출석체크 (하루 1회, 서버가 날짜 기준으로 중복 방지) */
export async function claimAttendance() {
  const { data, error } = await supabase.rpc('claim_attendance');
  if (error) throw new Error(error.message);
  return data?.[0] ?? data;
}

/** 오늘 이미 출석했는지 (서버 UTC date 기준, state가 없으면 false) */
export function hasClaimedToday(state) {
  if (!state?.last_claim_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return state.last_claim_date === today;
}
