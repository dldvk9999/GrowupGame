-- ============================================
-- 034: enter_world_boss의 "column reference week_key is ambiguous" 버그 수정
-- RETURNS TABLE의 출력 컬럼명 week_key가 함수 본문에서 암묵적 변수로도 잡혀서,
-- WHERE week_key = v_week처럼 별칭 없이 쓴 부분이 모호해졌던 문제(이전 slot 버그와 동일 패턴).
-- Supabase SQL Editor에 순서대로 실행 (001~033 먼저 적용되어 있어야 함)
-- ============================================

create or replace function public.enter_world_boss()
returns table(
  session_id uuid, week_key text, boss_current_hp bigint, boss_max_hp bigint,
  boss_atk integer, boss_def integer, remaining_attempts integer
) as $$
declare
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
  v_today date := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;
  v_new_count integer;
  v_boss public.world_boss_state;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_boss from public.world_boss_state wbs where wbs.week_key = v_week;
  if v_boss is null then
    raise exception '월드보스가 아직 생성되지 않았습니다.';
  end if;
  if v_boss.cleared then
    raise exception '이번 주 월드보스는 이미 처치되었습니다.';
  end if;

  insert into public.world_boss_attempts (user_id, attempt_date, count)
  values (auth.uid(), v_today, 1)
  on conflict (user_id, attempt_date)
    do update set count = public.world_boss_attempts.count + 1
    where public.world_boss_attempts.count < 3
  returning count into v_new_count;

  if v_new_count is null then
    raise exception '오늘 월드보스 도전 횟수를 모두 사용했습니다.';
  end if;

  return query select gen_random_uuid(), v_week, v_boss.current_hp, v_boss.max_hp, v_boss.atk, v_boss.def, 3 - v_new_count;
end;
$$ language plpgsql security definer;
