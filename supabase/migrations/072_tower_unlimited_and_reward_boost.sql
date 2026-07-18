-- ============================================
-- 072: 무한의 탑 - 입장 제한 제거 + 클리어 보상 상향
--
-- 1. enter_tower: 하루 3회 제한 로직을 완전히 제거(원하는 만큼 계속 도전 가능).
--    tower_attempts 테이블/카운터 증가 로직 자체를 안 타도록 재작성.
--    반환 컬럼 구성은 그대로 유지(remaining_attempts는 이제 항상 큰 값을 반환해서
--    "무제한"을 나타냄 - DROP FUNCTION 없이 안전하게 배포하기 위한 선택).
-- 2. calc_tower_gold: 배율을 1.1 -> 1.6으로 상향(약 45% 증가), 100만 상한은 그대로 유지.
-- ============================================

create or replace function public.calc_tower_gold(p_floor integer)
returns integer as $$
declare
  v_hp numeric := 220 + power(p_floor, 1.8) * 200;
begin
  return least(1000000, greatest(150, round(v_hp * 1.6)));
end;
$$ language plpgsql immutable;

create or replace function public.enter_tower()
returns table(session_id uuid, floor integer, remaining_attempts integer) as $$
declare
  v_highest integer;
  v_next_floor integer;
  v_session_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
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
