-- ============================================
-- 103: 오프라인(방치) 골드 보상 - 신규 콘텐츠
-- "키우기 게임" 장르의 핵심 기대치인 "자리를 비운 사이에도 자란다"를 실제로 구현.
-- 기존엔 앱을 켜둔 상태에서만 자동사냥 골드(grant_idle_reward, calc_idle_gold)가 나갔는데,
-- 이 마이그레이션은 로그아웃/미접속 구간에 대해서도 소량의 골드를 즉시 지급함.
--
-- 102(profiles.last_login_at)를 그대로 재사용하되, 이 함수는 last_login_at을
-- 갱신하지 않음(102의 record_login_and_grant_comeback_reward가 그 역할을 맡음).
-- 클라이언트가 로그인 시 이 함수를 "먼저" 호출한 뒤 102 함수를 호출해야
-- 두 보상 모두 같은 기준시각(직전 로그인 시각)을 정확히 볼 수 있음.
--
-- 온라인(자동사냥)보다 효율을 낮게(50%) 설계해 "그래도 직접 하는 게 더 낫다"는
-- 균형을 유지하고, 최대 2시간 분량으로 상한을 둬서 장기 방치 어뷰징을 방지함.
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

  select p.last_login_at into v_prev from public.profiles p where p.id = auth.uid();
  if v_prev is null then
    return query select 0, 0;
    return;
  end if;

  v_elapsed := greatest(0, floor(extract(epoch from (now() - v_prev)))::integer);

  -- 5분 미만이면 지급 안 함(짧은 재접속에 매번 팝업 뜨는 걸 방지)
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

  v_capped_elapsed := least(v_elapsed, 7200); -- 최대 2시간 분량까지만 인정
  v_ticks := floor(v_capped_elapsed / 2.5);
  v_gold := round(public.calc_idle_gold(v_chapter, v_level) * v_ticks * 0.5); -- 온라인 대비 50% 효율

  if v_gold > 0 then
    perform public.add_gold(auth.uid(), v_gold);
  end if;

  return query select v_gold, v_elapsed;
end;
$$ language plpgsql security definer;
