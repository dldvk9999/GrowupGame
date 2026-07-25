-- ============================================
-- 142: 루비 재화 + 루비 던전 신설 - 사용자 요청
-- 전직 스킬 강화(143)에 쓰일 새 재화 "루비"를 얻는 전용 던전. 순차 층 진행이 아니라
-- job_dungeon_sessions처럼 "매번 새 세션으로 보스 1마리와 싸우는" 단발성 구조 - 층 개념이
-- 없고 캐릭터 레벨에 맞춰 난이도가 자동으로 스케일됨(전직처럼 "단계"를 깰 필요 없음).
-- 클리어 시 10~100개 랜덤 루비, 하루 5회 제한.
-- ============================================

alter table public.profiles add column if not exists rubies integer not null default 0;

create table public.ruby_dungeon_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_date date not null,
  count integer not null default 0,
  primary key (user_id, attempt_date)
);
alter table public.ruby_dungeon_attempts enable row level security;
create policy "ruby_dungeon_attempts는 본인만 조회" on public.ruby_dungeon_attempts for select using (auth.uid() = user_id);
revoke insert, update, delete on public.ruby_dungeon_attempts from authenticated;

create table public.ruby_dungeon_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  owned_monster_id uuid not null references public.owned_monsters(id) on delete cascade,
  created_at timestamptz not null default now(),
  claimed boolean not null default false
);
create index ruby_dungeon_sessions_user_idx on public.ruby_dungeon_sessions(user_id);
alter table public.ruby_dungeon_sessions enable row level security;
create policy "ruby_dungeon_sessions는 본인만 조회" on public.ruby_dungeon_sessions for select using (auth.uid() = user_id);
revoke insert, update, delete on public.ruby_dungeon_sessions from authenticated;

/** 루비 던전 보스 스탯(레벨 스케일) - 클라이언트 rubyDungeon.js의 getRubyDungeonBoss와 동일 공식 유지할 것 */
create or replace function public.calc_ruby_dungeon_boss(p_level integer)
returns table(max_hp integer, atk integer, def integer) as $$
begin
  max_hp := round(1500 + power(greatest(1, p_level), 1.5) * 40);
  atk := round(80 + power(greatest(1, p_level), 1.3) * 6);
  def := round(60 + power(greatest(1, p_level), 1.2) * 4);
  return next;
end;
$$ language plpgsql immutable;

/** 루비 던전 입장 - 하루 5회 제한(Asia/Seoul 기준 08:00 리셋, 다른 일일 던전과 동일 규칙) */
create or replace function public.start_ruby_dungeon()
returns uuid as $$
declare
  v_today date;
  v_monster record;
  v_session_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_monster from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  v_today := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;

  insert into public.ruby_dungeon_attempts (user_id, attempt_date, count)
  values (auth.uid(), v_today, 1)
  on conflict (user_id, attempt_date)
    do update set count = public.ruby_dungeon_attempts.count + 1
    where public.ruby_dungeon_attempts.count < 5;

  if not found then
    raise exception '오늘의 루비 던전 입장 횟수(5회)를 모두 사용했어요.';
  end if;

  insert into public.ruby_dungeon_sessions (user_id, owned_monster_id)
  values (auth.uid(), v_monster.id)
  returning id into v_session_id;

  return v_session_id;
end;
$$ language plpgsql security definer;

/** 루비 던전 보상 수령 - 클리어 시 10~100개 랜덤 루비 */
create or replace function public.claim_ruby_dungeon_reward(p_session_id uuid)
returns integer as $$
declare
  v_session public.ruby_dungeon_sessions;
  v_rubies integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.ruby_dungeon_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null then
    raise exception '유효하지 않은 루비 던전 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 완료한 던전입니다.';
  end if;
  if now() - v_session.created_at < interval '1 second' then
    raise exception '너무 빠릅니다. 실제로 전투를 진행해주세요.';
  end if;

  v_rubies := 10 + floor(random() * 91)::integer; -- 10~100

  update public.ruby_dungeon_sessions set claimed = true where id = p_session_id;
  update public.profiles set rubies = rubies + v_rubies where id = auth.uid();

  return v_rubies;
end;
$$ language plpgsql security definer;

/** 오늘 남은 루비 던전 입장 횟수 조회 */
create or replace function public.fetch_ruby_dungeon_attempts_today()
returns integer as $$
declare
  v_today date;
  v_count integer;
begin
  if auth.uid() is null then
    return 0;
  end if;
  v_today := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;
  select count into v_count from public.ruby_dungeon_attempts
    where user_id = auth.uid() and attempt_date = v_today;
  return greatest(0, 5 - coalesce(v_count, 0));
end;
$$ language plpgsql stable security definer;
