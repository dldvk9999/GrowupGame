-- ============================================
-- 095: 업적 44개 돌파 기념 쿠폰
-- ============================================

insert into public.coupons (code, gold_amount, item_key, max_uses, expires_at)
values ('ACHIEVE44', 20000, 'gloves_legendary', null, '2027-12-31 23:59:59+09'::timestamptz);
