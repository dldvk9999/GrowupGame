-- ============================================
-- 148: 오프라인보상 골드 최대치 400만 상향 + 분당 골드율 1/3로 하향 - 사용자 요청
-- "최대치는 늘리되 분당 지급 속도는 낮춰서, 아주 오래 방치했을 때만 큰 금액을 채울 수
-- 있게" 하는 의도로 해석 - 137에서 100만이던 상한을 400만으로 올리고, 그만큼 분당
-- 골드율을 기존의 1/3로 낮춰서 실제로 400만을 채우려면 훨씬 오래(약 10시간 최대인정
-- 시간을 거의 다 채워야) 걸리게 균형을 맞춤.
-- 반환타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

-- ⚠️ [배포 전 발견/수정] add_gold(012/030/114) 자체에 "amount > 1000000이면 예외" 하드
-- 캡이 걸려있어서, claim_offline_gold_reward 하나만 400만으로 올려봤자 실제로 100만을
-- 넘는 순간 add_gold가 무조건 크래시했을 것(전체 트랜잭션 롤백, 보상 전액 미지급).
-- add_gold 자체의 상한도 400만으로 함께 올림 - 이 값은 여러 보상 경로가 공유하는
-- "한 번의 add_gold 호출이 절대 넘으면 안 되는 절대 상한"이라, 여기를 안 올리면
-- claim_offline_gold_reward만 따로 상한을 올려도 아무 의미가 없었음.
create or replace function public.add_gold(target_user uuid, amount integer)
returns void as $$
begin
  if auth.uid() <> target_user then
    raise exception 'not authorized';
  end if;
  if amount < 0 or amount > 4000000 then
    raise exception 'invalid amount';
  end if;
  update public.profiles set gold = gold + amount, lifetime_gold_earned = lifetime_gold_earned + amount where id = target_user;
end;
$$ language plpgsql security definer;

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

  v_capped_elapsed := least(v_elapsed, 36000); -- 최대 10시간 분량까지만 인정(137)
  v_ticks := floor(v_capped_elapsed / 2.5);
  -- (수정) 분당 골드율을 기존의 1/3로 하향(온라인 대비 50% 효율 * 1/3 = 실질 약 16.7% 효율)
  v_gold := round(public.calc_idle_gold(v_chapter, v_level) * v_ticks * 0.5 * (1.0 / 3));
  -- (수정) 100만 -> 400만으로 상한 상향 - 분당율이 1/3로 줄어든 만큼, 400만을 실제로
  -- 채우려면 최대인정시간(10시간)을 거의 다 써야 함(낮은 레벨 기준으로는 못 채울 수도 있음)
  v_gold := least(v_gold, 4000000);

  if v_gold > 0 then
    perform public.add_gold(auth.uid(), v_gold);
  end if;

  return query select v_gold, v_elapsed;
end;
$$ language plpgsql security definer;
