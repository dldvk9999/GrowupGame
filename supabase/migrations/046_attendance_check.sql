-- ============================================
-- 046: 출석체크(연속접속 보상) 시스템
-- 모바일 게임의 대표적인 재방문 유도 장치. 매일 1회 "출석" 버튼을 눌러 보상을 받고,
-- 7일 주기로 돌아가며 마지막 날(7일차)에 큰 보너스를 줌. 하루라도 거르면 스트릭이 끊기고
-- 다시 1일차부터 시작(단, 스트릭이 끊겨도 이미 받은 보상은 유지 - 처벌보다 재방문 유도가 목적).
-- ============================================

create table public.attendance_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  cycle_day integer not null default 0,       -- 0=아직 한번도 안 함, 1~7 사이 값이 "마지막으로 받은 날"
  last_claim_date date,                        -- 마지막 출석 날짜(서버 기준 UTC date, 중복 클레임 방지)
  total_claim_count integer not null default 0 -- 통산 출석 횟수(업적 등에 활용 가능)
);

alter table public.attendance_state enable row level security;
create policy "attendance_state는 본인만 조회" on public.attendance_state for select using (auth.uid() = user_id);
revoke insert, update, delete on public.attendance_state from authenticated;

-- 1~7일차 보상 (골드 고정 + 7일차만 보너스)
-- 1일: 500 / 2일: 800 / 3일: 1200 / 4일: 1800 / 5일: 2500 / 6일: 3500 / 7일: 8000(주간 보너스)
create or replace function public.claim_attendance()
returns table(cycle_day integer, reward_gold integer, streak_broken boolean, total_claim_count integer) as $$
declare
  v_state record;
  v_today date := current_date;
  v_next_day integer;
  v_reward integer;
  v_broken boolean := false;
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

  update public.attendance_state set
    cycle_day = v_next_day,
    last_claim_date = v_today,
    total_claim_count = total_claim_count + 1
  where user_id = auth.uid();

  return query select v_next_day, v_reward, v_broken, v_state.total_claim_count + 1;
end;
$$ language plpgsql security definer;
