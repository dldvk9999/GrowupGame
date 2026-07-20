-- ============================================
-- 126: PvP 상점 가격 20% 인하 + 랜덤 1~3개 추가 20% 할인 - 신규 콘텐츠(사용자 요청)
--
-- 기존 기본가(3000~150000)를 전부 20% 인하하고, 매 시간대 새 진열대를 만들 때
-- 10개 슬롯 중 무작위로 1~3개를 골라 추가로 20% 더 할인(중첩 적용, 최종 36% 할인)해서
-- "할인" 태그를 붙임. buy_pvp_costume은 이미 `price` 컬럼 값을 그대로 청구하는 구조라
-- 가격 계산 로직만 sync_pvp_shop 안에서 바뀌면 되고 별도 수정 불필요.
--
-- is_on_sale은 순수 UI 표시용 플래그 - 실제 청구 금액은 이미 할인 반영된 price 컬럼
-- 값 그대로라 buy_pvp_costume 로직 자체는 안 바뀜.
-- ============================================

alter table public.pvp_shop_listings add column if not exists is_on_sale boolean not null default false;

create or replace function public.sync_pvp_shop()
returns void as $$
declare
  v_period text := to_char(date_trunc('hour', now()), 'YYYYMMDDHH24');
  v_exists integer;
  v_slots text[] := array['weapon', 'armor', 'gloves', 'shoes'];
  v_rarities text[] := array['normal', 'rare', 'epic', 'legendary', 'mythic'];
  v_base_price integer[] := array[2400, 6400, 16000, 44000, 120000]; -- 기존 대비 20% 인하
  v_sale_slots integer[];
  i integer;
  v_roll numeric;
  v_rarity_idx integer;
  v_slot text;
  v_item_key text;
  v_price integer;
  v_is_sale boolean;
begin
  select count(*) into v_exists from public.pvp_shop_listings where period_key = v_period;
  if v_exists > 0 then
    return;
  end if;

  -- 새 시간대 진열대를 만들기 전에, 지금 시간대가 아닌 예전 진열대는 전부 정리
  delete from public.pvp_shop_listings where period_key <> v_period;

  -- 이번 시간대에 추가 할인 태그를 붙일 슬롯 1~3개를 미리 무작위로 뽑아둠(중복 없이)
  select array_agg(s) into v_sale_slots
    from (select generate_series(1, 10) as s order by random() limit (1 + floor(random() * 3)::int)) t;

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

    v_is_sale := (i = any(v_sale_slots));
    if v_is_sale then
      v_price := round(v_price * 0.8); -- 추가 20% 할인 중첩
    end if;

    insert into public.pvp_shop_listings (period_key, slot_index, item_key, price, is_on_sale)
    values (v_period, i, v_item_key, v_price, v_is_sale)
    on conflict on constraint pvp_shop_listings_period_key_slot_index_key do nothing;
  end loop;
end;
$$ language plpgsql security definer;
