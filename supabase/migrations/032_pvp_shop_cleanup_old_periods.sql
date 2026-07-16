-- ============================================
-- 032: PvP 상점 - 지난 시간대 진열대가 계속 쌓여서 표시되던 버그 수정
-- 원인: sync_pvp_shop이 매시간 새 진열대(period_key)를 "추가"만 하고 예전 것을 지우지 않았고,
-- 클라이언트도 period_key로 필터링하지 않고 pvp_shop_listings 전체를 조회해서 보여주고 있었음.
-- → 서버에서 새 시간대 생성 시 예전 시간대는 정리하도록 변경 (근본 원인 해결).
-- Supabase SQL Editor에 순서대로 실행 (001~031 먼저 적용되어 있어야 함)
-- ============================================

create or replace function public.sync_pvp_shop()
returns void as $$
declare
  v_period text := to_char(date_trunc('hour', now()), 'YYYYMMDDHH24');
  v_exists integer;
  v_slots text[] := array['weapon', 'armor', 'gloves', 'shoes'];
  v_rarities text[] := array['normal', 'rare', 'epic', 'legendary', 'mythic'];
  v_base_price integer[] := array[3000, 8000, 20000, 55000, 150000];
  i integer;
  v_roll numeric;
  v_rarity_idx integer;
  v_slot text;
  v_item_key text;
  v_price integer;
begin
  select count(*) into v_exists from public.pvp_shop_listings where period_key = v_period;
  if v_exists > 0 then
    return;
  end if;

  -- 새 시간대 진열대를 만들기 전에, 지금 시간대가 아닌 예전 진열대는 전부 정리
  delete from public.pvp_shop_listings where period_key <> v_period;

  for i in 1..10 loop
    v_roll := random();
    if v_roll < 0.45 then v_rarity_idx := 1;
    elsif v_roll < 0.72 then v_rarity_idx := 2;
    elsif v_roll < 0.88 then v_rarity_idx := 3;
    elsif v_roll < 0.96 then v_rarity_idx := 4;
    else v_rarity_idx := 5;
    end if;

    v_slot := v_slots[1 + floor(random() * 4)::int];
    v_item_key := v_slot || '_' || v_rarities[v_rarity_idx];
    v_price := v_base_price[v_rarity_idx] + floor(random() * v_base_price[v_rarity_idx] * 0.2)::int;

    insert into public.pvp_shop_listings (period_key, slot_index, item_key, price)
    values (v_period, i, v_item_key, v_price)
    on conflict on constraint pvp_shop_listings_period_key_slot_index_key do nothing;
  end loop;
end;
$$ language plpgsql security definer;
