import { supabase } from './supabaseClient';

/** 정기 골드우편 동기화 (오늘 이미 지난 시각대 우편이 없으면 생성) - 우편함 진입 시 호출 */
export async function syncDailyMails() {
  const { error } = await supabase.rpc('sync_daily_mails');
  if (error) throw error;
}

/** 내 우편함 목록 (최근순) */
export async function fetchMails(userId) {
  const { data, error } = await supabase
    .from('mails')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** 우편 수령 (골드/아이템 지급) */
export async function claimMail(mailId) {
  const { error } = await supabase.rpc('claim_mail', { p_mail_id: mailId });
  if (error) throw error;
}

/** 수령 완료한 우편 삭제 (RLS가 claimed=true인 본인 우편만 허용) */
export async function deleteMail(mailId) {
  const { error } = await supabase.from('mails').delete().eq('id', mailId);
  if (error) throw error;
}
