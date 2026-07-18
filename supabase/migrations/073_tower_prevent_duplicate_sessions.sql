-- ============================================
-- 073: 무한의 탑 - 중복 세션 생성 방지 (072 후속 보안 수정)
--
-- 072에서 하루 입장 제한을 없애면서, 클레임하기 전에 enter_tower()를 빠르게
-- 여러 번 호출하면 같은 층수의 미클레임 세션이 여러 개 생길 수 있게 됨 - 각각
-- 2초 후 클레임하면 같은 층수에 대해 골드를 반복해서 받을 수 있는 파밍 경로가
-- 생김(이전엔 하루3회 제한이 이 파밍의 피해 규모도 암묵적으로 제한하고 있었으나,
-- 무제한 전환으로 무한 반복 가능해짐). enter_tower를 멱등(idempotent)하게 만들어서
-- "이미 미클레임 세션이 있으면 새로 안 만들고 기존 세션을 그대로 반환"하도록 수정
-- - 유저당 항상 최대 1개의 미클레임 세션만 존재하게 되어 파밍 원천 차단.
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
  select id, floor into v_existing from public.tower_sessions
    where user_id = auth.uid() and claimed = false
    order by created_at desc
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
