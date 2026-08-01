-- ============================================
-- 169: 길드 레벨/경험치 시스템 신설 - 신규 콘텐츠(todo.md 후속과제 이행)
-- guild.md의 "알려진 한계"와 guild-raid.md의 todo.md 후속과제에 이미 남겨뒀던
-- "길드 레벨/경험치, 길드 버프 없음"을 해소함.
--
-- 경험치 획득원: 길드 레이드 보스에게 입힌 데미지(이미 추적 중인 값을 그대로 재사용,
-- 새로운 활동 추적 인프라 불필요) - 데미지 50당 길드 경험치 1. 최대 레벨 20.
-- 버프: 길드 레벨 1당 길드 레이드 골드 보상 +1%(최대 +20%) - 버프 범위를 길드 레이드
-- 보상에만 한정해서(게임 전체 경제가 아니라) 파급 범위를 좁게 유지함.
-- ============================================

alter table public.guilds add column if not exists level integer not null default 1;
alter table public.guilds add column if not exists exp bigint not null default 0;
alter table public.guilds add constraint guilds_level_check check (level >= 1 and level <= 20);

/** 길드 레벨 n에서 다음 레벨까지 필요한 경험치 - 클라이언트 calcGuildExpToNext와 동일 공식 유지할 것 */
create or replace function public.calc_guild_exp_to_next(p_level integer)
returns bigint as $$
  select round(5000 * power(greatest(1, p_level), 1.5))::bigint;
$$ language sql immutable;

-- 내부 전용 헬퍼(다른 security definer 함수에서만 호출) - 직접 RPC로 노출되면 안 되므로
-- authenticated로부터 실행권한을 회수함(009의 add_gold 패턴과 동일).
create or replace function public.grant_guild_exp(p_guild_id uuid, p_amount bigint)
returns void as $$
declare
  v_guild public.guilds;
begin
  if p_amount is null or p_amount <= 0 then
    return;
  end if;
  select * into v_guild from public.guilds where id = p_guild_id for update;
  if v_guild is null then
    return;
  end if;
  if v_guild.level >= 20 then
    return; -- 만렙이면 경험치 축적 자체를 멈춤(불필요한 누적 방지)
  end if;

  v_guild.exp := v_guild.exp + p_amount;
  while v_guild.level < 20 and v_guild.exp >= public.calc_guild_exp_to_next(v_guild.level) loop
    v_guild.exp := v_guild.exp - public.calc_guild_exp_to_next(v_guild.level);
    v_guild.level := v_guild.level + 1;
  end loop;
  if v_guild.level >= 20 then
    v_guild.exp := 0;
  end if;

  update public.guilds set level = v_guild.level, exp = v_guild.exp where id = p_guild_id;
end;
$$ language plpgsql security definer;
revoke execute on function public.grant_guild_exp(uuid, bigint) from public, anon, authenticated;

-- fetch_my_guild(154) 재정의 - level/exp/exp_to_next 노출. 반환 컬럼이 늘어나므로 DROP 필요.
drop function if exists public.fetch_my_guild();
create or replace function public.fetch_my_guild()
returns table(
  guild_id uuid, name text, tag text, announcement text, leader_id uuid, member_count integer,
  is_leader boolean, level integer, exp bigint, exp_to_next bigint
) as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  return query
    select g.id, g.name, g.tag, g.announcement, g.leader_id,
      (select count(*)::integer from public.guild_members where guild_id = g.id),
      (g.leader_id = auth.uid()),
      g.level, g.exp,
      case when g.level >= 20 then 0::bigint else public.calc_guild_exp_to_next(g.level) end
    from public.guild_members gm
    join public.guilds g on g.id = gm.guild_id
    where gm.user_id = auth.uid();
end;
$$ language plpgsql stable security definer;

-- report_guild_raid_damage(158) 재정의 - 데미지 반영 시 길드 경험치도 함께 지급하고,
-- 클리어 보상에 길드 레벨 보너스(레벨당 +1%, 최대 +20%)를 곱함. 반환타입 그대로라 DROP 불필요.
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
  v_guild_level integer;
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

  -- (신규) 입힌 데미지 50당 길드 경험치 1
  perform public.grant_guild_exp(v_session.guild_id, floor(v_applied / 50.0));

  if v_boss.current_hp - v_applied <= 0 then
    v_cleared := true;
    update public.guild_raid_state set cleared = true, cleared_at = now()
      where guild_id = v_session.guild_id and week_key = v_session.week_key;

    select level into v_guild_level from public.guilds where id = v_session.guild_id;

    for v_contrib in
      select * from public.guild_raid_contributions
      where guild_id = v_session.guild_id and week_key = v_session.week_key and total_damage > 0
    loop
      v_reward := least(200000, greatest(300, round(v_contrib.total_damage / 100.0)));
      v_reward := round(v_reward * (1 + least(20, coalesce(v_guild_level, 1)) * 0.01)); -- (신규) 길드 레벨 보너스
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

-- sync_guild_raid(165) 재정의 - 미클리어 주간보상에도 동일한 길드 레벨 보너스 적용.
-- 반환타입 없음(void), DROP 불필요.
create or replace function public.sync_guild_raid(p_guild_id uuid)
returns void as $$
declare
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
  v_prev_state public.guild_raid_state;
  v_contrib record;
  v_reward integer;
  v_guild_level integer;
begin
  if exists (select 1 from public.guild_raid_state where guild_id = p_guild_id and week_key = v_week) then
    return;
  end if;

  select * into v_prev_state from public.guild_raid_state
    where guild_id = p_guild_id order by week_key desc limit 1;
  if v_prev_state is not null and not v_prev_state.cleared then
    select level into v_guild_level from public.guilds where id = p_guild_id;
    for v_contrib in
      select * from public.guild_raid_contributions
      where guild_id = p_guild_id and week_key = v_prev_state.week_key and total_damage > 0
    loop
      v_reward := least(80000, greatest(100, round(v_contrib.total_damage / 150.0)));
      v_reward := round(v_reward * (1 + least(20, coalesce(v_guild_level, 1)) * 0.01)); -- (신규) 길드 레벨 보너스
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
  values (p_guild_id, v_week, 50000000, 50000000, 3500, 10000);
end;
$$ language plpgsql security definer;
