-- ============================================
-- 055: 뽑기 중복(강화) 시 10% 확률로 강화량 2배 "럭키 보너스"
-- 변동성 있는 보상(스키너 박스형 서프라이즈)은 뽑기 손맛을 살리는 고전적인 장치.
-- 반환 컬럼 구성은 전혀 안 바뀌므로 CREATE OR REPLACE로 안전(DROP FUNCTION 불필요).
-- 스킬: 평소 +3, 10% 확률로 +6 / 장비: 평소 +1, 10% 확률로 +2
-- ============================================

-- ============================================
-- 1. draw_skill
-- ============================================
create or replace function public.draw_skill()
returns table(skill_key text, new_skill_level integer, was_duplicate boolean, cost integer, draw_level integer) as $$
declare
  v_draws integer;
  v_draw_level integer;
  v_cost integer;
  v_gold integer;
  v_roll numeric;
  v_rarity_order integer;
  v_picked_key text;
  v_existing_level integer;
  v_final_level integer;
  v_was_dup boolean;
  v_increment integer;
  w_normal numeric; w_rare numeric; w_epic numeric; w_legendary numeric; w_mythic numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select p.total_skill_draws into v_draws from public.profiles p where p.id = auth.uid();
  v_draw_level := least(50, 1 + v_draws / 1000);
  v_cost := 300 + (v_draw_level - 1) * 90;

  select p.gold into v_gold from public.profiles p where p.id = auth.uid() for update;
  if v_gold is null or v_gold < v_cost then
    raise exception '골드가 부족합니다.';
  end if;

  if v_draw_level <= 8 then
    w_normal := 0.70; w_rare := 0.25; w_epic := 0.05; w_legendary := 0.00; w_mythic := 0.00;
  elsif v_draw_level <= 18 then
    w_normal := 0.50; w_rare := 0.32; w_epic := 0.15; w_legendary := 0.03; w_mythic := 0.00;
  elsif v_draw_level <= 28 then
    w_normal := 0.32; w_rare := 0.33; w_epic := 0.25; w_legendary := 0.09; w_mythic := 0.01;
  elsif v_draw_level <= 38 then
    w_normal := 0.18; w_rare := 0.27; w_epic := 0.30; w_legendary := 0.20; w_mythic := 0.05;
  elsif v_draw_level <= 48 then
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

  select sc.skill_key into v_picked_key from public.skill_catalog sc
    where sc.rarity_order = v_rarity_order
    order by random() limit 1;

  update public.profiles set gold = gold - v_cost, total_skill_draws = total_skill_draws + 1
    where id = auth.uid();

  select us.skill_level into v_existing_level from public.user_skills us
    where us.user_id = auth.uid() and us.skill_key = v_picked_key;

  if v_existing_level is null then
    insert into public.user_skills (user_id, skill_key, skill_level) values (auth.uid(), v_picked_key, 1);
    v_final_level := 1;
    v_was_dup := false;
  else
    v_increment := case when random() < 0.10 then 6 else 3 end;
    v_final_level := least(1000, v_existing_level + v_increment);
    update public.user_skills us set skill_level = v_final_level
      where us.user_id = auth.uid() and us.skill_key = v_picked_key;
    v_was_dup := true;
  end if;

  return query select v_picked_key, v_final_level, v_was_dup, v_cost, least(50, 1 + (v_draws + 1) / 1000);
end;
$$ language plpgsql security definer;

-- ============================================
-- 2. draw_skill_batch
-- ============================================
create or replace function public.draw_skill_batch(p_count integer)
returns table(skill_key text, new_skill_level integer, was_duplicate boolean, cost integer, draw_level integer) as $$
declare
  v_i integer;
  v_draws integer;
  v_draw_level integer;
  v_cost integer;
  v_gold integer;
  v_roll numeric;
  v_rarity_order integer;
  v_picked_key text;
  v_existing_level integer;
  v_final_level integer;
  v_was_dup boolean;
  v_increment integer;
  w_normal numeric; w_rare numeric; w_epic numeric; w_legendary numeric; w_mythic numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_count < 1 or p_count > 100 then
    raise exception '유효하지 않은 횟수입니다.';
  end if;

  for v_i in 1..p_count loop
    select p.total_skill_draws into v_draws from public.profiles p where p.id = auth.uid();
    v_draw_level := least(50, 1 + v_draws / 1000);
    v_cost := 300 + (v_draw_level - 1) * 90;

    select p.gold into v_gold from public.profiles p where p.id = auth.uid() for update;
    if v_gold is null or v_gold < v_cost then
      exit;
    end if;

    if v_draw_level <= 8 then
      w_normal := 0.70; w_rare := 0.25; w_epic := 0.05; w_legendary := 0.00; w_mythic := 0.00;
    elsif v_draw_level <= 18 then
      w_normal := 0.50; w_rare := 0.32; w_epic := 0.15; w_legendary := 0.03; w_mythic := 0.00;
    elsif v_draw_level <= 28 then
      w_normal := 0.32; w_rare := 0.33; w_epic := 0.25; w_legendary := 0.09; w_mythic := 0.01;
    elsif v_draw_level <= 38 then
      w_normal := 0.18; w_rare := 0.27; w_epic := 0.30; w_legendary := 0.20; w_mythic := 0.05;
    elsif v_draw_level <= 48 then
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

    select sc.skill_key into v_picked_key from public.skill_catalog sc
      where sc.rarity_order = v_rarity_order
      order by random() limit 1;

    update public.profiles set gold = gold - v_cost, total_skill_draws = total_skill_draws + 1
      where id = auth.uid();

    select us.skill_level into v_existing_level from public.user_skills us
      where us.user_id = auth.uid() and us.skill_key = v_picked_key;

    if v_existing_level is null then
      insert into public.user_skills (user_id, skill_key, skill_level) values (auth.uid(), v_picked_key, 1);
      v_final_level := 1;
      v_was_dup := false;
    else
      v_increment := case when random() < 0.10 then 6 else 3 end;
      v_final_level := least(1000, v_existing_level + v_increment);
      update public.user_skills us set skill_level = v_final_level
        where us.user_id = auth.uid() and us.skill_key = v_picked_key;
      v_was_dup := true;
    end if;

    skill_key := v_picked_key;
    new_skill_level := v_final_level;
    was_duplicate := v_was_dup;
    cost := v_cost;
    draw_level := least(50, 1 + (v_draws + 1) / 1000);
    return next;
  end loop;

  return;
end;
$$ language plpgsql security definer;

-- ============================================
-- 3. draw_equipment
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
  v_increment integer;
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
  v_draw_level := least(50, 1 + v_draws / 1000);
  v_cost := 100 + (v_draw_level - 1) * 30;

  select p.gold into v_gold from public.profiles p where p.id = auth.uid() for update;
  if v_gold is null or v_gold < v_cost then
    raise exception '골드가 부족합니다.';
  end if;

  if v_draw_level <= 8 then
    w_normal := 0.70; w_rare := 0.25; w_epic := 0.05; w_legendary := 0.00; w_mythic := 0.00;
  elsif v_draw_level <= 18 then
    w_normal := 0.50; w_rare := 0.32; w_epic := 0.15; w_legendary := 0.03; w_mythic := 0.00;
  elsif v_draw_level <= 28 then
    w_normal := 0.32; w_rare := 0.33; w_epic := 0.25; w_legendary := 0.09; w_mythic := 0.01;
  elsif v_draw_level <= 38 then
    w_normal := 0.18; w_rare := 0.27; w_epic := 0.30; w_legendary := 0.20; w_mythic := 0.05;
  elsif v_draw_level <= 48 then
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
    v_increment := case when random() < 0.10 then 2 else 1 end;
    v_final_level := least(1000, v_existing_level + v_increment);
    update public.user_inventory ui set enhance_level = v_final_level
      where ui.user_id = auth.uid() and ui.item_key = v_item_key;
    v_was_dup := true;
  end if;

  return query select v_item_key, p_slot, v_rarity_name, v_was_dup, v_final_level, v_cost,
    least(50, 1 + (v_draws + 1) / 1000);
end;
$$ language plpgsql security definer;

-- ============================================
-- 4. draw_equipment_batch
-- ============================================
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
  v_increment integer;
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
    v_draw_level := least(50, 1 + v_draws / 1000);
    v_cost := 100 + (v_draw_level - 1) * 30;

    select p.gold into v_gold from public.profiles p where p.id = auth.uid() for update;
    if v_gold is null or v_gold < v_cost then
      exit;
    end if;

    if v_draw_level <= 8 then
      w_normal := 0.70; w_rare := 0.25; w_epic := 0.05; w_legendary := 0.00; w_mythic := 0.00;
    elsif v_draw_level <= 18 then
      w_normal := 0.50; w_rare := 0.32; w_epic := 0.15; w_legendary := 0.03; w_mythic := 0.00;
    elsif v_draw_level <= 28 then
      w_normal := 0.32; w_rare := 0.33; w_epic := 0.25; w_legendary := 0.09; w_mythic := 0.01;
    elsif v_draw_level <= 38 then
      w_normal := 0.18; w_rare := 0.27; w_epic := 0.30; w_legendary := 0.20; w_mythic := 0.05;
    elsif v_draw_level <= 48 then
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
      v_increment := case when random() < 0.10 then 2 else 1 end;
      v_final_level := least(1000, v_existing_level + v_increment);
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
    draw_level := least(50, 1 + (v_draws + 1) / 1000);
    return next;
  end loop;

  return;
end;
$$ language plpgsql security definer;
