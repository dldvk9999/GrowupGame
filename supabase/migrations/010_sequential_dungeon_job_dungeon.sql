-- ============================================
-- 010: 던전 순차 진행 + 전직 던전 시스템
-- Supabase SQL Editor에 순서대로 실행 (001~009 먼저 적용되어 있어야 함)
-- ============================================

-- ============================================
-- 1. 던전 순차 진행 (1층부터 시작, 깨야 다음층으로. 실패하면 그 층에 계속 머무름)
-- ============================================
create table public.dungeon_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  dungeon_type text not null check (dungeon_type in ('exp', 'gold')),
  cleared_stage integer not null default 0,
  primary key (user_id, dungeon_type)
);

alter table public.dungeon_progress enable row level security;
create policy "dungeon_progress는 본인만 조회" on public.dungeon_progress for select using (auth.uid() = user_id);
revoke insert, update, delete on public.dungeon_progress from authenticated;

drop function if exists public.use_dungeon_attempt(text, integer);

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

  v_today := (now() at time zone 'Asia/Seoul')::date;

  insert into public.dungeon_attempts (user_id, dungeon_type, attempt_date, count)
  values (auth.uid(), p_dungeon_type, v_today, 1)
  on conflict (user_id, dungeon_type, attempt_date)
    do update set count = public.dungeon_attempts.count + 1
    where public.dungeon_attempts.count < 3
  returning count into v_new_count;

  if v_new_count is null then
    raise exception '오늘 입장 횟수를 모두 사용했습니다. (하루 3회)';
  end if;

  insert into public.dungeon_sessions (user_id, dungeon_type, stage)
  values (auth.uid(), p_dungeon_type, v_stage)
  returning id into v_session_id;

  return query select v_session_id, 3 - v_new_count, v_stage;
end;
$$ language plpgsql security definer;

drop function if exists public.claim_dungeon_reward(uuid);

create or replace function public.claim_dungeon_reward(p_session_id uuid)
returns integer as $$
declare
  v_session public.dungeon_sessions;
  v_gold integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.dungeon_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null then
    raise exception '유효하지 않은 던전 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 보상을 받은 던전입니다.';
  end if;

  update public.dungeon_sessions set claimed = true where id = p_session_id;

  insert into public.dungeon_progress (user_id, dungeon_type, cleared_stage)
  values (auth.uid(), v_session.dungeon_type, v_session.stage)
  on conflict (user_id, dungeon_type) do update
    set cleared_stage = greatest(public.dungeon_progress.cleared_stage, v_session.stage);

  v_gold := public.calc_dungeon_gold(v_session.dungeon_type, v_session.stage);
  perform public.add_gold(auth.uid(), v_gold);
  return v_gold;
end;
$$ language plpgsql security definer;

-- ============================================
-- 2. 전직 던전
-- ============================================
alter table public.owned_monsters
  add column unlocked_job_tier integer not null default 0
  check (unlocked_job_tier >= 0 and unlocked_job_tier <= 3);

create table public.job_dungeon_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  owned_monster_id uuid not null references public.owned_monsters(id) on delete cascade,
  tier integer not null check (tier in (1, 2, 3)),
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.job_dungeon_sessions enable row level security;
create policy "job_dungeon_sessions는 본인만 조회" on public.job_dungeon_sessions for select using (auth.uid() = user_id);
revoke insert, update, delete on public.job_dungeon_sessions from authenticated;

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
  if p_tier not in (1, 2, 3) then
    raise exception '유효하지 않은 전직 단계입니다.';
  end if;

  select * into v_monster from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  v_required_level := case p_tier when 1 then 30 when 2 then 60 when 3 then 100 end;
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

create or replace function public.claim_job_dungeon(p_session_id uuid)
returns void as $$
declare
  v_session public.job_dungeon_sessions;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.job_dungeon_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null then
    raise exception '유효하지 않은 전직 던전 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 완료한 전직입니다.';
  end if;

  update public.job_dungeon_sessions set claimed = true where id = p_session_id;
  update public.owned_monsters set unlocked_job_tier = v_session.tier where id = v_session.owned_monster_id;
end;
$$ language plpgsql security definer;
