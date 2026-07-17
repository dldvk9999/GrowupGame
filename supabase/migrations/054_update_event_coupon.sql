-- ============================================
-- 054: 출석체크/업적/랭킹/무료뽑기/칭호 출시 기념 쿠폰
-- 쿠폰은 SQL로 직접 발행하는 방식(harness/mailbox-and-coupons.md 참고).
-- 만료일 넉넉히 잡아서(2026-12-31) 당분간 계속 쓸 수 있게 함, 사용횟수 제한 없음(무제한, 유저당 1회는
-- coupon_redemptions 유니크 제약이 별도로 보장).
-- ============================================

insert into public.coupons (code, gold_amount, item_key, max_uses, expires_at)
values ('UPDATE2026', 8000, 'gloves_rare', null, '2026-12-31 23:59:59+09'::timestamptz);
