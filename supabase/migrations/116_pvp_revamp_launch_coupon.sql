-- ============================================
-- 116: PvP 개편(실유저 3배보상/복수전/랭킹) 기념 쿠폰
-- ============================================

insert into public.coupons (code, gold_amount, item_key, max_uses, expires_at)
values ('PVPREVENGE', 15000, 'weapon_epic', null, '2027-12-31 23:59:59+09'::timestamptz);
