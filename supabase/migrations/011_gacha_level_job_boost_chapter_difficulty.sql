-- ============================================
-- 011: 뽑기레벨 1000회 기준 변경 + 전직 스탯 대폭강화 + 스테이지 챕터단위 난이도 반영
-- Supabase SQL Editor에 순서대로 실행 (001~010 먼저 적용되어 있어야 함)
-- ============================================

-- ============================================
-- 1. 스킬 뽑기 레벨 - 5회당 1레벨 → 1000회당 1레벨
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
  w_normal numeric; w_rare numeric; w_epic numeric; w_legendary numeric; w_mythic numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select p.total_skill_draws into v_draws from public.profiles p where p.id = auth.uid();
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
  v_cost integer;
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

-- ============================================
-- 2. 전직 스탯 배율 대폭 상향(최대 1.9배 → 6.0배)에 맞춰 성장저장 상한선도 갱신
-- ============================================
create or replace function public.save_monster_growth(
  p_owned_monster_id uuid, p_level integer, p_exp integer,
  p_hp integer, p_atk integer, p_def integer, p_species_id integer
) returns void as $$
declare
  v_owner uuid;
  v_old_level integer;
  v_old_species integer;
  v_species record;
  v_growth numeric;
  v_ceiling_hp integer;
  v_ceiling_atk integer;
  v_ceiling_def integer;
begin
  select user_id, level, species_id into v_owner, v_old_level, v_old_species
    from public.owned_monsters where id = p_owned_monster_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception '권한이 없습니다.';
  end if;

  if p_level < v_old_level or p_level > v_old_level + 50 then
    raise exception '레벨 변화량이 비정상적입니다.';
  end if;

  if p_species_id <> v_old_species then
    perform 1 from public.monster_species
      where id = v_old_species and evolves_to = p_species_id and evolve_level <= p_level;
    if not found then
      raise exception '유효하지 않은 진화입니다.';
    end if;
  end if;

  select * into v_species from public.monster_species where id = p_species_id;
  v_growth := 1 + (p_level - 1) * 0.12;
  v_ceiling_hp := ceil(v_species.base_hp * v_growth * 6.0 * 1.05);
  v_ceiling_atk := ceil(v_species.base_atk * v_growth * 6.0 * 1.05);
  v_ceiling_def := ceil(v_species.base_def * v_growth * 6.0 * 1.05);

  if p_hp < 0 or p_atk < 0 or p_def < 0
     or p_hp > v_ceiling_hp or p_atk > v_ceiling_atk or p_def > v_ceiling_def then
    raise exception '스탯 값이 비정상적입니다.';
  end if;

  update public.owned_monsters set
    level = p_level, exp = p_exp, hp = p_hp, atk = p_atk, def = p_def, species_id = p_species_id
  where id = p_owned_monster_id;
end;
$$ language plpgsql security definer;

-- ============================================
-- 3. 스테이지 골드 공식에 챕터(10스테이지) 단위 난이도 계단 반영 (stages.js와 동일 공식 유지)
-- ============================================
create or replace function public.calc_stage_gold(p_chapter integer, p_stage integer)
returns integer as $$
declare
  v_index integer := (p_chapter - 1) * 10 + p_stage;
  v_is_boss boolean := (p_stage = 10);
  v_chapter_step numeric := 1 + (p_chapter - 1) * 0.04;
  v_hp numeric := round(30 + v_index * 4.0 * (case when v_is_boss then 2.1 else 1 end) * v_chapter_step);
begin
  return round((round(v_hp * (case when v_is_boss then 0.9 else 0.4 end)) + p_stage * 2) * 5);
end;
$$ language plpgsql immutable;
