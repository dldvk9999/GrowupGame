-- ============================================
-- 127: 전직 6~10차 확장 (레벨 240/300/360/420/480, 최종 최대레벨 500) - 신규 콘텐츠(사용자 요청)
--
-- 클라이언트(jobAdvancement.js)에 이미 추가한 6~10차 배율(24/34/48/66/90배)을
-- 서버 계산에도 반영. 6~10차 전직 던전은 레벨 조건뿐 아니라 무한의 탑 최소층수,
-- 가이드미션 최소 진행도, 특정 업적 보유까지 서버에서 실제로 검증함(사용자 요청 -
-- "단순히 레벨만 조건으로 있는 것이 아니라" 갈수록 여러 시스템에 걸친 조건 추가).
--
-- calc_monster_stats/save_monster_growth는 반환타입 그대로라 DROP FUNCTION 불필요.
-- start_job_dungeon도 반환타입(uuid) 그대로라 DROP FUNCTION 불필요.
-- ============================================

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
    when 1 then 2.0 when 2 then 3.5 when 3 then 6.0 when 4 then 10.0 when 5 then 16.0
    when 6 then 24.0 when 7 then 34.0 when 8 then 48.0 when 9 then 66.0 when 10 then 90.0
    else 1.0
  end;
  max_hp := round(v_species.base_hp * v_growth * v_job_mult);
  atk := round(v_species.base_atk * v_growth * v_job_mult);
  def := round(v_species.base_def * v_growth * v_job_mult);
  return next;
end;
$$ language plpgsql stable;

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

  -- 최대 레벨 500 (10차 전직 확장, 사용자 요청)
  if p_level > 500 then
    raise exception '최대 레벨(500)을 초과할 수 없습니다.';
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
  -- 상한 배율을 10차 전직 최대치(90.0)에 맞춰 상향(기존 16.0)
  v_ceiling_hp := ceil(v_species.base_hp * v_growth * 90.0 * 1.05);
  v_ceiling_atk := ceil(v_species.base_atk * v_growth * 90.0 * 1.05);
  v_ceiling_def := ceil(v_species.base_def * v_growth * 90.0 * 1.05);

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
  v_tower_floor integer;
  v_mission_number integer;
  v_required_tower integer;
  v_required_mission integer;
  v_required_achievement text;
  v_has_achievement boolean;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_tier not in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10) then
    raise exception '유효하지 않은 전직 단계입니다.';
  end if;

  select * into v_monster from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  v_required_level := case p_tier
    when 1 then 30 when 2 then 60 when 3 then 100 when 4 then 140 when 5 then 180
    when 6 then 240 when 7 then 300 when 8 then 360 when 9 then 420 when 10 then 480
  end;
  if v_monster.level < v_required_level then
    raise exception '레벨이 부족합니다. (Lv.% 필요)', v_required_level;
  end if;
  if v_monster.unlocked_job_tier <> p_tier - 1 then
    raise exception '이전 단계 전직을 먼저 완료해야 합니다.';
  end if;

  -- 6~10차는 레벨 외 추가 조건(무한의 탑 최소층 / 가이드미션 최소 진행 / 특정 업적 보유)을 검증
  if p_tier >= 6 then
    v_required_tower := case p_tier when 6 then 20 when 7 then 40 when 8 then 60 when 9 then 80 when 10 then 100 end;
    v_required_mission := case p_tier when 7 then 15 when 8 then 25 when 9 then 35 when 10 then 50 else null end;
    v_required_achievement := case p_tier when 8 then 'stage_clear_1000' when 9 then 'power_1m' when 10 then 'level_180' else null end;

    select coalesce(highest_floor, 0) into v_tower_floor from public.tower_progress where user_id = auth.uid();
    if coalesce(v_tower_floor, 0) < v_required_tower then
      raise exception '무한의 탑 %층 이상 도달해야 합니다. (현재 %층)', v_required_tower, coalesce(v_tower_floor, 0);
    end if;

    if v_required_mission is not null then
      select mission_number into v_mission_number from public.mission_state where user_id = auth.uid();
      if coalesce(v_mission_number, 1) < v_required_mission then
        raise exception '가이드미션을 %개 이상 진행해야 합니다.', v_required_mission;
      end if;
    end if;

    if v_required_achievement is not null then
      select exists(
        select 1 from public.achievement_claims
        where user_id = auth.uid() and achievement_key = v_required_achievement
      ) into v_has_achievement;
      if not v_has_achievement then
        raise exception '필요한 업적을 아직 달성하지 못했습니다.';
      end if;
    end if;
  end if;

  insert into public.job_dungeon_sessions (user_id, owned_monster_id, tier)
  values (auth.uid(), v_monster.id, p_tier)
  returning id into v_session_id;

  return v_session_id;
end;
$$ language plpgsql security definer;

-- 체크 제약도 반드시 같이 갱신해야 함(021/029에서 4차/5차 추가 때마다 매번 갱신했던
-- 패턴 그대로 - 079/104에서 이 단계를 빠뜨려 던전 크래시가 났던 전례가 있어 특히 주의).
alter table public.owned_monsters drop constraint if exists owned_monsters_unlocked_job_tier_check;
alter table public.owned_monsters add constraint owned_monsters_unlocked_job_tier_check
  check (unlocked_job_tier >= 0 and unlocked_job_tier <= 10);

alter table public.job_dungeon_sessions drop constraint if exists job_dungeon_sessions_tier_check;
alter table public.job_dungeon_sessions add constraint job_dungeon_sessions_tier_check
  check (tier in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
