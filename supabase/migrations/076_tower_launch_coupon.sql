-- ============================================
-- 076: 무한의 탑 출시 기념 쿠폰
-- ============================================

insert into public.coupons (code, gold_amount, item_key, max_uses, expires_at)
values ('TOWER2026', 15000, 'weapon_epic', null, '2027-06-30 23:59:59+09'::timestamptz);
