-- ============================================
-- 067: 디자인 리프레시 + 신규 콘텐츠 기념 쿠폰
-- ============================================

insert into public.coupons (code, gold_amount, item_key, max_uses, expires_at)
values ('REFRESH2026', 10000, 'armor_epic', null, '2027-03-31 23:59:59+09'::timestamptz);
