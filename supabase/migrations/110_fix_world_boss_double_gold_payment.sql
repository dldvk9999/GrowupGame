-- ============================================
-- 110: [긴급/치명적] 월드보스 기여자 보상 지급 로직 버그 2건 수정
-- (110 작업을 위해 report_world_boss_damage 원문을 재확인하던 중 자체 발견)
--
-- 발견 경위: 월드보스 개인 최고기록 기능을 추가하려고 report_world_boss_damage
-- 원문을 다시 읽던 중, 클리어/미클리어 보상 루프가 기여자마다
-- `perform public.add_gold(v_contrib.user_id, v_reward)`를 직접 호출하는 걸 발견.
--
-- 버그 1 [치명적] 크래시: `add_gold(target_user, amount)`(003/030)는
-- `auth.uid() <> target_user`면 즉시 `raise exception 'not authorized'`로 막음
-- (유저가 자기 자신 골드만 직접 조작 못 하게 하는 보안장치, 009). 그런데 이 루프는
-- "보스를 방금 처치한 사람"(auth.uid()) 기준으로 실행되면서 **다른 기여자들**의
-- user_id로 add_gold를 호출하므로, 기여자가 2명 이상이면 첫 타인 기여자에서 바로
-- 예외가 터져 **트랜잭션 전체가 롤백**됨. 즉 클리어 처리(현재체력 반영/cleared 플래그/
-- 용의버프/보상우편) 전부가 무효화되고 호출자는 에러만 받음 — 월드보스는 설계상
-- "여러 유저가 같이 깎는" 콘텐츠라 기여자 2명 이상은 사실상 항상 발생하는 상황이므로,
-- 실사용 중 아무도 아직 진짜로 "클리어"를 성공적으로 끝내보지 못했을 가능성이 높음.
-- sync_world_boss()의 미클리어 주간보상 루프도 동일 패턴이라 새 주 보스 생성 자체가
-- (루프 이후에 insert가 있어서) 막힐 수 있었음.
--
-- 버그 2 [경미] 이중지급: 설령 기여자가 1명뿐이라 크래시를 피하더라도(auth.uid()=
-- target_user만 존재), add_gold로 즉시 지급 + 같은 금액을 gold_amount로 담은 우편도
-- 같이 보내서, 우편을 나중에 claim_mail로 열어보면 똑같은 보상을 한 번 더 받음(037).
--
-- 수정: 두 함수 모두에서 add_gold 직접 호출을 제거하고 우편 발송(클레임 시 1회 지급)
-- 만 남김 - 다른 보상 경로(던전완주보너스/탑마일스톤/친구추천 등)와 동일한 "우편 단일
-- 경로"로 통일. 반환 타입은 둘 다 그대로라 DROP FUNCTION 불필요.
-- ============================================

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
      -- (수정) 아래 perform add_gold 직접호출 제거 - 우편(claim_mail)이 지급을 전담
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
      -- (수정) 아래 perform add_gold 직접호출 제거 - 우편(claim_mail)이 지급을 전담
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
