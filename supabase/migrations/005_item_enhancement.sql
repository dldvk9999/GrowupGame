-- ============================================
-- 005: 아이템 강화 시스템
-- 성공 확률 판정은 클라이언트가 조작 못 하도록 서버(RPC)에서 처리.
-- Supabase SQL Editor에 순서대로 실행
-- ============================================

-- 1. user_inventory에 강화 수치 컬럼 추가 (+0 ~ +15)
alter table public.user_inventory
  add column enhance_level integer not null default 0
  check (enhance_level >= 0 and enhance_level <= 15);

-- 2. item_catalog에 등급 정보 추가 (성공확률 계산용)
alter table public.item_catalog add column rarity_order integer;

update public.item_catalog set rarity_order = case
  when item_key like '%_normal' then 1
  when item_key like '%_rare' then 2
  when item_key like '%_epic' then 3
  when item_key like '%_legendary' then 4
  when item_key like '%_mythic' then 5
end;

alter table public.item_catalog alter column rarity_order set not null;

-- 3. 강화 시도 RPC
--    - 등급이 높을수록, 현재 강화수치가 높을수록 성공률이 계속 낮아짐
--    - 실패해도 시도 비용(골드)은 소모됨 (아이템 파괴/하락은 없음)
create or replace function public.enhance_item(p_inventory_id uuid)
returns table(success boolean, new_level integer, cost integer, rate numeric) as $$
declare
  v_owner uuid;
  v_item_key text;
  v_level integer;
  v_rarity_order integer;
  v_price integer;
  v_base_rate numeric;
  v_rate numeric;
  v_cost integer;
  v_gold integer;
  v_roll numeric;
  v_success boolean;
begin
  select ui.user_id, ui.item_key, ui.enhance_level
    into v_owner, v_item_key, v_level
    from public.user_inventory ui where ui.id = p_inventory_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception '권한이 없습니다.';
  end if;
  if v_level >= 15 then
    raise exception '이미 최대 강화 수치입니다.';
  end if;

  select ic.rarity_order, ic.price into v_rarity_order, v_price
    from public.item_catalog ic where ic.item_key = v_item_key;

  v_base_rate := case v_rarity_order
    when 1 then 0.90
    when 2 then 0.80
    when 3 then 0.65
    when 4 then 0.45
    when 5 then 0.25
    else 0.50
  end;
  -- 강화수치 1당 성공률에 0.92를 곱함 (등급 높을수록 시작점이 낮고, 강화할수록 더 떨어짐)
  v_rate := greatest(v_base_rate * power(0.92, v_level), 0.05);
  v_cost := round(v_price * 0.1 * (1 + v_level * 0.5));

  select gold into v_gold from public.profiles where id = auth.uid() for update;
  if v_gold is null or v_gold < v_cost then
    raise exception '골드가 부족합니다.';
  end if;
  update public.profiles set gold = gold - v_cost where id = auth.uid();

  v_roll := random();
  v_success := v_roll < v_rate;

  if v_success then
    update public.user_inventory set enhance_level = v_level + 1 where id = p_inventory_id;
  end if;

  return query select v_success, (case when v_success then v_level + 1 else v_level end), v_cost, v_rate;
end;
$$ language plpgsql security definer;
