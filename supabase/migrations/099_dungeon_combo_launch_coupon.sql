-- ============================================
-- 099: 던전 일일 콤보 보너스 출시 기념 쿠폰
-- ============================================

insert into public.coupons (code, gold_amount, item_key, max_uses, expires_at)
values ('DUNGEONCOMBO', 12000, 'weapon_epic', null, '2027-12-31 23:59:59+09'::timestamptz);
