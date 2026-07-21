-- ============================================
-- 137: 오프라인 보상 최대 인정 시간 2시간 -> 10시간 상향 - 사용자 요청
--
-- ⚠️ [예방적 발견/수정] claim_offline_gold_reward는 v_gold를 add_gold에 넘기기 전
-- 최종 클램프가 아예 없었음(103/106 어디에도 없음). 계산해보니 기존 2시간 설정
-- 그대로도 챕터30·레벨55 정도의 중견 유저면 이미 v_gold가 100만을 넘어서
-- add_gold가 크래시할 수 있는 상태였음(이번 상향과 무관하게 원래도 잠재됐던 버그,
-- 시뮬레이션 중 발견). 10시간으로 늘리면 훨씬 더 낮은 레벨에서도 크래시가 날 것이므로
-- 반드시 같이 고쳐야 함(117/118/121/133과 같은 클래스의 함정).
--
-- 반환타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.claim_offline_gold_reward()
returns table(gold integer, offline_seconds integer) as $$
declare
  v_prev timestamptz;
  v_level integer;
  v_chapter integer;
  v_elapsed integer;
  v_capped_elapsed integer;
  v_ticks integer;
  v_gold integer := 0;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- for update로 잠가서, 짧은 간격의 동시 중복 요청(레이스컨디션)도 함께 차단
  select p.last_offline_claim_at into v_prev from public.profiles p where p.id = auth.uid() for update;
  if v_prev is null then
    v_prev := now();
  end if;

  v_elapsed := greatest(0, floor(extract(epoch from (now() - v_prev)))::integer);

  -- 이 UPDATE가 곧 "반복 호출 파밍 방지" 핵심 - 지급 여부와 무관하게 항상 체크포인트를 갱신함
  update public.profiles set last_offline_claim_at = now() where id = auth.uid();

  -- 5분 미만이면 지급 안 함(짧은 재접속/반복 호출에 매번 지급되는 것 방지)
  if v_elapsed < 300 then
    return query select 0, v_elapsed;
    return;
  end if;

  select level into v_level from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_level is null then
    -- 아직 스타터 계약 전이면 지급할 게 없음
    return query select 0, v_elapsed;
    return;
  end if;

  select coalesce(max(ceil(stage_id / 10.0)), 1) into v_chapter
    from public.stage_progress
    where user_id = auth.uid() and cleared = true;

  v_capped_elapsed := least(v_elapsed, 36000); -- (수정) 최대 2시간 -> 10시간 분량까지 인정
  v_ticks := floor(v_capped_elapsed / 2.5);
  v_gold := round(public.calc_idle_gold(v_chapter, v_level) * v_ticks * 0.5); -- 온라인 대비 50% 효율
  -- (수정) add_gold 100만 상한 대비 최종 클램프 - 기존엔 이게 아예 없었음(예방적 발견)
  v_gold := least(v_gold, 1000000);

  if v_gold > 0 then
    perform public.add_gold(auth.uid(), v_gold);
  end if;

  return query select v_gold, v_elapsed;
end;
$$ language plpgsql security definer;
