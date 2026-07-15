-- ============================================
-- 016: 던전 입장권 소진 오류 메시지 문구 통일
-- Supabase SQL Editor에 순서대로 실행 (001~015 먼저 적용되어 있어야 함)
-- ============================================

create or replace function public.use_dungeon_attempt(p_dungeon_type text)
returns table(session_id uuid, remaining integer, stage integer) as $$
declare
  v_today date;
  v_new_count integer;
  v_session_id uuid;
  v_stage integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_dungeon_type not in ('exp', 'gold') then
    raise exception '유효하지 않은 던전입니다.';
  end if;

  select coalesce(cleared_stage, 0) + 1 into v_stage from public.dungeon_progress
    where user_id = auth.uid() and dungeon_type = p_dungeon_type;
  if v_stage is null then
    v_stage := 1;
  end if;
  if v_stage > 10 then
    v_stage := 10;
  end if;

  v_today := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;

  insert into public.dungeon_attempts (user_id, dungeon_type, attempt_date, count)
  values (auth.uid(), p_dungeon_type, v_today, 1)
  on conflict (user_id, dungeon_type, attempt_date)
    do update set count = public.dungeon_attempts.count + 1
    where public.dungeon_attempts.count < 3
  returning count into v_new_count;

  if v_new_count is null then
    raise exception '오늘 하루 입장권을 모두 소진하셨습니다.';
  end if;

  insert into public.dungeon_sessions (user_id, dungeon_type, stage)
  values (auth.uid(), p_dungeon_type, v_stage)
  returning id into v_session_id;

  return query select v_session_id, 3 - v_new_count, v_stage;
end;
$$ language plpgsql security definer;
