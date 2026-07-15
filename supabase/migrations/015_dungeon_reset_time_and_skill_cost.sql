-- ============================================
-- 015: 던전 리셋시각 08:00(서울)로 변경 + 스킬뽑기 정가 300골드
-- Supabase SQL Editor에 순서대로 실행 (001~014 먼저 적용되어 있어야 함)
-- ============================================

-- ============================================
-- 1. 던전 하루 3회 초기화 기준을 자정 → 오전 8시(서울)로 변경
-- ============================================
create or replace function public.use_dungeon_attempt(p_dungeon_type text)
returns table(session_id uuid, remaining integer, stage integer) as $$
declare
  v_today date;
  v_new_count integer;
  v_session_id uuid;
  v_stage integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_dungeon_type not in ('exp', 'gold') then
    raise exception '유효하지 않은 던전입니다.';
  end if;

  select coalesce(cleared_stage, 0) + 1 into v_stage from public.dungeon_progress
    where user_id = auth.uid() and dungeon_type = p_dungeon_type;
  if v_stage is null then
    v_stage := 1;
  end if;
  if v_stage > 10 then
    v_stage := 10;
  end if;

  v_today := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;

  insert into public.dungeon_attempts (user_id, dungeon_type, attempt_date, count)
  values (auth.uid(), p_dungeon_type, v_today, 1)
  on conflict (user_id, dungeon_type, attempt_date)
    do update set count = public.dungeon_attempts.count + 1
    where public.dungeon_attempts.count < 3
  returning count into v_new_count;

  if v_new_count is null then
    raise exception '오늘 입장 횟수를 모두 사용했습니다. (하루 3회, 매일 오전 8시 초기화)';
  end if;

  insert into public.dungeon_sessions (user_id, dungeon_type, stage)
  values (auth.uid(), p_dungeon_type, v_stage)
  returning id into v_session_id;

  return query select v_session_id, 3 - v_new_count, v_stage;
end;
$$ language plpgsql security definer;

-- ============================================
-- 2. 스킬 뽑기 비용을 뽑기레벨과 무관하게 1회당 정가 300골드로 고정
-- ============================================
create or replace function public.draw_skill()
returns table(skill_key text, new_skill_level integer, was_duplicate boolean, cost integer, draw_level integer) as $$
declare
  v_draws integer;
  v_draw_level integer;
  v_cost integer := 300;
  v_gold integer;
  v_roll numeric;
  v_rarity_order integer;
  v_picked_key text;
  v_existing_level integer;
  v_final_level integer;
  v_was_dup boolean;
  w_normal numeric; w_rare numeric; w_epic numeric; w_legendary numeric; w_mythic numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select p.total_skill_draws into v_draws from public.profiles p where p.id = auth.uid();
  v_draw_level := least(20, 1 + v_draws / 1000);

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
    v_final_level := least(v_existing_level + 3, 100);
    update public.user_skills us set skill_level = v_final_level
      where us.user_id = auth.uid() and us.skill_key = v_picked_key;
    v_was_dup := true;
  end if;

  return query select v_picked_key, v_final_level, v_was_dup, v_cost, least(20, 1 + (v_draws + 1) / 1000);
end;
$$ language plpgsql security definer;

create or replace function public.draw_skill_batch(p_count integer)
returns table(skill_key text, new_skill_level integer, was_duplicate boolean, cost integer, draw_level integer) as $$
declare
  v_i integer;
  v_draws integer;
  v_draw_level integer;
  v_cost integer := 300;
  v_gold integer;
  v_roll numeric;
  v_rarity_order integer;
  v_picked_key text;
  v_existing_level integer;
  v_final_level integer;
  v_was_dup boolean;
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
    v_draw_level := least(20, 1 + v_draws / 1000);

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
      v_final_level := least(v_existing_level + 3, 100);
      update public.user_skills us set skill_level = v_final_level
        where us.user_id = auth.uid() and us.skill_key = v_picked_key;
      v_was_dup := true;
    end if;

    skill_key := v_picked_key;
    new_skill_level := v_final_level;
    was_duplicate := v_was_dup;
    cost := v_cost;
    draw_level := least(20, 1 + (v_draws + 1) / 1000);
    return next;
  end loop;

  return;
end;
$$ language plpgsql security definer;
