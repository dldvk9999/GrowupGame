-- ============================================
-- 029: 가이드미션 쿨다운 오탐 버그 수정 + 5차 전직(Lv.180) 추가
-- Supabase SQL Editor에 순서대로 실행 (001~028 먼저 적용되어 있어야 함)
-- ============================================

-- ============================================
-- 1. 미션 쿨다운 버그 수정
--    문제: increment_mission_progress가 진행도를 올릴 때마다 updated_at도 갱신했는데,
--    claim_mission_reward의 20초 쿨다운 체크가 이 updated_at을 기준으로 삼고 있었음.
--    그래서 "미션을 완료시키는 마지막 진행도 증가"가 일어난 직후 바로 완료 버튼을 눌러도
--    "너무 빠릅니다"가 뜨는 오탐이 발생했음(정상적으로 방금 막 완료했을 뿐인데도).
--    → "미션이 배정된 시각"을 별도 컬럼(assigned_at)으로 분리해서, 쿨다운은 그 시각만 기준으로 삼음.
-- ============================================
alter table public.mission_state add column assigned_at timestamptz not null default now();

create or replace function public.init_mission_state()
returns public.mission_state as $$
declare
  v_row public.mission_state;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_row from public.mission_state where user_id = auth.uid();
  if v_row is null then
    insert into public.mission_state (user_id, mission_number, mission_key, target, progress, reward_gold, is_priority, assigned_at)
    values (auth.uid(), 1, 'kill_monsters', 10, 0, 800, false, now())
    returning * into v_row;
  end if;

  return v_row;
end;
$$ language plpgsql security definer;

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

  if now() - v_row.assigned_at < interval '20 seconds' then
    raise exception '너무 빠릅니다. 잠시 후 다시 시도해주세요.';
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
  elsif v_row.mission_key = 'job_tier5' then
    v_completed := coalesce(v_monster.unlocked_job_tier, 0) >= 5;
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
  elsif v_monster.level >= 180 and coalesce(v_monster.unlocked_job_tier, 0) < 5 then
    v_next_key := 'job_tier5'; v_next_target := 1; v_next_reward := 40000; v_next_priority := true;
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
    updated_at = now(),
    assigned_at = now()
  where user_id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$ language plpgsql security definer;

-- ============================================
-- 2. 5차 전직 (Lv.180) 추가
-- ============================================
alter table public.owned_monsters drop constraint if exists owned_monsters_unlocked_job_tier_check;
alter table public.owned_monsters add constraint owned_monsters_unlocked_job_tier_check
  check (unlocked_job_tier >= 0 and unlocked_job_tier <= 5);

alter table public.job_dungeon_sessions drop constraint if exists job_dungeon_sessions_tier_check;
alter table public.job_dungeon_sessions add constraint job_dungeon_sessions_tier_check
  check (tier in (1, 2, 3, 4, 5));

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
  v_ceiling_hp := ceil(v_species.base_hp * v_growth * 16.0 * 1.05);
  v_ceiling_atk := ceil(v_species.base_atk * v_growth * 16.0 * 1.05);
  v_ceiling_def := ceil(v_species.base_def * v_growth * 16.0 * 1.05);

  if p_hp < 0 or p_atk < 0 or p_def < 0
     or p_hp > v_ceiling_hp or p_atk > v_ceiling_atk or p_def > v_ceiling_def then
    raise exception '스탯 값이 비정상적입니다.';
  end if;

  update public.owned_monsters set
    level = p_level, exp = p_exp, hp = p_hp, atk = p_atk, def = p_def, species_id = p_species_id
  where id = p_owned_monster_id;
end;
$$ language plpgsql security definer;

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
  if p_tier not in (1, 2, 3, 4, 5) then
    raise exception '유효하지 않은 전직 단계입니다.';
  end if;

  select * into v_monster from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  v_required_level := case p_tier when 1 then 30 when 2 then 60 when 3 then 100 when 4 then 140 when 5 then 180 end;
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

create or replace function public.calc_monster_stats(p_species_id integer, p_level integer, p_unlocked_job_tier integer)
returns table(max_hp integer, atk integer, def integer) as $$
declare
  v_species record;
  v_growth numeric;
  v_job_mult numeric;
begin
  select * into v_species from public.monster_species where id = p_species_id;
  v_growth := 1 + (p_level - 1) * 0.12;
  v_job_mult := case coalesce(p_unlocked_job_tier, 0)
    when 1 then 2.0 when 2 then 3.5 when 3 then 6.0 when 4 then 10.0 when 5 then 16.0 else 1.0
  end;
  max_hp := round(v_species.base_hp * v_growth * v_job_mult);
  atk := round(v_species.base_atk * v_growth * v_job_mult);
  def := round(v_species.base_def * v_growth * v_job_mult);
  return next;
end;
$$ language plpgsql stable;
