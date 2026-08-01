-- ============================================
-- 159: 봉인된 던전(Sealed Dungeon) 신설 - 신규 콘텐츠 (사용자 요청)
-- "유저가 너무 쉽게 만렙되고 재화가 넘쳐나게 하지 말고, 오히려 게임에 오래 머무르게
-- 하라"는 명시적 방향 - 지금까지 추가한 던전들(연승/골든타임/길드레이드)은 전부 골드를
-- 더 주는 방향이었다면, 이번엔 정반대로 설계함:
--
--   1) 골드/경험치를 단 1도 주지 않음 - 레벨업 속도나 재화 총량에 전혀 영향을 주지 않는
--      완전히 분리된 보상 트랙("봉인의 파편")만 지급
--   2) 입장권("봉인의 열쇠")이 하루 1개만 자연 생성되고 최대 3개까지만 저장됨(골드로
--      구매 불가, 다른 재화로 전환 불가) - 하루에 몰아서 파밍할 수 없고, 며칠에 걸쳐
--      "오늘의 몫"만큼만 진행되도록 강제해 자연스럽게 재방문 주기를 만듦
--   3) 보스 난이도는 루비던전보다 약 1.4배 높게 설계(진짜 도전 요소) - 장비/스킬 세팅이
--      충분하지 않으면 못 깨는 "실력 체크" 성격
--   4) 파편은 오직 누적 랭킹/마일스톤 업적에만 쓰임(소비 불가, 영구 누적) - "오늘 얼마나
--      벌었나"가 아니라 "지금까지 얼마나 꾸준히 도전했나"를 보여주는 장기 지표
-- ============================================

alter table public.profiles add column if not exists seal_fragments bigint not null default 0;
alter table public.profiles add column if not exists seal_keys integer not null default 0;
alter table public.profiles add column if not exists seal_keys_claimed_date date;

-- 단발성 보스 세션(루비 던전과 동일한 "세션 생성 후 최소 1초" 안티치트 패턴)
create table public.sealed_dungeon_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  owned_monster_id uuid not null references public.owned_monsters(id) on delete cascade,
  created_at timestamptz not null default now(),
  claimed boolean not null default false
);
create index sealed_dungeon_sessions_user_idx on public.sealed_dungeon_sessions(user_id);
alter table public.sealed_dungeon_sessions enable row level security;
create policy "sealed_dungeon_sessions는 본인만 조회" on public.sealed_dungeon_sessions for select using (auth.uid() = user_id);
revoke insert, update, delete on public.sealed_dungeon_sessions from authenticated;

/** 봉인의 열쇠 보스 스탯(레벨 스케일만, 루비던전 대비 약 1.4배) - 클라이언트 getSealedDungeonBoss와 동일 공식 유지할 것 */
create or replace function public.calc_sealed_dungeon_boss(p_level integer)
returns table(max_hp integer, atk integer, def integer) as $$
declare
  v_level integer := greatest(1, p_level);
begin
  max_hp := round(2000 + power(v_level, 1.5) * 56);
  atk := round(110 + power(v_level, 1.3) * 8.4);
  def := round(85 + power(v_level, 1.2) * 5.6);
  return next;
end;
$$ language plpgsql immutable;

/** 내 봉인 열쇠/파편 현황 조회 - 조회할 때마다 "오늘 아직 자연증가분을 못 받았으면" 자동 지급(최대 3개 캡) */
create or replace function public.fetch_my_seal_status()
returns table(seal_keys integer, seal_fragments bigint) as $$
declare
  v_today date := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_profile from public.profiles where id = auth.uid() for update;

  if v_profile.seal_keys_claimed_date is distinct from v_today then
    update public.profiles
      set seal_keys = least(3, v_profile.seal_keys + 1),
          seal_keys_claimed_date = v_today
      where id = auth.uid();
  end if;

  return query select p.seal_keys, p.seal_fragments from public.profiles p where p.id = auth.uid();
end;
$$ language plpgsql security definer;

/** 봉인된 던전 입장 - 열쇠 1개 소모(골드로 구매 불가, 오직 자연증가분만 사용 가능) */
create or replace function public.enter_sealed_dungeon()
returns table(session_id uuid, seal_keys_remaining integer) as $$
declare
  v_monster record;
  v_new_id uuid;
  v_remaining integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  update public.profiles set seal_keys = seal_keys - 1
    where id = auth.uid() and seal_keys > 0
    returning seal_keys into v_remaining;

  if v_remaining is null then
    raise exception '봉인의 열쇠가 없어요. 하루에 하나씩 자연 생성돼요(최대 3개 보관).';
  end if;

  select * into v_monster from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  insert into public.sealed_dungeon_sessions (user_id, owned_monster_id)
  values (auth.uid(), v_monster.id)
  returning id into v_new_id;

  session_id := v_new_id;
  seal_keys_remaining := v_remaining;
  return next;
end;
$$ language plpgsql security definer;

/** 승리 보상 - 골드/경험치 없이 파편 고정 3개만 지급(레벨/장비와 무관, 파밍 가속 원천 차단) */
create or replace function public.claim_sealed_dungeon_reward(p_session_id uuid)
returns table(fragments_earned integer, total_fragments bigint) as $$
declare
  v_session public.sealed_dungeon_sessions;
  v_earned integer := 3;
  v_total bigint;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.sealed_dungeon_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null then
    raise exception '유효하지 않은 던전 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 보상을 받은 던전입니다.';
  end if;
  if now() - v_session.created_at < interval '1 second' then
    raise exception '너무 빠릅니다. 실제로 전투를 진행해주세요.';
  end if;

  update public.sealed_dungeon_sessions set claimed = true where id = p_session_id;
  update public.profiles set seal_fragments = seal_fragments + v_earned where id = auth.uid()
    returning seal_fragments into v_total;

  fragments_earned := v_earned;
  total_fragments := v_total;
  return next;
end;
$$ language plpgsql security definer;

/** 누적 파편 랭킹 TOP20 - "오늘 얼마나 벌었나"가 아니라 "얼마나 꾸준했나"를 보여주는 영구 지표 */
create or replace function public.fetch_seal_leaderboard()
returns table(rank integer, nickname text, equipped_title text, seal_fragments bigint, is_me boolean) as $$
begin
  return query
  select
    row_number() over (order by p.seal_fragments desc)::integer as rank,
    p.nickname,
    p.equipped_title,
    p.seal_fragments,
    p.id = auth.uid() as is_me
  from public.profiles p
  where p.seal_fragments > 0
  order by p.seal_fragments desc
  limit 20;
end;
$$ language plpgsql stable security definer;

create or replace function public.fetch_my_seal_rank()
returns integer as $$
declare
  v_my_fragments bigint;
  v_rank integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select seal_fragments into v_my_fragments from public.profiles where id = auth.uid();
  if coalesce(v_my_fragments, 0) = 0 then return null; end if;

  select count(*) + 1 into v_rank from public.profiles where seal_fragments > v_my_fragments;
  return v_rank;
end;
$$ language plpgsql stable security definer;
