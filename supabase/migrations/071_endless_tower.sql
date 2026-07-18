-- ============================================
-- 071: 무한의 탑 (신규 던전 콘텐츠)
-- 기존 10층 고정 던전(exp/gold)과 별개로, 상한 없이 계속 올라가는 도전 모드.
-- "최고 도달 층수"를 랭킹으로 경쟁함. 기존 dungeon_* 테이블은 전혀 건드리지 않고
-- 완전히 독립된 새 테이블 세트로 구현해서 기존 던전 시스템에 영향 없음.
--
-- 전투 판정 방식은 기존 던전(clear_stage/claim_dungeon_reward)과 동일하게 "세션이
-- 유효하면 성공으로 신뢰"하는 구조(이 프로젝트에 이미 확립된 패턴, harness/todo.md에
-- "던전 실제 승리 여부 미검증"으로 이미 기록된 한계와 동일선상 - 새로 만든 취약점 아님).
-- 매크로 스팸 방지용으로 세션 생성 후 최소 2초 경과를 요구함.
-- ============================================

create table public.tower_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  highest_floor integer not null default 0
);
alter table public.tower_progress enable row level security;
create policy "tower_progress는 본인만 조회" on public.tower_progress for select using (auth.uid() = user_id);
revoke insert, update, delete on public.tower_progress from authenticated;

create table public.tower_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_date date not null,
  count integer not null default 0,
  primary key (user_id, attempt_date)
);
alter table public.tower_attempts enable row level security;
create policy "tower_attempts는 본인만 조회" on public.tower_attempts for select using (auth.uid() = user_id);
revoke insert, update, delete on public.tower_attempts from authenticated;

create table public.tower_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  floor integer not null check (floor >= 1),
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.tower_sessions enable row level security;
create policy "tower_sessions는 본인만 조회" on public.tower_sessions for select using (auth.uid() = user_id);
revoke insert, update, delete on public.tower_sessions from authenticated;

-- 층수 기준 골드 보상 공식 (기존 calc_dungeon_gold보다 가파르게 증가, 100만 상한 클램프)
create or replace function public.calc_tower_gold(p_floor integer)
returns integer as $$
declare
  v_hp numeric := 220 + power(p_floor, 1.8) * 200;
begin
  return least(1000000, greatest(100, round(v_hp * 1.1)));
end;
$$ language plpgsql immutable;

-- 입장: 하루 3회 제한(기존 던전과 동일 패턴), 현재 최고층+1 도전권 발급
create or replace function public.enter_tower()
returns table(session_id uuid, floor integer, remaining_attempts integer) as $$
declare
  v_today date := current_date;
  v_count integer;
  v_highest integer;
  v_next_floor integer;
  v_session_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  insert into public.tower_attempts (user_id, attempt_date, count)
  values (auth.uid(), v_today, 0)
  on conflict (user_id, attempt_date) do nothing;

  update public.tower_attempts set count = count + 1
    where user_id = auth.uid() and attempt_date = v_today and count < 3
    returning count into v_count;

  if v_count is null then
    raise exception '오늘 도전 횟수를 모두 사용했습니다. (하루 3회, 매일 오전 8시 초기화)';
  end if;

  insert into public.tower_progress (user_id, highest_floor)
  values (auth.uid(), 0)
  on conflict (user_id) do nothing;

  select highest_floor into v_highest from public.tower_progress where user_id = auth.uid();
  v_next_floor := v_highest + 1;

  insert into public.tower_sessions (user_id, floor)
  values (auth.uid(), v_next_floor)
  returning id into v_session_id;

  return query select v_session_id, v_next_floor, 3 - v_count;
end;
$$ language plpgsql security definer;

-- 클리어 보고: 최고기록 갱신 + 층수 비례 골드 지급
create or replace function public.claim_tower_floor(p_session_id uuid)
returns table(gold integer, new_highest_floor integer, is_new_record boolean) as $$
declare
  v_session public.tower_sessions;
  v_prev_highest integer;
  v_gold integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.tower_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null then
    raise exception '유효하지 않은 도전 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 보상을 받은 도전입니다.';
  end if;
  if now() - v_session.created_at < interval '2 seconds' then
    raise exception '너무 빠릅니다. 실제로 전투를 진행해주세요.';
  end if;

  update public.tower_sessions set claimed = true where id = p_session_id;

  select highest_floor into v_prev_highest from public.tower_progress where user_id = auth.uid();

  v_gold := public.calc_tower_gold(v_session.floor);
  perform public.add_gold(auth.uid(), v_gold);

  if v_session.floor > v_prev_highest then
    update public.tower_progress set highest_floor = v_session.floor where user_id = auth.uid();
  end if;

  return query select v_gold, greatest(v_prev_highest, v_session.floor), v_session.floor > v_prev_highest;
end;
$$ language plpgsql security definer;

-- 최고 도달 층수 랭킹 TOP20
create or replace function public.fetch_tower_leaderboard()
returns table(rank integer, nickname text, highest_floor integer, equipped_title text, is_me boolean) as $$
begin
  return query
  select
    row_number() over (order by tp.highest_floor desc)::integer as rank,
    p.nickname,
    tp.highest_floor,
    p.equipped_title,
    tp.user_id = auth.uid() as is_me
  from public.tower_progress tp
  join public.profiles p on p.id = tp.user_id
  where tp.highest_floor > 0
  order by tp.highest_floor desc
  limit 20;
end;
$$ language plpgsql stable security definer;

create or replace function public.fetch_my_tower_rank()
returns integer as $$
declare
  v_my_floor integer;
  v_rank integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select highest_floor into v_my_floor from public.tower_progress where user_id = auth.uid();
  if coalesce(v_my_floor, 0) = 0 then return null; end if;

  select count(*) + 1 into v_rank from public.tower_progress
    where highest_floor > v_my_floor;

  return v_rank;
end;
$$ language plpgsql stable security definer;
