-- ============================================
-- 155: 연승의 던전(Streak Dungeon) 신설 - 신규 콘텐츠
-- 최신 방치형/캐주얼 RPG 시장에서 흔한 "위험-보상(risk & reward) 뱅킹" 구조를 이 게임에
-- 맞게 적용. 루비 던전(142)처럼 "매번 새 세션으로 보스 1마리와 싸우는" 단발성 구조를
-- 베이스로 하되, 이기면 그 자리에서 "지금 수령"(연승 종료, 보상 확정) 또는 "이어서 도전"
-- (다음 연승, 더 강한 보스 + 훨씬 큰 보상, 단 지면 이번 판 보상 전액 소멸) 중 선택하는
-- 구조가 핵심 — 도박적 긴장감(손실회피 편향)을 이용한 리텐션 장치.
--
-- 기존 던전들과의 차이:
--   - 경험치/골드 던전: 순차 진행형, 실패해도 그 자리에 머무름(손실 없음)
--   - 전직 던전: 순차 단계, 실패해도 손실 없음
--   - 루비 던전: 단발성이지만 승리 시 보상 즉시 확정(위험 없음)
--   - 연승 던전(신규): 단발성 + 승리해도 "계속 걸지 말지" 스스로 선택해야 하는 유일한 던전
-- ============================================

-- 하루 입장(=새 연승 시작) 횟수 제한. 기존 던전들과 동일 패턴(Asia/Seoul 08:00 리셋).
-- "이어서 도전"은 이미 시작한 연승을 계속하는 것이라 추가 입장권을 소모하지 않음 -
-- 입장권은 오직 "처음부터 새로 시작"할 때만 소모됨(패배/포기 후 재시작 포함).
create table public.streak_dungeon_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_date date not null,
  count integer not null default 0,
  primary key (user_id, attempt_date)
);
alter table public.streak_dungeon_attempts enable row level security;
create policy "streak_dungeon_attempts는 본인만 조회" on public.streak_dungeon_attempts for select using (auth.uid() = user_id);
revoke insert, update, delete on public.streak_dungeon_attempts from authenticated;

-- 진행 중인 연승 세션. 유저당 active 상태는 최대 1개만 허용(부분 유니크 인덱스로 강제) -
-- "이어서 도전"과 "지금 수령"이 항상 유일한 하나의 세션을 대상으로 하도록 보장.
create table public.streak_dungeon_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  owned_monster_id uuid not null references public.owned_monsters(id) on delete cascade,
  streak integer not null default 1,
  status text not null default 'active' check (status in ('active', 'banked', 'forfeited')),
  created_at timestamptz not null default now(),
  last_action_at timestamptz not null default now()
);
create index streak_dungeon_sessions_user_idx on public.streak_dungeon_sessions(user_id);
create unique index streak_dungeon_sessions_one_active_idx on public.streak_dungeon_sessions(user_id) where status = 'active';
alter table public.streak_dungeon_sessions enable row level security;
create policy "streak_dungeon_sessions는 본인만 조회" on public.streak_dungeon_sessions for select using (auth.uid() = user_id);
revoke insert, update, delete on public.streak_dungeon_sessions from authenticated;

-- 역대 최고 연승 기록(무한의 탑 tower_progress와 동일 설계) - 랭킹/업적에 사용.
-- "수령"하지 않고 포기해도, 이미 이겨서 도달한 연승 수는 기록으로 남음(뱅킹 여부와
-- 무관하게 "얼마나 버텼는지"가 랭킹의 본질이라는 판단).
create table public.streak_dungeon_best (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  best_streak integer not null default 0,
  achieved_at timestamptz
);
alter table public.streak_dungeon_best enable row level security;
create policy "streak_dungeon_best는 본인만 조회" on public.streak_dungeon_best for select using (auth.uid() = user_id);
revoke insert, update, delete on public.streak_dungeon_best from authenticated;

/** 연승 보스 스탯(레벨+연승 스케일) - 클라이언트 streakDungeon.js의 getStreakDungeonBoss와 동일 공식 유지할 것 */
create or replace function public.calc_streak_dungeon_boss(p_level integer, p_streak integer)
returns table(max_hp integer, atk integer, def integer) as $$
declare
  v_level integer := greatest(1, p_level);
  v_streak integer := greatest(1, p_streak);
begin
  max_hp := round(700 + power(v_level, 1.35) * 18 + power(v_streak, 1.75) * 260);
  atk := round(45 + power(v_level, 1.15) * 3.6 + power(v_streak, 1.55) * 17);
  def := round(30 + power(v_level, 1.05) * 2.6 + power(v_streak, 1.45) * 11);
  return next;
end;
$$ language plpgsql immutable;

/** 연승 보상 골드(레벨+연승 스케일, 연승마다 1.3배 복리 증가) - 클라이언트 previewStreakDungeonGold와 동일 공식 유지할 것 */
create or replace function public.calc_streak_dungeon_gold(p_level integer, p_streak integer)
returns integer as $$
declare
  v_level integer := greatest(1, p_level);
  v_streak integer := greatest(1, p_streak);
  v_base numeric;
  v_gold numeric;
begin
  v_base := 220 + power(v_level, 1.25) * 6;
  v_gold := v_base * power(1.3, v_streak - 1);
  return least(1000000, round(v_gold))::integer; -- 100만 상한 클램프(add_gold 호출 전 사전 방어)
end;
$$ language plpgsql immutable;

/** 연승 던전 새로 시작 - 하루 3회 제한, 진행 중인 세션이 있으면 거부(먼저 이어가거나 포기해야 함) */
create or replace function public.start_streak_dungeon()
returns table(session_id uuid, streak integer) as $$
declare
  v_today date;
  v_monster record;
  v_existing record;
  v_new_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_existing from public.streak_dungeon_sessions
    where user_id = auth.uid() and status = 'active';
  if v_existing is not null then
    raise exception '이미 진행 중인 연승이 있습니다. 이어서 도전하거나 포기해주세요.';
  end if;

  select * into v_monster from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  v_today := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;

  insert into public.streak_dungeon_attempts (user_id, attempt_date, count)
  values (auth.uid(), v_today, 1)
  on conflict (user_id, attempt_date)
    do update set count = public.streak_dungeon_attempts.count + 1
    where public.streak_dungeon_attempts.count < 3;

  if not found then
    raise exception '오늘의 연승 던전 입장 횟수(3회)를 모두 사용했어요.';
  end if;

  insert into public.streak_dungeon_sessions (user_id, owned_monster_id, streak, status)
  values (auth.uid(), v_monster.id, 1, 'active')
  returning id into v_new_id;

  session_id := v_new_id;
  streak := 1;
  return next;
end;
$$ language plpgsql security definer;

/** 지금까지 도달한 연승이 있으면 이어서 재개할 때 조회(새로고침/재접속 대비) */
create or replace function public.fetch_my_active_streak_dungeon()
returns table(session_id uuid, streak integer) as $$
begin
  if auth.uid() is null then
    return;
  end if;
  return query
    select sds.id, sds.streak from public.streak_dungeon_sessions sds
    where sds.user_id = auth.uid() and sds.status = 'active';
end;
$$ language plpgsql stable security definer;

/** 승리 후 "이어서 도전" - 연승+1, 보상은 아직 지급 안 함(더 큰 보상을 걸고 계속 진행) */
create or replace function public.continue_streak_dungeon(p_session_id uuid)
returns table(streak integer, gold_preview integer) as $$
declare
  v_session record;
  v_level integer;
  v_new_streak integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.streak_dungeon_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null or v_session.status <> 'active' then
    raise exception '유효하지 않은 연승 던전 세션입니다.';
  end if;
  if now() - v_session.last_action_at < interval '1 second' then
    raise exception '너무 빠릅니다. 실제로 전투를 진행해주세요.';
  end if;

  v_new_streak := v_session.streak + 1;

  update public.streak_dungeon_sessions
    set streak = v_new_streak, last_action_at = now()
    where id = p_session_id;

  -- 승리해서 도달한 연승 수는 이 시점에 기록(뱅킹 여부와 무관하게 "버틴 기록" 그 자체를 인정)
  insert into public.streak_dungeon_best (user_id, best_streak, achieved_at)
  values (auth.uid(), v_new_streak, now())
  on conflict (user_id) do update
    set best_streak = v_new_streak, achieved_at = now()
    where public.streak_dungeon_best.best_streak < v_new_streak;

  select level into v_level from public.owned_monsters where id = v_session.owned_monster_id;

  streak := v_new_streak;
  gold_preview := public.calc_streak_dungeon_gold(coalesce(v_level, 1), v_new_streak);
  return next;
end;
$$ language plpgsql security definer;

/** "지금 수령" - 현재 연승 기준 골드 확정 지급, 세션 종료(다음 새 연승은 다시 입장권 소모) */
create or replace function public.bank_streak_dungeon(p_session_id uuid)
returns table(gold integer, final_streak integer) as $$
declare
  v_session record;
  v_level integer;
  v_gold integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.streak_dungeon_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null or v_session.status <> 'active' then
    raise exception '유효하지 않은 연승 던전 세션입니다.';
  end if;
  if now() - v_session.last_action_at < interval '1 second' then
    raise exception '너무 빠릅니다. 실제로 전투를 진행해주세요.';
  end if;

  select level into v_level from public.owned_monsters where id = v_session.owned_monster_id;
  v_gold := least(1000000, public.calc_streak_dungeon_gold(coalesce(v_level, 1), v_session.streak));

  update public.streak_dungeon_sessions set status = 'banked', last_action_at = now() where id = p_session_id;
  perform public.add_gold(auth.uid(), v_gold);

  gold := v_gold;
  final_streak := v_session.streak;
  return next;
end;
$$ language plpgsql security definer;

/** 패배 시 "포기" - 이번 판 보상 소멸, 세션만 종료(연승 기록 자체는 continue 시점에 이미 남아있음) */
create or replace function public.forfeit_streak_dungeon(p_session_id uuid)
returns void as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  update public.streak_dungeon_sessions
    set status = 'forfeited', last_action_at = now()
    where id = p_session_id and user_id = auth.uid() and status = 'active';
end;
$$ language plpgsql security definer;

/** 오늘 남은 연승 던전 입장 횟수 조회 */
create or replace function public.fetch_streak_dungeon_attempts_today()
returns integer as $$
declare
  v_today date;
  v_count integer;
begin
  if auth.uid() is null then
    return 0;
  end if;
  v_today := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;
  select count into v_count from public.streak_dungeon_attempts
    where user_id = auth.uid() and attempt_date = v_today;
  return greatest(0, 3 - coalesce(v_count, 0));
end;
$$ language plpgsql stable security definer;

/** 최고 연승 랭킹 TOP20 (무한의 탑 fetch_tower_leaderboard와 동일 패턴) */
create or replace function public.fetch_streak_dungeon_leaderboard()
returns table(rank integer, nickname text, best_streak integer, equipped_title text, is_me boolean) as $$
begin
  return query
  select
    row_number() over (order by sdb.best_streak desc)::integer as rank,
    p.nickname,
    sdb.best_streak,
    p.equipped_title,
    sdb.user_id = auth.uid() as is_me
  from public.streak_dungeon_best sdb
  join public.profiles p on p.id = sdb.user_id
  where sdb.best_streak > 0
  order by sdb.best_streak desc
  limit 20;
end;
$$ language plpgsql stable security definer;

create or replace function public.fetch_my_streak_dungeon_rank()
returns integer as $$
declare
  v_my_best integer;
  v_rank integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select best_streak into v_my_best from public.streak_dungeon_best where user_id = auth.uid();
  if coalesce(v_my_best, 0) = 0 then return null; end if;

  select count(*) + 1 into v_rank from public.streak_dungeon_best
    where best_streak > v_my_best;

  return v_rank;
end;
$$ language plpgsql stable security definer;
