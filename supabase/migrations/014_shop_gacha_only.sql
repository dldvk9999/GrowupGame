-- ============================================
-- 014: 상점 개편 - 직접구매/유료강화 폐지, 슬롯별 장비뽑기 4종 + 중복 자동강화
-- Supabase SQL Editor에 순서대로 실행 (001~013 먼저 적용되어 있어야 함)
-- ============================================

-- ============================================
-- 1. user_inventory 중복 행 정리 후 (user_id, item_key) 유니크 제약 추가
--    - 기존에 직접구매/랜덤슬롯뽑기로 같은 아이템을 여러 개 보유했을 수 있어서
--      먼저 하나로 합치고(강화수치는 개수만큼 올려줌) 나머지는 삭제
-- ============================================
with ranked as (
  select id, user_id, item_key, enhance_level,
         row_number() over (
           partition by user_id, item_key
           order by equipped desc, enhance_level desc, acquired_at asc
         ) as rn,
         count(*) over (partition by user_id, item_key) as cnt
  from public.user_inventory
)
update public.user_inventory ui
set enhance_level = least(15, r.enhance_level + r.cnt - 1)
from ranked r
where ui.id = r.id and r.rn = 1 and r.cnt > 1;

with ranked as (
  select id, user_id, item_key,
         row_number() over (
           partition by user_id, item_key
           order by equipped desc, enhance_level desc, acquired_at asc
         ) as rn
  from public.user_inventory
)
delete from public.user_inventory ui
using ranked r
where ui.id = r.id and r.rn > 1;

alter table public.user_inventory
  add constraint user_inventory_user_item_unique unique (user_id, item_key);

-- ============================================
-- 2. 직접구매/유료강화 RPC 완전 차단 (client 호출 불가로 잠금)
-- ============================================
revoke execute on function public.buy_item(text) from public, anon, authenticated;
revoke execute on function public.enhance_item(uuid) from public, anon, authenticated;

-- ============================================
-- 3. 장비뽑기: 슬롯 고정(무기/방어구/장갑/신발 중 하나 지정), 중복이면 강화수치+1
-- ============================================
drop function if exists public.draw_equipment();
drop function if exists public.draw_equipment_batch(integer);

create or replace function public.draw_equipment(p_slot text)
returns table(item_key text, slot text, rarity text, was_duplicate boolean, new_enhance_level integer, cost integer, draw_level integer) as $$
declare
  v_draws integer;
  v_draw_level integer;
  v_cost integer;
  v_gold integer;
  v_roll numeric;
  v_rarity_order integer;
  v_rarity_name text;
  v_item_key text;
  v_existing_level integer;
  v_final_level integer;
  v_was_dup boolean;
  w_normal numeric; w_rare numeric; w_epic numeric; w_legendary numeric; w_mythic numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_slot not in ('weapon', 'armor', 'gloves', 'shoes') then
    raise exception '유효하지 않은 슬롯입니다.';
  end if;

  select p.total_equipment_draws into v_draws from public.profiles p where p.id = auth.uid();
  v_draw_level := least(20, 1 + v_draws / 1000);
  v_cost := 100 + (v_draw_level - 1) * 30;

  select p.gold into v_gold from public.profiles p where p.id = auth.uid() for update;
  if v_gold is null or v_gold < v_cost then
    raise exception '골드가 부족합니다.';
  end if;

  if v_draw_level <= 3 then
    w_normal := 0.70; w_rare := 0.25; w_epic := 0.05; w_legendary := 0.00; w_mythic := 0.00;
  elsif v_draw_level <= 7 then
    w_normal := 0.50; w_rare := 0.32; w_epic := 0.15; w_legendary := 0.03; w_mythic := 0.00;
  elsif v_draw_level <= 11 then
    w_normal := 0.32; w_rare := 0.33; w_epic := 0.25; w_legendary := 0.09; w_mythic := 0.01;
  elsif v_draw_level <= 15 then
    w_normal := 0.18; w_rare := 0.27; w_epic := 0.30; w_legendary := 0.20; w_mythic := 0.05;
  elsif v_draw_level <= 19 then
    w_normal := 0.08; w_rare := 0.17; w_epic := 0.30; w_legendary := 0.32; w_mythic := 0.13;
  else
    w_normal := 0.03; w_rare := 0.10; w_epic := 0.25; w_legendary := 0.37; w_mythic := 0.25;
  end if;

  v_roll := random();
  if v_roll < w_normal then v_rarity_order := 1;
  elsif v_roll < w_normal + w_rare then v_rarity_order := 2;
  elsif v_roll < w_normal + w_rare + w_epic then v_rarity_order := 3;
  elsif v_roll < w_normal + w_rare + w_epic + w_legendary then v_rarity_order := 4;
  else v_rarity_order := 5;
  end if;

  v_rarity_name := case v_rarity_order
    when 1 then 'normal' when 2 then 'rare' when 3 then 'epic' when 4 then 'legendary' else 'mythic'
  end;
  v_item_key := p_slot || '_' || v_rarity_name;

  update public.profiles set gold = gold - v_cost, total_equipment_draws = total_equipment_draws + 1
    where id = auth.uid();

  select ui.enhance_level into v_existing_level from public.user_inventory ui
    where ui.user_id = auth.uid() and ui.item_key = v_item_key;

  if v_existing_level is null then
    insert into public.user_inventory (user_id, item_key, slot, equipped, enhance_level)
    values (auth.uid(), v_item_key, p_slot, false, 0);
    v_final_level := 0;
    v_was_dup := false;
  else
    v_final_level := least(15, v_existing_level + 1);
    update public.user_inventory ui set enhance_level = v_final_level
      where ui.user_id = auth.uid() and ui.item_key = v_item_key;
    v_was_dup := true;
  end if;

  return query select v_item_key, p_slot, v_rarity_name, v_was_dup, v_final_level, v_cost,
    least(20, 1 + (v_draws + 1) / 1000);
end;
$$ language plpgsql security definer;

create or replace function public.draw_equipment_batch(p_slot text, p_count integer)
returns table(item_key text, slot text, rarity text, was_duplicate boolean, new_enhance_level integer, cost integer, draw_level integer) as $$
declare
  v_i integer;
  v_draws integer;
  v_draw_level integer;
  v_cost integer;
  v_gold integer;
  v_roll numeric;
  v_rarity_order integer;
  v_rarity_name text;
  v_item_key text;
  v_existing_level integer;
  v_final_level integer;
  v_was_dup boolean;
  w_normal numeric; w_rare numeric; w_epic numeric; w_legendary numeric; w_mythic numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_slot not in ('weapon', 'armor', 'gloves', 'shoes') then
    raise exception '유효하지 않은 슬롯입니다.';
  end if;
  if p_count < 1 or p_count > 100 then
    raise exception '유효하지 않은 횟수입니다.';
  end if;

  for v_i in 1..p_count loop
    select p.total_equipment_draws into v_draws from public.profiles p where p.id = auth.uid();
    v_draw_level := least(20, 1 + v_draws / 1000);
    v_cost := 100 + (v_draw_level - 1) * 30;

    select p.gold into v_gold from public.profiles p where p.id = auth.uid() for update;
    if v_gold is null or v_gold < v_cost then
      exit;
    end if;

    if v_draw_level <= 3 then
      w_normal := 0.70; w_rare := 0.25; w_epic := 0.05; w_legendary := 0.00; w_mythic := 0.00;
    elsif v_draw_level <= 7 then
      w_normal := 0.50; w_rare := 0.32; w_epic := 0.15; w_legendary := 0.03; w_mythic := 0.00;
    elsif v_draw_level <= 11 then
      w_normal := 0.32; w_rare := 0.33; w_epic := 0.25; w_legendary := 0.09; w_mythic := 0.01;
    elsif v_draw_level <= 15 then
      w_normal := 0.18; w_rare := 0.27; w_epic := 0.30; w_legendary := 0.20; w_mythic := 0.05;
    elsif v_draw_level <= 19 then
      w_normal := 0.08; w_rare := 0.17; w_epic := 0.30; w_legendary := 0.32; w_mythic := 0.13;
    else
      w_normal := 0.03; w_rare := 0.10; w_epic := 0.25; w_legendary := 0.37; w_mythic := 0.25;
    end if;

    v_roll := random();
    if v_roll < w_normal then v_rarity_order := 1;
    elsif v_roll < w_normal + w_rare then v_rarity_order := 2;
    elsif v_roll < w_normal + w_rare + w_epic then v_rarity_order := 3;
    elsif v_roll < w_normal + w_rare + w_epic + w_legendary then v_rarity_order := 4;
    else v_rarity_order := 5;
    end if;

    v_rarity_name := case v_rarity_order
      when 1 then 'normal' when 2 then 'rare' when 3 then 'epic' when 4 then 'legendary' else 'mythic'
    end;
    v_item_key := p_slot || '_' || v_rarity_name;

    update public.profiles set gold = gold - v_cost, total_equipment_draws = total_equipment_draws + 1
      where id = auth.uid();

    select ui.enhance_level into v_existing_level from public.user_inventory ui
      where ui.user_id = auth.uid() and ui.item_key = v_item_key;

    if v_existing_level is null then
      insert into public.user_inventory (user_id, item_key, slot, equipped, enhance_level)
      values (auth.uid(), v_item_key, p_slot, false, 0);
      v_final_level := 0;
      v_was_dup := false;
    else
      v_final_level := least(15, v_existing_level + 1);
      update public.user_inventory ui set enhance_level = v_final_level
        where ui.user_id = auth.uid() and ui.item_key = v_item_key;
      v_was_dup := true;
    end if;

    item_key := v_item_key;
    slot := p_slot;
    rarity := v_rarity_name;
    was_duplicate := v_was_dup;
    new_enhance_level := v_final_level;
    cost := v_cost;
    draw_level := least(20, 1 + (v_draws + 1) / 1000);
    return next;
  end loop;

  return;
end;
$$ language plpgsql security definer;
