-- ============================================
-- 035: 월드보스 클리어 보상도 우편으로 지급 + 공격력 상향
-- Supabase SQL Editor에 순서대로 실행 (001~034 먼저 적용되어 있어야 함)
-- ============================================

-- ============================================
-- 1. 클리어 시에도 기여자 전원에게 골드 보상을 우편으로 지급 (용의 버프는 기존처럼 즉시 적용)
-- ============================================
create or replace function public.report_world_boss_damage(p_week_key text, p_damage bigint)
returns table(new_current_hp bigint, boss_max_hp bigint, cleared_now boolean) as $$
declare
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

  select * into v_boss from public.world_boss_state wbs where wbs.week_key = p_week_key for update;
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

    for v_contrib in
      select * from public.world_boss_contributions
      where week_key = p_week_key and total_damage > 0
    loop
      v_reward := least(500000, greatest(300, round(v_contrib.total_damage / 100.0)));
      perform public.add_gold(v_contrib.user_id, v_reward);
      insert into public.mails (user_id, title, body, gold_amount, source_key)
      values (
        v_contrib.user_id,
        '월드보스 처치 보상',
        '함께 힘을 모아 월드보스를 쓰러뜨렸어요! 입힌 피해량에 비례한 골드와 함께, 7일간 공격력·방어력이 20배가 되는 용의 버프도 적용됐어요.',
        v_reward,
        'worldboss_clear_' || p_week_key
      )
      on conflict (user_id, source_key) do nothing;
    end loop;
  end if;

  return query select greatest(0, v_boss.current_hp - v_applied), v_boss.max_hp, v_cleared;
end;
$$ language plpgsql security definer;

-- ============================================
-- 2. 다음 주부터 생성되는 월드보스 공격력 상향 (4500 → 7000)
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
  values (v_week, 30000000, 30000000, 7000, 1200);
end;
$$ language plpgsql security definer;

-- ============================================
-- 3. 지금 진행 중인 주(이미 생성돼 있고 아직 안 끝남)에도 공격력 상향을 바로 반영
-- ============================================
update public.world_boss_state
set atk = 7000
where week_key = to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD')
  and cleared = false;
