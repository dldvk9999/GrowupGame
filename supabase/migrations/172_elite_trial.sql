-- ============================================
-- 172: 정예의 시련(Elite Trial) 던전 신설 - 신규 콘텐츠(사용자 요청)
-- 정예레벨(168) 1부터 입장 가능한 던전. 보상은 골드/새 재화 없이 "정예 경험치"만 -
-- 레벨 500(만렙) 상태에서는 applyExpGain이 얻는 경험치를 이미 자동으로 정예경험치로
-- 돌려주므로(168), 이 던전은 그 흐름을 재사용하는 고효율 파밍터 역할만 함(새 경제
-- 리스크 없음). 경험치는 다른 던전들과 동일하게 클라이언트 신뢰 모델로 지급되므로
-- (server는 save_monster_growth가 상한선만 재검증) 이 마이그레이션엔 "입장 가능
-- 여부(정예레벨 게이트)"와 "하루 3회 제한"만 서버가 강제하면 됨 - 별도 세션/클레임
-- RPC 불필요(봉인된 던전 등과 달리 골드 지급이 없어서 세션 검증 자체가 필요 없음).
-- ============================================

create table public.elite_trial_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_date date not null,
  count integer not null default 0,
  primary key (user_id, attempt_date)
);
alter table public.elite_trial_attempts enable row level security;
create policy "elite_trial_attempts는 본인만 조회" on public.elite_trial_attempts for select using (auth.uid() = user_id);
revoke insert, update, delete on public.elite_trial_attempts from authenticated;

/** 입장 - 정예레벨 1 이상만 가능(레벨 500 만렙 + 정예레벨업 최소 1회 필요), 하루 3회 제한 */
create or replace function public.enter_elite_trial()
returns table(attempts_remaining integer) as $$
declare
  v_monster public.owned_monsters;
  v_today date;
  v_new_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_monster from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;
  if coalesce(v_monster.elite_level, 0) < 1 then
    raise exception '정예레벨 1 이상부터 입장할 수 있어요. 먼저 만렙(500) 이후 정예레벨을 올려주세요.';
  end if;

  v_today := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;

  insert into public.elite_trial_attempts (user_id, attempt_date, count)
  values (auth.uid(), v_today, 1)
  on conflict (user_id, attempt_date)
    do update set count = public.elite_trial_attempts.count + 1
    where public.elite_trial_attempts.count < 3
  returning count into v_new_count;

  if v_new_count is null then
    raise exception '오늘의 정예 시련 입장 횟수(3회)를 모두 사용했어요.';
  end if;

  attempts_remaining := 3 - v_new_count;
  return next;
end;
$$ language plpgsql security definer;

/** 오늘 남은 입장 횟수 조회 */
create or replace function public.fetch_elite_trial_attempts_today()
returns integer as $$
declare
  v_today date;
  v_count integer;
begin
  if auth.uid() is null then
    return 0;
  end if;
  v_today := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;
  select count into v_count from public.elite_trial_attempts
    where user_id = auth.uid() and attempt_date = v_today;
  return greatest(0, 3 - coalesce(v_count, 0));
end;
$$ language plpgsql stable security definer;
