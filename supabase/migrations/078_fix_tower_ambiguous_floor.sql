-- ============================================
-- 078: 무한의 탑 "column reference floor is ambiguous" 긴급 버그 수정
--
-- 073에서 enter_tower()에 추가한 중복세션 체크 로직이 정확히 harness에 이미
-- "재발 패턴"으로 기록해뒀던 것과 동일한 버그를 다시 냈음: RETURNS TABLE의 OUT
-- 파라미터 이름(floor)과 tower_sessions.floor 컬럼명이 겹치는데, 073의
-- "select id, floor into v_existing from public.tower_sessions" 에서 테이블
-- 별칭 없이 컬럼명을 썼더니 PostgreSQL이 "OUT 파라미터 floor"와
-- "tower_sessions.floor 컬럼" 중 뭘 가리키는지 모호해서 에러를 냄.
-- (기존 자체 스캐너는 UPDATE SET col=col 패턴만 검사했고 SELECT INTO는
-- 검사 대상이 아니어서 이번엔 놓쳤음 - 스캐너 커버리지 개선이 필요함을 확인)
--
-- 수정: tower_sessions에 별칭(ts)을 붙여서 명시적으로 구분.
-- 반환 컬럼 구성은 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.enter_tower()
returns table(session_id uuid, floor integer, remaining_attempts integer) as $$
declare
  v_highest integer;
  v_next_floor integer;
  v_session_id uuid;
  v_existing record;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- 이미 미클레임 세션이 있으면 새로 만들지 않고 그대로 반환 (중복 세션 생성 방지)
  select ts.id, ts.floor into v_existing from public.tower_sessions ts
    where ts.user_id = auth.uid() and ts.claimed = false
    order by ts.created_at desc
    limit 1;

  if v_existing.id is not null then
    return query select v_existing.id, v_existing.floor, 999999;
    return;
  end if;

  insert into public.tower_progress (user_id, highest_floor)
  values (auth.uid(), 0)
  on conflict (user_id) do nothing;

  select highest_floor into v_highest from public.tower_progress where user_id = auth.uid();
  v_next_floor := v_highest + 1;

  insert into public.tower_sessions (user_id, floor)
  values (auth.uid(), v_next_floor)
  returning id into v_session_id;

  return query select v_session_id, v_next_floor, 999999;
end;
$$ language plpgsql security definer;
