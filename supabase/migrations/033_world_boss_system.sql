-- ============================================
-- 033: 월드보스 시스템
-- Supabase SQL Editor에 순서대로 실행 (001~032 먼저 적용되어 있어야 함)
-- ============================================

-- ============================================
-- 1. 스키마
-- ============================================
alter table public.profiles add column dragon_buff_until timestamptz;

create table public.world_boss_state (
  week_key text primary key,          -- 그 주의 일요일 날짜(YYYY-MM-DD), 일요일 00:00(서울시간) 기준 리셋
  max_hp bigint not null,
  current_hp bigint not null,
  atk integer not null,
  def integer not null,
  cleared boolean not null default false,
  cleared_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.world_boss_state enable row level security;
create policy "world_boss_state는 누구나 조회 가능" on public.world_boss_state for select using (true);
revoke insert, update, delete on public.world_boss_state from authenticated;

create table public.world_boss_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_date date not null,
  count integer not null default 0,
  primary key (user_id, attempt_date)
);
alter table public.world_boss_attempts enable row level security;
create policy "world_boss_attempts는 본인만 조회" on public.world_boss_attempts for select using (auth.uid() = user_id);
revoke insert, update, delete on public.world_boss_attempts from authenticated;

create table public.world_boss_contributions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_key text not null,
  total_damage bigint not null default 0,
  primary key (user_id, week_key)
);
alter table public.world_boss_contributions enable row level security;
create policy "world_boss_contributions는 누구나 조회 가능" on public.world_boss_contributions for select using (true);
revoke insert, update, delete on public.world_boss_contributions from authenticated;

-- ============================================
-- 2. 주간 리셋 + 보상 정산 (지연생성 방식, 우편함/PvP상점과 동일 패턴)
-- ============================================
create or replace function public.sync_world_boss()
returns void as $$
declare
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
  v_prev_state public.world_boss_state;
  v_contrib record;
  v_reward integer;
begin
  if exists (select 1 from public.world_boss_state where week_key = v_week) then
    return;
  end if;

  select * into v_prev_state from public.world_boss_state order by week_key desc limit 1;
  if v_prev_state is not null and not v_prev_state.cleared then
    for v_contrib in
      select * from public.world_boss_contributions
      where week_key = v_prev_state.week_key and total_damage > 0
    loop
      v_reward := least(300000, greatest(100, round(v_contrib.total_damage / 150.0)));
      perform public.add_gold(v_contrib.user_id, v_reward);
      insert into public.mails (user_id, title, body, gold_amount, source_key)
      values (
        v_contrib.user_id,
        '월드보스 참전 보상',
        '이번 주 월드보스에게 입힌 피해량만큼 골드를 보내드려요. 다음 주엔 꼭 처치해봐요!',
        v_reward,
        'worldboss_reward_' || v_prev_state.week_key
      )
      on conflict (user_id, source_key) do nothing;
    end loop;
  end if;

  insert into public.world_boss_state (week_key, max_hp, current_hp, atk, def)
  values (v_week, 30000000, 30000000, 4500, 1200);
end;
$$ language plpgsql security definer;

create or replace function public.get_world_boss_state()
returns public.world_boss_state as $$
declare
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
  v_row public.world_boss_state;
begin
  select * into v_row from public.world_boss_state where week_key = v_week;
  return v_row;
end;
$$ language plpgsql stable security definer;

create or replace function public.fetch_my_world_boss_progress()
returns table(attempts_used integer, my_week_damage bigint) as $$
declare
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
  v_today date := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;
  v_used integer;
  v_dmg bigint;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  select count into v_used from public.world_boss_attempts where user_id = auth.uid() and attempt_date = v_today;
  select total_damage into v_dmg from public.world_boss_contributions where user_id = auth.uid() and week_key = v_week;
  return query select coalesce(v_used, 0), coalesce(v_dmg, 0);
end;
$$ language plpgsql stable security definer;

-- ============================================
-- 3. 입장 (하루 3회 제한, 원자적 증가로 레이스컨디션 방지)
-- ============================================
create or replace function public.enter_world_boss()
returns table(
  session_id uuid, week_key text, boss_current_hp bigint, boss_max_hp bigint,
  boss_atk integer, boss_def integer, remaining_attempts integer
) as $$
declare
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
  v_today date := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;
  v_new_count integer;
  v_boss public.world_boss_state;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_boss from public.world_boss_state where week_key = v_week;
  if v_boss is null then
    raise exception '월드보스가 아직 생성되지 않았습니다.';
  end if;
  if v_boss.cleared then
    raise exception '이번 주 월드보스는 이미 처치되었습니다.';
  end if;

  insert into public.world_boss_attempts (user_id, attempt_date, count)
  values (auth.uid(), v_today, 1)
  on conflict (user_id, attempt_date)
    do update set count = public.world_boss_attempts.count + 1
    where public.world_boss_attempts.count < 3
  returning count into v_new_count;

  if v_new_count is null then
    raise exception '오늘 월드보스 도전 횟수를 모두 사용했습니다.';
  end if;

  return query select gen_random_uuid(), v_week, v_boss.current_hp, v_boss.max_hp, v_boss.atk, v_boss.def, 3 - v_new_count;
end;
$$ language plpgsql security definer;

-- ============================================
-- 4. 전투 결과 반영 (데미지는 전투력 기반 상한으로 클램프, 클리어 시 이번주 기여자 전원 용의버프 지급)
-- ============================================
create or replace function public.report_world_boss_damage(p_week_key text, p_damage bigint)
returns table(new_current_hp bigint, boss_max_hp bigint, cleared_now boolean) as $$
declare
  v_boss public.world_boss_state;
  v_my_power integer;
  v_cap bigint;
  v_applied bigint;
  v_cleared boolean := false;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_damage is null or p_damage < 0 then
    raise exception '유효하지 않은 데미지입니다.';
  end if;

  select * into v_boss from public.world_boss_state where week_key = p_week_key for update;
  if v_boss is null then
    raise exception '월드보스를 찾을 수 없습니다.';
  end if;
  if v_boss.cleared then
    return query select v_boss.current_hp, v_boss.max_hp, true;
    return;
  end if;

  v_my_power := public.fetch_my_combat_power();
  v_cap := greatest(2000, v_my_power::bigint * 60);
  v_applied := least(p_damage, v_cap, v_boss.current_hp);

  update public.world_boss_state set current_hp = current_hp - v_applied where week_key = p_week_key;

  insert into public.world_boss_contributions (user_id, week_key, total_damage)
  values (auth.uid(), p_week_key, v_applied)
  on conflict (user_id, week_key)
    do update set total_damage = public.world_boss_contributions.total_damage + v_applied;

  if v_boss.current_hp - v_applied <= 0 then
    v_cleared := true;
    update public.world_boss_state set cleared = true, cleared_at = now() where week_key = p_week_key;

    update public.profiles set dragon_buff_until = now() + interval '7 days'
      where id in (
        select user_id from public.world_boss_contributions
        where week_key = p_week_key and total_damage > 0
      );
  end if;

  return query select greatest(0, v_boss.current_hp - v_applied), v_boss.max_hp, v_cleared;
end;
$$ language plpgsql security definer;
