-- ============================================
-- 056: claim_attendance의 "column reference total_claim_count is ambiguous" 버그 수정
--
-- 원인: 함수가 RETURNS TABLE(..., total_claim_count integer)로 선언돼있어서
-- PL/pgSQL이 total_claim_count라는 이름의 OUT 파라미터(변수)를 암묵적으로 만드는데,
-- UPDATE 문 안에서 "total_claim_count = total_claim_count + 1"을 쓰면 우변의
-- total_claim_count가 그 변수를 가리키는지 attendance_state.total_claim_count 컬럼을
-- 가리키는지 PostgreSQL이 판단하지 못해 에러가 남 (harness/security.md에 있는
-- "column reference X is ambiguous" 버그 패턴과 동일 원인).
--
-- 수정: UPDATE에 테이블 별칭을 붙이고 RETURNING으로 갱신된 값을 바로 받아써서
-- 애초에 이름 충돌 자체가 안 생기게 함.
-- ============================================

create or replace function public.claim_attendance()
returns table(cycle_day integer, reward_gold integer, streak_broken boolean, total_claim_count integer) as $$
declare
  v_state record;
  v_today date := current_date;
  v_next_day integer;
  v_reward integer;
  v_broken boolean := false;
  v_updated public.attendance_state;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  insert into public.attendance_state (user_id, cycle_day, last_claim_date, total_claim_count)
  values (auth.uid(), 0, null, 0)
  on conflict (user_id) do nothing;

  select * into v_state from public.attendance_state where user_id = auth.uid() for update;

  if v_state.last_claim_date = v_today then
    raise exception '오늘은 이미 출석체크를 했어요.';
  end if;

  -- 어제 이미 받았으면 스트릭 이어감, 아니면(하루 이상 건너뛰었으면) 1일차로 리셋
  if v_state.last_claim_date = v_today - 1 then
    v_next_day := v_state.cycle_day + 1;
    if v_next_day > 7 then v_next_day := 1; end if;
  else
    if v_state.last_claim_date is not null then v_broken := true; end if;
    v_next_day := 1;
  end if;

  v_reward := case v_next_day
    when 1 then 500 when 2 then 800 when 3 then 1200 when 4 then 1800
    when 5 then 2500 when 6 then 3500 else 8000
  end;

  perform public.add_gold(auth.uid(), v_reward);

  update public.attendance_state as att set
    cycle_day = v_next_day,
    last_claim_date = v_today,
    total_claim_count = att.total_claim_count + 1
  where att.user_id = auth.uid()
  returning * into v_updated;

  return query select v_next_day, v_reward, v_broken, v_updated.total_claim_count;
end;
$$ language plpgsql security definer;
