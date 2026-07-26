-- ============================================
-- 150: 유물뽑기 - 강화수치가 이미 만강(200)인 유물이 또 중복으로 나오면, 낮은 확률로
-- 루비(1~10개 랜덤)를 대신 지급 - 사용자 요청. 기존엔 만강 중복은 그냥 버려졌음(아무
-- 보상 없이 사라짐) - 완전히 헛뽑기가 되는 걸 조금이라도 완화하는 목적.
--
-- draw_relic/draw_relic_batch 둘 다 반환 컬럼이 하나(bonus_rubies) 늘어나므로 DROP
-- FUNCTION 필요. 클라이언트(lib/relicGacha.js)와 확률/범위를 동일하게 유지할 것.
-- ============================================

drop function if exists public.draw_relic();
drop function if exists public.draw_relic_batch(integer);

create or replace function public.draw_relic()
returns table(
  relic_key text, rarity text, was_duplicate boolean, enhance_attempted boolean,
  enhance_success boolean, new_level integer, cost integer, draw_level integer, bonus_rubies integer
) as $$
declare
  v_draws integer;
  v_draw_level integer;
  v_cost integer;
  v_gold integer;
  v_roll numeric;
  v_rarity_order integer;
  v_rarity_name text;
  v_picked_key text;
  v_existing_level integer;
  v_final_level integer;
  v_was_dup boolean;
  v_attempted boolean := false;
  v_success boolean := false;
  v_success_chance numeric;
  v_bonus_rubies integer := 0;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select p.total_relic_draws into v_draws from public.profiles p where p.id = auth.uid();
  v_draw_level := least(50, 1 + v_draws / 1000);
  v_cost := 1000 + (v_draw_level - 1) * 300;

  select p.gold into v_gold from public.profiles p where p.id = auth.uid() for update;
  if v_gold is null or v_gold < v_cost then
    raise exception '골드가 부족합니다.';
  end if;

  v_roll := random();
  if v_draw_level <= 8 then
    if v_roll < 0.70 then v_rarity_order := 1; elsif v_roll < 0.95 then v_rarity_order := 2; else v_rarity_order := 3; end if;
  elsif v_draw_level <= 18 then
    if v_roll < 0.50 then v_rarity_order := 1; elsif v_roll < 0.82 then v_rarity_order := 2; elsif v_roll < 0.97 then v_rarity_order := 3; else v_rarity_order := 4; end if;
  elsif v_draw_level <= 28 then
    if v_roll < 0.32 then v_rarity_order := 1; elsif v_roll < 0.65 then v_rarity_order := 2; elsif v_roll < 0.90 then v_rarity_order := 3; elsif v_roll < 0.99 then v_rarity_order := 4; else v_rarity_order := 5; end if;
  elsif v_draw_level <= 38 then
    if v_roll < 0.18 then v_rarity_order := 1; elsif v_roll < 0.45 then v_rarity_order := 2; elsif v_roll < 0.75 then v_rarity_order := 3; elsif v_roll < 0.95 then v_rarity_order := 4; else v_rarity_order := 5; end if;
  elsif v_draw_level <= 48 then
    if v_roll < 0.08 then v_rarity_order := 1; elsif v_roll < 0.25 then v_rarity_order := 2; elsif v_roll < 0.55 then v_rarity_order := 3; elsif v_roll < 0.87 then v_rarity_order := 4; else v_rarity_order := 5; end if;
  else
    if v_roll < 0.03 then v_rarity_order := 1; elsif v_roll < 0.13 then v_rarity_order := 2; elsif v_roll < 0.38 then v_rarity_order := 3; elsif v_roll < 0.75 then v_rarity_order := 4; else v_rarity_order := 5; end if;
  end if;

  v_rarity_name := case v_rarity_order
    when 1 then 'normal' when 2 then 'rare' when 3 then 'epic' when 4 then 'legendary' else 'mythic'
  end;

  select rc.relic_key into v_picked_key from public.relic_catalog rc
    where rc.rarity_order = v_rarity_order
    order by random() limit 1;

  update public.profiles set gold = gold - v_cost, total_relic_draws = total_relic_draws + 1
    where id = auth.uid();

  select ur.level into v_existing_level from public.user_relics ur
    where ur.user_id = auth.uid() and ur.relic_key = v_picked_key;

  if v_existing_level is null then
    insert into public.user_relics (user_id, relic_key, level) values (auth.uid(), v_picked_key, 0);
    v_final_level := 0;
    v_was_dup := false;
  else
    v_was_dup := true;
    if v_existing_level >= 200 then
      v_final_level := v_existing_level;
      -- (신규, 사용자 요청) 만강 중복 - 15% 확률로 루비 1~10개 대신 지급(완전 헛뽑기 완화)
      if random() < 0.15 then
        v_bonus_rubies := 1 + floor(random() * 10)::integer;
        update public.profiles set rubies = rubies + v_bonus_rubies where id = auth.uid();
      end if;
    else
      v_attempted := true;
      v_success_chance := greatest(0.30, 1 - v_existing_level * 0.0035);
      if random() < v_success_chance then
        v_success := true;
        v_final_level := least(200, v_existing_level + 1);
        update public.user_relics ur set level = v_final_level
          where ur.user_id = auth.uid() and ur.relic_key = v_picked_key;
      else
        v_final_level := v_existing_level;
      end if;
    end if;
  end if;

  return query select v_picked_key, v_rarity_name, v_was_dup, v_attempted, v_success, v_final_level, v_cost,
    least(50, 1 + (v_draws + 1) / 1000), v_bonus_rubies;
end;
$$ language plpgsql security definer;

create or replace function public.draw_relic_batch(p_count integer)
returns table(
  relic_key text, rarity text, was_duplicate boolean, enhance_attempted boolean,
  enhance_success boolean, new_level integer, cost integer, draw_level integer, bonus_rubies integer
) as $$
declare
  v_i integer;
  v_draws integer;
  v_draw_level integer;
  v_cost integer;
  v_gold integer;
  v_roll numeric;
  v_rarity_order integer;
  v_rarity_name text;
  v_picked_key text;
  v_existing_level integer;
  v_final_level integer;
  v_was_dup boolean;
  v_attempted boolean;
  v_success boolean;
  v_success_chance numeric;
  v_bonus_rubies integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_count < 1 or p_count > 100 then
    raise exception '유효하지 않은 횟수입니다.';
  end if;

  for v_i in 1..p_count loop
    v_attempted := false;
    v_success := false;
    v_bonus_rubies := 0;

    select p.total_relic_draws into v_draws from public.profiles p where p.id = auth.uid();
    v_draw_level := least(50, 1 + v_draws / 1000);
    v_cost := 1000 + (v_draw_level - 1) * 300;

    select p.gold into v_gold from public.profiles p where p.id = auth.uid() for update;
    if v_gold is null or v_gold < v_cost then
      exit;
    end if;

    v_roll := random();
    if v_draw_level <= 8 then
      if v_roll < 0.70 then v_rarity_order := 1; elsif v_roll < 0.95 then v_rarity_order := 2; else v_rarity_order := 3; end if;
    elsif v_draw_level <= 18 then
      if v_roll < 0.50 then v_rarity_order := 1; elsif v_roll < 0.82 then v_rarity_order := 2; elsif v_roll < 0.97 then v_rarity_order := 3; else v_rarity_order := 4; end if;
    elsif v_draw_level <= 28 then
      if v_roll < 0.32 then v_rarity_order := 1; elsif v_roll < 0.65 then v_rarity_order := 2; elsif v_roll < 0.90 then v_rarity_order := 3; elsif v_roll < 0.99 then v_rarity_order := 4; else v_rarity_order := 5; end if;
    elsif v_draw_level <= 38 then
      if v_roll < 0.18 then v_rarity_order := 1; elsif v_roll < 0.45 then v_rarity_order := 2; elsif v_roll < 0.75 then v_rarity_order := 3; elsif v_roll < 0.95 then v_rarity_order := 4; else v_rarity_order := 5; end if;
    elsif v_draw_level <= 48 then
      if v_roll < 0.08 then v_rarity_order := 1; elsif v_roll < 0.25 then v_rarity_order := 2; elsif v_roll < 0.55 then v_rarity_order := 3; elsif v_roll < 0.87 then v_rarity_order := 4; else v_rarity_order := 5; end if;
    else
      if v_roll < 0.03 then v_rarity_order := 1; elsif v_roll < 0.13 then v_rarity_order := 2; elsif v_roll < 0.38 then v_rarity_order := 3; elsif v_roll < 0.75 then v_rarity_order := 4; else v_rarity_order := 5; end if;
    end if;

    v_rarity_name := case v_rarity_order
      when 1 then 'normal' when 2 then 'rare' when 3 then 'epic' when 4 then 'legendary' else 'mythic'
    end;

    select rc.relic_key into v_picked_key from public.relic_catalog rc
      where rc.rarity_order = v_rarity_order
      order by random() limit 1;

    update public.profiles set gold = gold - v_cost, total_relic_draws = total_relic_draws + 1
      where id = auth.uid();

    select ur.level into v_existing_level from public.user_relics ur
      where ur.user_id = auth.uid() and ur.relic_key = v_picked_key;

    if v_existing_level is null then
      insert into public.user_relics (user_id, relic_key, level) values (auth.uid(), v_picked_key, 0);
      v_final_level := 0;
      v_was_dup := false;
    else
      v_was_dup := true;
      if v_existing_level >= 200 then
        v_final_level := v_existing_level;
        if random() < 0.15 then
          v_bonus_rubies := 1 + floor(random() * 10)::integer;
          update public.profiles set rubies = rubies + v_bonus_rubies where id = auth.uid();
        end if;
      else
        v_attempted := true;
        v_success_chance := greatest(0.30, 1 - v_existing_level * 0.0035);
        if random() < v_success_chance then
          v_success := true;
          v_final_level := least(200, v_existing_level + 1);
          update public.user_relics ur set level = v_final_level
            where ur.user_id = auth.uid() and ur.relic_key = v_picked_key;
        else
          v_final_level := v_existing_level;
        end if;
      end if;
    end if;

    relic_key := v_picked_key;
    rarity := v_rarity_name;
    was_duplicate := v_was_dup;
    enhance_attempted := v_attempted;
    enhance_success := v_success;
    new_level := v_final_level;
    cost := v_cost;
    draw_level := least(50, 1 + (v_draws + 1) / 1000);
    bonus_rubies := v_bonus_rubies;
    return next;
  end loop;

  return;
end;
$$ language plpgsql security definer;
