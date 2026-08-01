-- ============================================
-- 158: 길드 레이드 던전(Guild Raid) 신설 - 신규 콘텐츠(사용자 요청 "던전 컨텐츠 위주로 여러개")
--
-- 길드(154)는 소속감/랭킹까지는 있었지만 "길드원들이 함께 협력해서 처치하는 목표물"이
-- 없었음 - 방치형 RPG 업계에서 길드 시스템의 완성도를 크게 좌우하는 요소가 바로 이
-- "길드 레이드"(비동기 협동 보스). 월드보스(033/036/144)를 그대로 축소 복제해서
-- "전체 서버 공용 체력" 대신 "내 길드(최대 30명) 전용 공유 체력"으로 스코프만 좁힘.
--
-- 월드보스가 036에서 뒤늦게 겪었던 보안 취약점(세션 검증 없이 report 함수를 무제한
-- 반복호출하면 하루 3회 제한이 무력화되는 문제)을 이번엔 처음부터 반영 - guild_raid_sessions
-- 테이블로 "실제로 enter했는지 + 본인 세션인지 + 아직 안 썼는지"를 처음부터 검증함.
-- ============================================

create table public.guild_raid_state (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  week_key text not null,          -- 월드보스와 동일하게 그 주의 일요일 날짜(YYYY-MM-DD), 서울시간 기준
  max_hp bigint not null,
  current_hp bigint not null,
  atk integer not null,
  def integer not null,
  cleared boolean not null default false,
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (guild_id, week_key)
);
alter table public.guild_raid_state enable row level security;
create policy "guild_raid_state는 누구나 조회 가능(길드원 확인용)" on public.guild_raid_state for select using (true);
revoke insert, update, delete on public.guild_raid_state from authenticated;

create table public.guild_raid_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_date date not null,
  count integer not null default 0,
  primary key (user_id, attempt_date)
);
alter table public.guild_raid_attempts enable row level security;
create policy "guild_raid_attempts는 본인만 조회" on public.guild_raid_attempts for select using (auth.uid() = user_id);
revoke insert, update, delete on public.guild_raid_attempts from authenticated;

-- 월드보스의 036 교훈을 처음부터 반영: enter 시점에 세션을 발급/기록하고, report는 그 세션이
-- "존재 + 본인 것 + 아직 안 썼음"일 때만 데미지를 반영 후 즉시 소모 처리
create table public.guild_raid_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  week_key text not null,
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);
create index guild_raid_sessions_user_idx on public.guild_raid_sessions(user_id, created_at desc);
alter table public.guild_raid_sessions enable row level security;
create policy "guild_raid_sessions는 본인만 조회" on public.guild_raid_sessions for select using (auth.uid() = user_id);
revoke insert, update, delete on public.guild_raid_sessions from authenticated;

create table public.guild_raid_contributions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  week_key text not null,
  total_damage bigint not null default 0,
  primary key (user_id, guild_id, week_key)
);
create index guild_raid_contributions_guild_idx on public.guild_raid_contributions(guild_id, week_key);
alter table public.guild_raid_contributions enable row level security;
create policy "guild_raid_contributions는 누구나 조회 가능(같은 길드끼리 기여도 확인용)" on public.guild_raid_contributions for select using (true);
revoke insert, update, delete on public.guild_raid_contributions from authenticated;

/** 내 길드 id 조회 헬퍼 - 길드 미가입 시 null */
create or replace function public.my_guild_id()
returns uuid as $$
  select guild_id from public.guild_members where user_id = auth.uid();
$$ language sql stable security definer;

/** 주간 리셋 + 미클리어 시 소정 보상 정산(지연생성 방식, 월드보스 sync_world_boss와 동일 패턴) */
create or replace function public.sync_guild_raid(p_guild_id uuid)
returns void as $$
declare
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
  v_prev_state public.guild_raid_state;
  v_contrib record;
  v_reward integer;
begin
  if exists (select 1 from public.guild_raid_state where guild_id = p_guild_id and week_key = v_week) then
    return;
  end if;

  select * into v_prev_state from public.guild_raid_state
    where guild_id = p_guild_id order by week_key desc limit 1;
  if v_prev_state is not null and not v_prev_state.cleared then
    for v_contrib in
      select * from public.guild_raid_contributions
      where guild_id = p_guild_id and week_key = v_prev_state.week_key and total_damage > 0
    loop
      v_reward := least(80000, greatest(100, round(v_contrib.total_damage / 150.0)));
      perform public.add_gold(v_contrib.user_id, v_reward);
      insert into public.mails (user_id, title, body, gold_amount, source_key)
      values (
        v_contrib.user_id,
        '길드 레이드 참전 보상',
        '이번 주 우리 길드 레이드 보스에게 입힌 피해량만큼 골드를 보내드려요. 다음 주엔 길드원들과 함께 꼭 처치해봐요!',
        v_reward,
        'guild_raid_reward_' || p_guild_id || '_' || v_prev_state.week_key
      )
      on conflict (user_id, source_key) do nothing;
    end loop;
  end if;

  insert into public.guild_raid_state (guild_id, week_key, max_hp, current_hp, atk, def)
  values (p_guild_id, v_week, 15000000, 15000000, 3500, 1000);
end;
$$ language plpgsql security definer;

/** 내 길드의 이번주 레이드 보스 상태 조회(없으면 자동 생성) */
create or replace function public.fetch_guild_raid_state()
returns table(guild_id uuid, guild_name text, week_key text, current_hp bigint, max_hp bigint, atk integer, def integer, cleared boolean) as $$
declare
  v_guild_id uuid;
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  v_guild_id := public.my_guild_id();
  if v_guild_id is null then
    return;
  end if;

  perform public.sync_guild_raid(v_guild_id);

  return query
    select grs.guild_id, g.name, grs.week_key, grs.current_hp, grs.max_hp, grs.atk, grs.def, grs.cleared
    from public.guild_raid_state grs
    join public.guilds g on g.id = grs.guild_id
    where grs.guild_id = v_guild_id and grs.week_key = v_week;
end;
$$ language plpgsql security definer;

/** 하루 남은 도전 횟수 + 이번주 내 기여 피해량 */
create or replace function public.fetch_my_guild_raid_progress()
returns table(attempts_used integer, my_week_damage bigint) as $$
declare
  v_guild_id uuid;
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
  v_today date := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;
  v_used integer;
  v_dmg bigint;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  v_guild_id := public.my_guild_id();
  select count into v_used from public.guild_raid_attempts where user_id = auth.uid() and attempt_date = v_today;
  if v_guild_id is not null then
    select total_damage into v_dmg from public.guild_raid_contributions
      where user_id = auth.uid() and guild_id = v_guild_id and week_key = v_week;
  end if;
  return query select coalesce(v_used, 0), coalesce(v_dmg, 0);
end;
$$ language plpgsql stable security definer;

/** 길드원 전체의 이번주 기여도 TOP(길드 정원이 30명이라 전원 표시) */
create or replace function public.fetch_guild_raid_contributors()
returns table(nickname text, equipped_title text, total_damage bigint, is_me boolean) as $$
declare
  v_guild_id uuid;
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  v_guild_id := public.my_guild_id();
  if v_guild_id is null then
    return;
  end if;

  return query
    select p.nickname, p.equipped_title, grc.total_damage, grc.user_id = auth.uid() as is_me
    from public.guild_raid_contributions grc
    join public.profiles p on p.id = grc.user_id
    where grc.guild_id = v_guild_id and grc.week_key = v_week and grc.total_damage > 0
    order by grc.total_damage desc
    limit 30;
end;
$$ language plpgsql stable security definer;

/** 입장 (하루 3회 제한, 길드 가입 필수) */
create or replace function public.enter_guild_raid()
returns table(
  session_id uuid, guild_id uuid, week_key text, boss_current_hp bigint, boss_max_hp bigint,
  boss_atk integer, boss_def integer, remaining_attempts integer
) as $$
declare
  v_guild_id uuid;
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
  v_today date := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;
  v_new_count integer;
  v_boss public.guild_raid_state;
  v_session_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  v_guild_id := public.my_guild_id();
  if v_guild_id is null then
    raise exception '길드에 가입되어 있어야 도전할 수 있어요.';
  end if;

  perform public.sync_guild_raid(v_guild_id);
  select * into v_boss from public.guild_raid_state grs where grs.guild_id = v_guild_id and grs.week_key = v_week;
  if v_boss is null then
    raise exception '길드 레이드 보스가 아직 생성되지 않았습니다.';
  end if;
  if v_boss.cleared then
    raise exception '이번 주 길드 레이드는 이미 처치되었습니다.';
  end if;

  insert into public.guild_raid_attempts (user_id, attempt_date, count)
  values (auth.uid(), v_today, 1)
  on conflict (user_id, attempt_date)
    do update set count = public.guild_raid_attempts.count + 1
    where public.guild_raid_attempts.count < 3
  returning count into v_new_count;

  if v_new_count is null then
    raise exception '오늘 길드 레이드 도전 횟수를 모두 사용했습니다.';
  end if;

  insert into public.guild_raid_sessions (user_id, guild_id, week_key)
  values (auth.uid(), v_guild_id, v_week)
  returning id into v_session_id;

  return query select v_session_id, v_guild_id, v_week, v_boss.current_hp, v_boss.max_hp, v_boss.atk, v_boss.def, 3 - v_new_count;
end;
$$ language plpgsql security definer;

/** 전투 결과 반영 (데미지는 전투력 기반 상한으로 클램프, 세션 검증으로 무제한 보고 원천 차단) */
create or replace function public.report_guild_raid_damage(p_session_id uuid, p_damage bigint)
returns table(new_current_hp bigint, boss_max_hp bigint, cleared_now boolean) as $$
declare
  v_session public.guild_raid_sessions;
  v_boss public.guild_raid_state;
  v_my_power integer;
  v_cap bigint;
  v_applied bigint;
  v_cleared boolean := false;
  v_contrib record;
  v_reward integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_damage is null or p_damage < 0 then
    raise exception '유효하지 않은 데미지입니다.';
  end if;

  select * into v_session from public.guild_raid_sessions where id = p_session_id and user_id = auth.uid() for update;
  if v_session is null then
    raise exception '유효하지 않은 전투 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 결과가 반영된 전투입니다.';
  end if;
  update public.guild_raid_sessions set claimed = true where id = p_session_id;

  select * into v_boss from public.guild_raid_state grs
    where grs.guild_id = v_session.guild_id and grs.week_key = v_session.week_key for update;
  if v_boss is null then
    raise exception '길드 레이드 보스를 찾을 수 없습니다.';
  end if;
  if v_boss.cleared then
    return query select v_boss.current_hp, v_boss.max_hp, true;
    return;
  end if;

  v_my_power := public.fetch_my_combat_power();
  v_cap := greatest(2000, v_my_power::bigint * 60);
  v_applied := least(p_damage, v_cap, v_boss.current_hp);

  update public.guild_raid_state set current_hp = current_hp - v_applied
    where guild_id = v_session.guild_id and week_key = v_session.week_key;

  insert into public.guild_raid_contributions (user_id, guild_id, week_key, total_damage)
  values (auth.uid(), v_session.guild_id, v_session.week_key, v_applied)
  on conflict (user_id, guild_id, week_key)
    do update set total_damage = public.guild_raid_contributions.total_damage + v_applied;

  if v_boss.current_hp - v_applied <= 0 then
    v_cleared := true;
    update public.guild_raid_state set cleared = true, cleared_at = now()
      where guild_id = v_session.guild_id and week_key = v_session.week_key;

    for v_contrib in
      select * from public.guild_raid_contributions
      where guild_id = v_session.guild_id and week_key = v_session.week_key and total_damage > 0
    loop
      v_reward := least(200000, greatest(300, round(v_contrib.total_damage / 100.0)));
      insert into public.mails (user_id, title, body, gold_amount, source_key)
      values (
        v_contrib.user_id,
        '길드 레이드 처치 보상',
        '길드원들과 힘을 모아 이번 주 레이드 보스를 쓰러뜨렸어요! 입힌 피해량에 비례한 골드를 받았어요.',
        v_reward,
        'guild_raid_clear_' || v_session.guild_id || '_' || v_session.week_key
      )
      on conflict (user_id, source_key) do nothing;
    end loop;
  end if;

  return query select
    greatest(0, v_boss.current_hp - v_applied),
    v_boss.max_hp,
    v_cleared;
end;
$$ language plpgsql security definer;
