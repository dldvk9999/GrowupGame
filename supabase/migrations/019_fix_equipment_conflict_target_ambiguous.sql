-- ============================================
-- 019: draw_equipment / draw_equipment_batch의 남은 ambiguous 소지 제거
-- "on conflict (user_id, slot)"의 컬럼 목록 표기 대신 제약조건 이름을 사용해서
-- RETURNS TABLE의 출력 컬럼명 slot과 조금이라도 헷갈릴 여지를 원천 차단함
-- Supabase SQL Editor에 순서대로 실행 (001~018 먼저 적용되어 있어야 함)
-- ============================================

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

  insert into public.equipment_gacha_progress (user_id, slot, total_draws)
  values (auth.uid(), p_slot, 0)
  on conflict on constraint equipment_gacha_progress_pkey do nothing;

  select p.total_draws into v_draws from public.equipment_gacha_progress p
    where p.user_id = auth.uid() and p.slot = p_slot;
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

  update public.profiles set gold = gold - v_cost where id = auth.uid();
  update public.equipment_gacha_progress eg set total_draws = eg.total_draws + 1
    where eg.user_id = auth.uid() and eg.slot = p_slot;

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

  insert into public.equipment_gacha_progress (user_id, slot, total_draws)
  values (auth.uid(), p_slot, 0)
  on conflict on constraint equipment_gacha_progress_pkey do nothing;

  for v_i in 1..p_count loop
    select p.total_draws into v_draws from public.equipment_gacha_progress p
      where p.user_id = auth.uid() and p.slot = p_slot;
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

    update public.profiles set gold = gold - v_cost where id = auth.uid();
    update public.equipment_gacha_progress eg set total_draws = eg.total_draws + 1
      where eg.user_id = auth.uid() and eg.slot = p_slot;

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
