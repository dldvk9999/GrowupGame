-- ============================================
-- 021: 미션 타겟 수정, 장비강화 최대치 1000으로 상향, 4차 전직(Lv.140) 추가
-- Supabase SQL Editor에 순서대로 실행 (001~020 먼저 적용되어 있어야 함)
-- ============================================

-- ============================================
-- 1. "10분 접속 유지" 미션을 "1분 접속 유지"로 변경
-- ============================================
update public.mission_state
  set target = 1
  where mission_key = 'login_minutes' and target = 10;

create or replace function public.claim_mission_reward()
returns public.mission_state as $$
declare
  v_row public.mission_state;
  v_monster record;
  v_equipped_count integer;
  v_slot_limit integer;
  v_completed boolean := false;
  v_next_number integer;
  v_next_key text;
  v_next_target integer;
  v_next_reward integer;
  v_next_priority boolean;
  v_rotation integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_row from public.mission_state where user_id = auth.uid();
  if v_row is null then
    raise exception '진행 중인 미션이 없습니다.';
  end if;

  select level, unlocked_job_tier into v_monster
    from public.owned_monsters where user_id = auth.uid() and is_active = true;

  select coalesce(array_length(equipped_skills, 1), 0) into v_equipped_count
    from public.profiles where id = auth.uid();

  v_slot_limit := case
    when v_monster.level >= 75 then 5
    when v_monster.level >= 50 then 4
    when v_monster.level >= 25 then 3
    when v_monster.level >= 10 then 2
    else 1
  end;

  if v_row.mission_key = 'job_tier1' then
    v_completed := coalesce(v_monster.unlocked_job_tier, 0) >= 1;
  elsif v_row.mission_key = 'job_tier2' then
    v_completed := coalesce(v_monster.unlocked_job_tier, 0) >= 2;
  elsif v_row.mission_key = 'job_tier3' then
    v_completed := coalesce(v_monster.unlocked_job_tier, 0) >= 3;
  elsif v_row.mission_key = 'job_tier4' then
    v_completed := coalesce(v_monster.unlocked_job_tier, 0) >= 4;
  elsif v_row.mission_key = 'equip_skill_slot' then
    v_completed := v_equipped_count >= v_slot_limit;
  else
    v_completed := v_row.progress >= v_row.target;
  end if;

  if not v_completed then
    raise exception '아직 미션을 완료하지 않았습니다.';
  end if;

  perform public.add_gold(auth.uid(), v_row.reward_gold);

  v_next_number := v_row.mission_number + 1;

  if v_monster.level >= 30 and coalesce(v_monster.unlocked_job_tier, 0) < 1 then
    v_next_key := 'job_tier1'; v_next_target := 1; v_next_reward := 3000; v_next_priority := true;
  elsif v_monster.level >= 60 and coalesce(v_monster.unlocked_job_tier, 0) < 2 then
    v_next_key := 'job_tier2'; v_next_target := 1; v_next_reward := 6000; v_next_priority := true;
  elsif v_monster.level >= 100 and coalesce(v_monster.unlocked_job_tier, 0) < 3 then
    v_next_key := 'job_tier3'; v_next_target := 1; v_next_reward := 12000; v_next_priority := true;
  elsif v_monster.level >= 140 and coalesce(v_monster.unlocked_job_tier, 0) < 4 then
    v_next_key := 'job_tier4'; v_next_target := 1; v_next_reward := 24000; v_next_priority := true;
  elsif v_equipped_count < v_slot_limit then
    v_next_key := 'equip_skill_slot'; v_next_target := 1; v_next_reward := 1000; v_next_priority := true;
  else
    v_rotation := v_next_number % 4;
    if v_rotation = 0 then
      v_next_key := 'kill_monsters'; v_next_target := 10; v_next_reward := 800;
    elsif v_rotation = 1 then
      v_next_key := 'spend_gold'; v_next_target := 10000; v_next_reward := 1000;
    elsif v_rotation = 2 then
      v_next_key := 'login_minutes'; v_next_target := 1; v_next_reward := 600;
    else
      v_next_key := 'use_skills'; v_next_target := 15; v_next_reward := 700;
    end if;
    v_next_priority := false;
  end if;

  update public.mission_state set
    mission_number = v_next_number,
    mission_key = v_next_key,
    target = v_next_target,
    progress = 0,
    reward_gold = v_next_reward,
    is_priority = v_next_priority,
    updated_at = now()
  where user_id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$ language plpgsql security definer;

-- ============================================
-- 2. 장비 강화 최대 수치 15 → 1000
-- ============================================
alter table public.user_inventory drop constraint if exists user_inventory_enhance_level_check;
alter table public.user_inventory add constraint user_inventory_enhance_level_check
  check (enhance_level >= 0 and enhance_level <= 1000);

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
    v_final_level := least(1000, v_existing_level + 1);
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
      v_final_level := least(1000, v_existing_level + 1);
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

-- ============================================
-- 3. 4차 전직 (Lv.140) 추가
-- ============================================
alter table public.owned_monsters drop constraint if exists owned_monsters_unlocked_job_tier_check;
alter table public.owned_monsters add constraint owned_monsters_unlocked_job_tier_check
  check (unlocked_job_tier >= 0 and unlocked_job_tier <= 4);

alter table public.job_dungeon_sessions drop constraint if exists job_dungeon_sessions_tier_check;
alter table public.job_dungeon_sessions add constraint job_dungeon_sessions_tier_check
  check (tier in (1, 2, 3, 4));

-- 전직 최대 배율이 10.0배로 상향됨에 맞춰 성장저장 상한선도 갱신
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
  v_ceiling_hp := ceil(v_species.base_hp * v_growth * 10.0 * 1.05);
  v_ceiling_atk := ceil(v_species.base_atk * v_growth * 10.0 * 1.05);
  v_ceiling_def := ceil(v_species.base_def * v_growth * 10.0 * 1.05);

  if p_hp < 0 or p_atk < 0 or p_def < 0
     or p_hp > v_ceiling_hp or p_atk > v_ceiling_atk or p_def > v_ceiling_def then
    raise exception '스탯 값이 비정상적입니다.';
  end if;

  update public.owned_monsters set
    level = p_level, exp = p_exp, hp = p_hp, atk = p_atk, def = p_def, species_id = p_species_id
  where id = p_owned_monster_id;
end;
$$ language plpgsql security definer;

-- 전직 던전 입장: 4차(Lv.140) 조건 추가
create or replace function public.start_job_dungeon(p_tier integer)
returns uuid as $$
declare
  v_monster public.owned_monsters;
  v_required_level integer;
  v_session_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_tier not in (1, 2, 3, 4) then
    raise exception '유효하지 않은 전직 단계입니다.';
  end if;

  select * into v_monster from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  v_required_level := case p_tier when 1 then 30 when 2 then 60 when 3 then 100 when 4 then 140 end;
  if v_monster.level < v_required_level then
    raise exception '레벨이 부족합니다. (Lv.% 필요)', v_required_level;
  end if;
  if v_monster.unlocked_job_tier <> p_tier - 1 then
    raise exception '이전 단계 전직을 먼저 완료해야 합니다.';
  end if;

  insert into public.job_dungeon_sessions (user_id, owned_monster_id, tier)
  values (auth.uid(), v_monster.id, p_tier)
  returning id into v_session_id;

  return v_session_id;
end;
$$ language plpgsql security definer;
