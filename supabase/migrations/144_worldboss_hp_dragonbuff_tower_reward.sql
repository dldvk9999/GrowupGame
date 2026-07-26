-- ============================================
-- 144: 월드보스 체력 100M 상향 + 용의버프 20배->2배 하향 + 무한의탑 보상 100분의1 하향 - 사용자 요청
-- ============================================

-- 1) 월드보스 체력 3000만 -> 1억 (공격력/방어력은 그대로 유지, 사용자가 체력만 요청)
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

  -- (수정) 체력 3000만 -> 1억 상향(사용자 요청), 공격력/방어력은 그대로
  insert into public.world_boss_state (week_key, max_hp, current_hp, atk, def)
  values (v_week, 100000000, 100000000, 7000, 1200);
end;
$$ language plpgsql security definer;

-- 2) 용의 버프 20배 -> 2배 하향(우편 안내문구도 동일하게 수정, 실제 배율 적용은 클라이언트
-- App.jsx equipmentBonus 계산부에서 처리 - 여긴 우편 문구만 동기화)
-- ⚠️ 최신 버전은 111(개인 최고 데미지 기록 컬럼 포함)이라 그걸 기준으로 재정의함 -
-- 처음에 110 기준으로 작성했다가 반환타입이 옛날로 되돌아가는 심각한 회귀를 스캐너가
-- 잡아내서 다시 111 기준으로 고쳤음(is_new_personal_best/personal_best 컬럼 보존 필수).
create or replace function public.report_world_boss_damage(p_session_id uuid, p_damage bigint)
returns table(new_current_hp bigint, boss_max_hp bigint, cleared_now boolean, is_new_personal_best boolean, personal_best bigint) as $$
declare
  v_session public.world_boss_sessions;
  v_boss public.world_boss_state;
  v_my_power integer;
  v_cap bigint;
  v_applied bigint;
  v_cleared boolean := false;
  v_contrib record;
  v_reward integer;
  v_prev_best bigint;
  v_is_new_best boolean := false;
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
  select p.world_boss_best_damage into v_prev_best from public.profiles p where p.id = auth.uid();
  if v_boss.cleared then
    return query select v_boss.current_hp, v_boss.max_hp, true, false, coalesce(v_prev_best, 0);
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

  if v_applied > coalesce(v_prev_best, 0) then
    v_is_new_best := true;
    update public.profiles set world_boss_best_damage = v_applied where id = auth.uid();
  end if;

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
      insert into public.mails (user_id, title, body, gold_amount, source_key)
      values (
        v_contrib.user_id,
        '월드보스 처치 보상',
        '함께 힘을 모아 월드보스를 쓰러뜨렸어요! 입힌 피해량에 비례한 골드와 함께, 7일간 공격력·방어력이 2배가 되는 용의 버프도 적용됐어요.',
        v_reward,
        'worldboss_clear_' || v_session.week_key
      )
      on conflict (user_id, source_key) do nothing;
    end loop;
  end if;

  return query select
    greatest(0, v_boss.current_hp - v_applied),
    v_boss.max_hp,
    v_cleared,
    v_is_new_best,
    greatest(v_applied, coalesce(v_prev_best, 0));
end;
$$ language plpgsql security definer;

-- 3) 무한의 탑 보상 100분의 1 하향(사용자 요청) - 매 층 골드 + 10층 마일스톤 보너스 둘 다
-- 같은 비율로 축소(마일스톤만 그대로 두면 상대적으로 지나치게 커짐)
create or replace function public.calc_tower_gold(p_floor integer)
returns integer as $$
declare
  v_hp numeric := 220 + power(p_floor, 1.8) * 200;
begin
  return least(10000, greatest(2, round(v_hp * 1.6 / 100)));
end;
$$ language plpgsql immutable;

create or replace function public.claim_tower_floor(p_session_id uuid)
returns table(gold integer, new_highest_floor integer, is_new_record boolean) as $$
declare
  v_session public.tower_sessions;
  v_prev_highest integer;
  v_gold integer;
  v_is_new_record boolean;
  v_milestone_bonus integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.tower_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null then
    raise exception '유효하지 않은 도전 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 보상을 받은 도전입니다.';
  end if;
  if now() - v_session.created_at < interval '2 seconds' then
    raise exception '너무 빠릅니다. 실제로 전투를 진행해주세요.';
  end if;

  update public.tower_sessions set claimed = true where id = p_session_id;

  select highest_floor into v_prev_highest from public.tower_progress where user_id = auth.uid();
  v_is_new_record := v_session.floor > v_prev_highest;

  v_gold := public.calc_tower_gold(v_session.floor);
  perform public.add_gold(auth.uid(), v_gold);

  if v_is_new_record then
    update public.tower_progress set highest_floor = v_session.floor where user_id = auth.uid();
  end if;

  if v_is_new_record and v_session.floor % 10 = 0 then
    v_milestone_bonus := least(10000, v_session.floor * 8); -- (수정) 100만/800 -> 1만/8로 100분의1
    insert into public.mails (user_id, title, body, gold_amount, item_key, source_key)
    values (
      auth.uid(),
      '🗼 무한의 탑 ' || v_session.floor || '층 돌파!',
      '대단해요! 탑의 ' || v_session.floor || '층까지 올라왔어요. 축하 보너스를 받아가세요.',
      v_milestone_bonus,
      null,
      'tower_milestone_' || v_session.floor
    )
    on conflict (user_id, source_key) do nothing;
  end if;

  return query select v_gold, greatest(v_prev_highest, v_session.floor), v_is_new_record;
end;
$$ language plpgsql security definer;
