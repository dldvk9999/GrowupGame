-- ============================================
-- 175: [긴급] report_guild_raid_damage의 grant_guild_exp 호출 타입 불일치 버그 수정
-- (사용자 제보 - "function public.grant_guild_exp(uuid, numeric) does not exist")
--
-- floor(v_applied / 50.0)에서 50.0이 numeric 리터럴이라 나눗셈 결과가 numeric이 되고,
-- floor(numeric)도 numeric을 반환함 - grant_guild_exp(uuid, bigint)와 타입이 안 맞아서
-- 매 전투 종료마다 예외가 발생하고 있었음(169에서 처음 추가할 때부터 있던 버그,
-- 실제 반응이 있고 나서야 발견됨). ::bigint로 명시 캐스팅해서 수정.
-- 반환타입 그대로, DROP FUNCTION 불필요.
-- ============================================

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

  -- (수정) floor(...)가 numeric을 반환해서 grant_guild_exp(uuid, bigint)와 타입이 안 맞았음 - ::bigint 명시
  perform public.grant_guild_exp(v_session.guild_id, floor(v_applied / 50.0)::bigint);

  if v_boss.current_hp - v_applied <= 0 then
    v_cleared := true;
    update public.guild_raid_state set cleared = true, cleared_at = now()
      where guild_id = v_session.guild_id and week_key = v_session.week_key;

    select level into v_guild_level from public.guilds where id = v_session.guild_id;

    for v_contrib in
      select * from public.guild_raid_contributions
      where guild_id = v_session.guild_id and week_key = v_session.week_key and total_damage > 0
    loop
      v_reward := greatest(300, round(v_contrib.total_damage / 100.0));
      v_reward := round(v_reward * (1 + least(20, coalesce(v_guild_level, 1)) * 0.01)); -- 길드 레벨 보너스
      v_reward := least(200000, v_reward); -- 최종 클램프(반드시 마지막)
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
