import { supabase } from './supabaseClient';

/** 쿠폰 등록 - 성공하면 보상이 우편함으로 감 */
export async function redeemCoupon(code) {
  const { error } = await supabase.rpc('redeem_coupon', { p_code: code });
  if (error) throw error;
}
