-- ============================================
-- 111: 월드보스 개인 최고 데미지(한 판 기준) 기록 - 신규 콘텐츠
-- 무한의 탑처럼 "내 최고 기록"을 갱신하는 재미를 월드보스에도 적용.
-- 누적 기여 피해량(world_boss_contributions, 매주 리셋)과는 별개로
-- "한 판에서 낸 최고 피해"를 영구 기록으로 추적.
--
-- 110에서 크래시/이중지급을 수정한 최신 버전을 기준으로 재정의.
-- 반환 컬럼에 is_new_personal_best/personal_best가 추가되므로 DROP FUNCTION 필요.
-- ============================================

alter table public.profiles
  add column if not exists world_boss_best_damage bigint not null default 0;

drop function if exists public.report_world_boss_damage(uuid, bigint);

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

  -- 개인 최고 데미지(한 판 기준) 갱신 체크 - 누적치가 아니라 이번 한 판의 v_applied 기준
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
        '함께 힘을 모아 월드보스를 쓰러뜨렸어요! 입힌 피해량에 비례한 골드와 함께, 7일간 공격력·방어력이 20배가 되는 용의 버프도 적용됐어요.',
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
