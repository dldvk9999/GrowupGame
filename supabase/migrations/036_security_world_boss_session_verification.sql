-- ============================================
-- 036: 보안 패치 - 월드보스 무제한 데미지 보고 취약점 수정
--
-- 문제: report_world_boss_damage(p_week_key, p_damage)가 "이 유저가 실제로 enter_world_boss로
-- 입장권을 소모하고 전투를 치렀는지"를 전혀 검증하지 않았음. enter_world_boss가 반환하는
-- session_id는 어디에도 저장되지 않는 그냥 버려지는 UUID였음.
-- → devtools에서 report_world_boss_damage를 입장 절차 없이 무한 반복 호출하면
--   하루 3회 제한이 완전히 무시되고(1회 호출당 상한은 있지만 호출 횟수 제한이 없어서),
--   보스 체력을 순식간에 소진시켜 "일주일 동안 다같이 깎는" 레이드 설계 자체가 무력화될 수 있었음.
--
-- 수정: 던전/전직던전과 동일한 세션 검증 패턴 적용.
-- world_boss_sessions 테이블을 신설해서 enter_world_boss가 실제로 세션을 발급/기록하고,
-- report_world_boss_damage는 그 세션이 "존재 + 본인 것 + 아직 안 썼음"일 때만 데미지를 반영하고
-- 세션을 즉시 소모(claimed=true) 처리함 - 세션 하나당 데미지 보고는 정확히 1회만 가능해짐.
--
-- Supabase SQL Editor에 순서대로 실행 (001~035 먼저 적용되어 있어야 함)
-- ============================================

create table public.world_boss_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_key text not null,
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);
create index world_boss_sessions_user_idx on public.world_boss_sessions(user_id, created_at desc);

alter table public.world_boss_sessions enable row level security;
create policy "world_boss_sessions는 본인만 조회" on public.world_boss_sessions for select using (auth.uid() = user_id);
revoke insert, update, delete on public.world_boss_sessions from authenticated;

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
  v_session_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_boss from public.world_boss_state wbs where wbs.week_key = v_week;
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

  insert into public.world_boss_sessions (user_id, week_key)
  values (auth.uid(), v_week)
  returning id into v_session_id;

  return query select v_session_id, v_week, v_boss.current_hp, v_boss.max_hp, v_boss.atk, v_boss.def, 3 - v_new_count;
end;
$$ language plpgsql security definer;

create or replace function public.report_world_boss_damage(p_session_id uuid, p_damage bigint)
returns table(new_current_hp bigint, boss_max_hp bigint, cleared_now boolean) as $$
declare
  v_session public.world_boss_sessions;
  v_boss public.world_boss_state;
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

  select * into v_session from public.world_boss_sessions where id = p_session_id and user_id = auth.uid() for update;
  if v_session is null then
    raise exception '유효하지 않은 전투 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 결과가 반영된 전투입니다.';
  end if;
  update public.world_boss_sessions set claimed = true where id = p_session_id;

  select * into v_boss from public.world_boss_state wbs where wbs.week_key = v_session.week_key for update;
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

  update public.world_boss_state set current_hp = current_hp - v_applied where week_key = v_session.week_key;

  insert into public.world_boss_contributions (user_id, week_key, total_damage)
  values (auth.uid(), v_session.week_key, v_applied)
  on conflict (user_id, week_key)
    do update set total_damage = public.world_boss_contributions.total_damage + v_applied;

  if v_boss.current_hp - v_applied <= 0 then
    v_cleared := true;
    update public.world_boss_state set cleared = true, cleared_at = now() where week_key = v_session.week_key;

    update public.profiles set dragon_buff_until = now() + interval '7 days'
      where id in (
        select user_id from public.world_boss_contributions
        where week_key = v_session.week_key and total_damage > 0
      );

    for v_contrib in
      select * from public.world_boss_contributions
      where week_key = v_session.week_key and total_damage > 0
    loop
      v_reward := least(500000, greatest(300, round(v_contrib.total_damage / 100.0)));
      perform public.add_gold(v_contrib.user_id, v_reward);
      insert into public.mails (user_id, title, body, gold_amount, source_key)
      values (
        v_contrib.user_id,
        '월드보스 처치 보상',
        '함께 힘을 모아 월드보스를 쓰러뜨렸어요! 입힌 피해량에 비례한 골드와 함께, 7일간 공격력·방어력이 20배가 되는 용의 버프도 적용됐어요.',
        v_reward,
        'worldboss_clear_' || v_session.week_key
      )
      on conflict (user_id, source_key) do nothing;
    end loop;
  end if;

  return query select greatest(0, v_boss.current_hp - v_applied), v_boss.max_hp, v_cleared;
end;
$$ language plpgsql security definer;
