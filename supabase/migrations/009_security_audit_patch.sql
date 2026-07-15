-- ============================================
-- 009: 보안 점검 패치
-- 가장 심각한 문제: add_gold가 client에서 직접 호출 가능해서
-- 임의 금액(최대 10만)을 무제한 반복 호출로 긁어갈 수 있었음.
-- → add_gold/spend_gold를 "내부 전용"으로 잠그고, 보상 금액은
--   전부 서버가 스테이지/던전 공식으로 직접 계산하도록 변경.
-- Supabase SQL Editor에 순서대로 실행
-- ============================================

-- ============================================
-- 1. add_gold / spend_gold를 client가 직접 호출 못하게 잠금
--    (다른 SECURITY DEFINER 함수가 내부적으로 호출하는 건 계속 됨 -
--     nested 호출은 함수 소유자 권한으로 실행되기 때문)
-- ============================================
revoke execute on function public.add_gold(uuid, integer) from public, anon, authenticated;
revoke execute on function public.spend_gold(uuid, integer) from public, anon, authenticated;

-- ============================================
-- 2. 스테이지/던전/자동사냥 골드 보상 공식을 SQL로 미러링
--    (stages.js / dungeonStages.js와 반드시 값 동일하게 유지)
-- ============================================
create or replace function public.calc_stage_gold(p_chapter integer, p_stage integer)
returns integer as $$
declare
  v_index integer := (p_chapter - 1) * 10 + p_stage;
  v_is_boss boolean := (p_stage = 10);
  v_hp numeric := round(30 + v_index * 4.0 * (case when v_is_boss then 2.1 else 1 end));
begin
  return round((round(v_hp * (case when v_is_boss then 0.9 else 0.4 end)) + p_stage * 2) * 5);
end;
$$ language plpgsql immutable;

create or replace function public.calc_idle_gold(p_chapter integer, p_player_level integer)
returns integer as $$
declare
  v_hp numeric := greatest(10, round(8 + p_chapter * 0.6 + p_player_level * 0.8));
begin
  return greatest(5, round(v_hp * 0.15) * 5 * 8);
end;
$$ language plpgsql immutable;

create or replace function public.calc_dungeon_gold(p_dungeon_type text, p_stage integer)
returns integer as $$
declare
  v_hp numeric := round(200 + power(p_stage, 1.6) * 150);
begin
  if p_dungeon_type = 'gold' then
    return round(v_hp * 3.2);
  else
    return round(v_hp * 0.6);
  end if;
end;
$$ language plpgsql immutable;

-- ============================================
-- 3. clear_stage: 골드 지급까지 서버가 직접 계산해서 함께 처리 (반환값 = 지급된 골드)
--    반환 타입이 void → integer로 바뀌므로 기존 함수를 먼저 삭제해야 함
-- ============================================
drop function if exists public.clear_stage(integer);

create or replace function public.clear_stage(p_stage_id integer)
returns integer as $$
declare
  v_prev_cleared boolean;
  v_self_cleared boolean;
  v_chapter integer;
  v_stage integer;
  v_gold integer;
begin
  if p_stage_id < 1 or p_stage_id > 1000 then
    raise exception '유효하지 않은 스테이지입니다.';
  end if;

  if p_stage_id > 1 then
    select cleared into v_prev_cleared from public.stage_progress
      where user_id = auth.uid() and stage_id = p_stage_id - 1;
    select cleared into v_self_cleared from public.stage_progress
      where user_id = auth.uid() and stage_id = p_stage_id;
    if coalesce(v_prev_cleared, false) = false and coalesce(v_self_cleared, false) = false then
      raise exception '아직 열리지 않은 스테이지입니다.';
    end if;
  end if;

  insert into public.stage_progress (user_id, stage_id, cleared, cleared_at)
  values (auth.uid(), p_stage_id, true, now())
  on conflict (user_id, stage_id) do update set cleared = true, cleared_at = now();

  v_chapter := ((p_stage_id - 1) / 10) + 1;
  v_stage := ((p_stage_id - 1) % 10) + 1;
  v_gold := public.calc_stage_gold(v_chapter, v_stage);

  perform public.add_gold(auth.uid(), v_gold);
  return v_gold;
end;
$$ language plpgsql security definer;

-- ============================================
-- 4. 자동사냥 골드 지급 전용 RPC (서버 계산 + 과호출 방지용 최소 간격 제한)
-- ============================================
alter table public.profiles add column last_idle_reward_at timestamptz;

create or replace function public.grant_idle_reward(p_chapter integer, p_player_level integer)
returns integer as $$
declare
  v_last timestamptz;
  v_gold integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select last_idle_reward_at into v_last from public.profiles where id = auth.uid() for update;
  if v_last is not null and now() - v_last < interval '2.5 seconds' then
    raise exception '너무 빠른 요청입니다.';
  end if;

  v_gold := public.calc_idle_gold(p_chapter, p_player_level);
  update public.profiles set last_idle_reward_at = now() where id = auth.uid();
  perform public.add_gold(auth.uid(), v_gold);
  return v_gold;
end;
$$ language plpgsql security definer;

-- ============================================
-- 5. 던전 세션 - "입장 → 승리 시 1회만 수령" 흐름을 서버가 검증
-- ============================================
create table public.dungeon_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  dungeon_type text not null check (dungeon_type in ('exp', 'gold')),
  stage integer not null check (stage between 1 and 10),
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.dungeon_sessions enable row level security;
create policy "dungeon_sessions는 본인만 조회" on public.dungeon_sessions for select using (auth.uid() = user_id);

-- 기존 1-파라미터 버전이 오버로드로 남지 않도록 먼저 삭제
drop function if exists public.use_dungeon_attempt(text);

create or replace function public.use_dungeon_attempt(p_dungeon_type text, p_stage integer)
returns table(session_id uuid, remaining integer) as $$
declare
  v_today date;
  v_new_count integer;
  v_session_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_dungeon_type not in ('exp', 'gold') then
    raise exception '유효하지 않은 던전입니다.';
  end if;
  if p_stage < 1 or p_stage > 10 then
    raise exception '유효하지 않은 층입니다.';
  end if;

  v_today := (now() at time zone 'Asia/Seoul')::date;

  insert into public.dungeon_attempts (user_id, dungeon_type, attempt_date, count)
  values (auth.uid(), p_dungeon_type, v_today, 1)
  on conflict (user_id, dungeon_type, attempt_date)
    do update set count = public.dungeon_attempts.count + 1
    where public.dungeon_attempts.count < 3
  returning count into v_new_count;

  if v_new_count is null then
    raise exception '오늘 입장 횟수를 모두 사용했습니다. (하루 3회)';
  end if;

  insert into public.dungeon_sessions (user_id, dungeon_type, stage)
  values (auth.uid(), p_dungeon_type, p_stage)
  returning id into v_session_id;

  return query select v_session_id, 3 - v_new_count;
end;
$$ language plpgsql security definer;

create or replace function public.claim_dungeon_reward(p_session_id uuid)
returns integer as $$
declare
  v_session public.dungeon_sessions;
  v_gold integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.dungeon_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null then
    raise exception '유효하지 않은 던전 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 보상을 받은 던전입니다.';
  end if;

  update public.dungeon_sessions set claimed = true where id = p_session_id;

  v_gold := public.calc_dungeon_gold(v_session.dungeon_type, v_session.stage);
  perform public.add_gold(auth.uid(), v_gold);
  return v_gold;
end;
$$ language plpgsql security definer;

-- ============================================
-- 6. 닉네임 1회수정 레이스컨디션 수정
-- ============================================
create or replace function public.update_nickname(p_nickname text)
returns void as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_nickname !~ '^[a-zA-Z0-9가-힣]{2,12}$' then
    raise exception '닉네임은 한글/영문/숫자 2~12자로 입력해주세요.';
  end if;

  begin
    update public.profiles set nickname = p_nickname, nickname_edited = true
      where id = auth.uid() and nickname_edited = false;
  exception when unique_violation then
    raise exception '이미 사용 중인 닉네임입니다.';
  end;

  if not found then
    raise exception '닉네임은 이미 한 번 수정했습니다.';
  end if;
end;
$$ language plpgsql security definer;

-- ============================================
-- 7. 방어적 하드닝: 명시적으로 client 쓰기권한 회수 (RLS로 이미 막혀있지만 이중 방어)
-- ============================================
revoke insert, update, delete on public.mails from authenticated;
revoke insert, update, delete on public.dungeon_attempts from authenticated;
revoke insert, update, delete on public.dungeon_sessions from authenticated;
revoke insert, update, delete on public.coupons from authenticated;
revoke insert, update, delete on public.coupon_redemptions from authenticated;
revoke insert, update, delete on public.skill_catalog from authenticated;
revoke insert, update, delete on public.item_catalog from authenticated;
revoke insert, update, delete on public.monster_species from authenticated;
