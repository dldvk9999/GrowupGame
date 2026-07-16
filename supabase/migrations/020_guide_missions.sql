-- ============================================
-- 020: 가이드 미션 시스템
-- Supabase SQL Editor에 순서대로 실행 (001~019 먼저 적용되어 있어야 함)
-- ============================================

create table public.mission_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mission_number integer not null default 1,
  mission_key text not null default 'kill_monsters',
  target integer not null default 10,
  progress integer not null default 0,
  reward_gold integer not null default 800,
  is_priority boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.mission_state enable row level security;
create policy "mission_state는 본인만 조회" on public.mission_state for select using (auth.uid() = user_id);
revoke insert, update, delete on public.mission_state from authenticated;

-- 최초 미션 생성 (없으면 만들고, 있으면 그대로 반환)
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
    insert into public.mission_state (user_id, mission_number, mission_key, target, progress, reward_gold, is_priority)
    values (auth.uid(), 1, 'kill_monsters', 10, 0, 800, false)
    returning * into v_row;
  end if;

  return v_row;
end;
$$ language plpgsql security definer;

-- 진행도 증가 (현재 활성 미션 키와 일치할 때만 반영, 1회 최대치 제한으로 남용 방지)
create or replace function public.increment_mission_progress(p_mission_key text, p_amount integer)
returns public.mission_state as $$
declare
  v_row public.mission_state;
  v_amount integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_row from public.mission_state where user_id = auth.uid();
  if v_row is null then
    v_row := public.init_mission_state();
  end if;

  if v_row.mission_key <> p_mission_key then
    return v_row;
  end if;

  v_amount := greatest(0, least(p_amount, 1000));

  update public.mission_state
    set progress = least(target, progress + v_amount), updated_at = now()
    where user_id = auth.uid()
    returning * into v_row;

  return v_row;
end;
$$ language plpgsql security definer;

-- 미션 완료 보상 수령 + 다음 미션 결정
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
  elsif v_equipped_count < v_slot_limit then
    v_next_key := 'equip_skill_slot'; v_next_target := 1; v_next_reward := 1000; v_next_priority := true;
  else
    v_rotation := v_next_number % 4;
    if v_rotation = 0 then
      v_next_key := 'kill_monsters'; v_next_target := 10; v_next_reward := 800;
    elsif v_rotation = 1 then
      v_next_key := 'spend_gold'; v_next_target := 10000; v_next_reward := 1000;
    elsif v_rotation = 2 then
      v_next_key := 'login_minutes'; v_next_target := 10; v_next_reward := 600;
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
-- 우편함: 수령 완료(claimed=true)한 우편은 본인이 직접 삭제할 수 있게 허용
-- ============================================
create policy "mails는 본인 수령완료건만 삭제 가능"
  on public.mails for delete
  using (auth.uid() = user_id and claimed = true);

grant delete on public.mails to authenticated;
