-- ============================================
-- 몬스터 육성 게임 초기 스키마
-- Supabase SQL Editor에 그대로 붙여넣고 실행하면 됨
-- ============================================

-- 확장 (uuid 생성용, 보통 supabase는 기본 활성화되어 있음)
create extension if not exists "pgcrypto";

-- ============================================
-- 1. 유저 프로필 (auth.users는 supabase가 자동 관리)
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique,
  level integer not null default 1,
  exp integer not null default 0,
  gold integer not null default 0,
  stamina integer not null default 100,
  stamina_max integer not null default 100,
  stamina_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 닉네임 형식 제약 (2~12자, 한글/영문/숫자만)
alter table public.profiles
  add constraint nickname_format check (nickname ~ '^[a-zA-Z0-9가-힣]{2,12}$');

-- ============================================
-- 2. 몬스터 원본 도감 (마스터 데이터, 모든 유저 공통)
-- ============================================
create table public.monster_species (
  id serial primary key,
  name text not null,
  element text not null check (element in ('fire', 'water', 'grass')),
  stage integer not null default 1,          -- 진화 단계 (1~3)
  evolves_to integer references public.monster_species(id),
  evolve_level integer,                       -- 이 레벨 되면 자동 진화
  base_hp integer not null,
  base_atk integer not null,
  base_def integer not null,
  is_boss boolean not null default false,     -- 보스 전용 개체 여부
  sprite_key text                             -- 프론트에서 어떤 SVG/에셋 쓸지 매핑
);

-- ============================================
-- 3. 유저가 보유한 몬스터
-- ============================================
create table public.owned_monsters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  species_id integer not null references public.monster_species(id),
  nickname text,
  level integer not null default 1,
  exp integer not null default 0,
  hp integer not null,
  atk integer not null,
  def integer not null,
  is_active boolean not null default false,   -- 사육장에 표시 중인 대표 몬스터
  caught_at timestamptz not null default now()
);

create index owned_monsters_user_idx on public.owned_monsters(user_id);

-- ============================================
-- 4. 스테이지 / 보스 진행 상황
-- ============================================
create table public.stage_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  stage_id integer not null,
  cleared boolean not null default false,
  cleared_at timestamptz,
  primary key (user_id, stage_id)
);

-- ============================================
-- 5. 로비 채팅 (Realtime 구독용)
-- ============================================
create table public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  nickname text not null,
  content text not null check (char_length(content) between 1 and 200),
  created_at timestamptz not null default now()
);

create index chat_messages_created_idx on public.chat_messages(created_at desc);

-- ============================================
-- 6. 회원가입 시 profiles 자동 생성 트리거
--    (auth.users에 새 유저 생기면 nickname은 클라이언트에서 별도 upsert)
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, 'user_' || substr(new.id::text, 1, 8));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- 7. RLS (Row Level Security) 활성화
-- ============================================
alter table public.profiles enable row level security;
alter table public.owned_monsters enable row level security;
alter table public.stage_progress enable row level security;
alter table public.chat_messages enable row level security;
alter table public.monster_species enable row level security;

-- monster_species: 전체 공개 읽기 (도감은 누구나 조회 가능, 수정은 불가)
create policy "monster_species는 누구나 조회 가능"
  on public.monster_species for select
  using (true);

-- profiles: 본인 것만 수정, 조회는 전체 공개(닉네임 노출용, 채팅/랭킹에 필요)
create policy "profiles는 누구나 조회 가능"
  on public.profiles for select
  using (true);

create policy "profiles는 본인만 수정 가능"
  on public.profiles for update
  using (auth.uid() = id);

-- owned_monsters: 본인 것만 CRUD
create policy "owned_monsters는 본인만 조회"
  on public.owned_monsters for select
  using (auth.uid() = user_id);

create policy "owned_monsters는 본인만 생성"
  on public.owned_monsters for insert
  with check (auth.uid() = user_id);

create policy "owned_monsters는 본인만 수정"
  on public.owned_monsters for update
  using (auth.uid() = user_id);

create policy "owned_monsters는 본인만 삭제"
  on public.owned_monsters for delete
  using (auth.uid() = user_id);

-- stage_progress: 본인 것만
create policy "stage_progress는 본인만 조회"
  on public.stage_progress for select
  using (auth.uid() = user_id);

create policy "stage_progress는 본인만 upsert"
  on public.stage_progress for insert
  with check (auth.uid() = user_id);

create policy "stage_progress는 본인만 수정"
  on public.stage_progress for update
  using (auth.uid() = user_id);

-- chat_messages: 로그인 유저는 전체 조회 + 본인 명의로만 작성
create policy "chat_messages는 로그인 유저 전체 조회"
  on public.chat_messages for select
  using (auth.role() = 'authenticated');

create policy "chat_messages는 본인 명의로만 작성"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

-- ============================================
-- 8. 닉네임 중복 체크용 RPC (프론트에서 실시간 중복확인 호출)
-- ============================================
create or replace function public.is_nickname_taken(check_nickname text)
returns boolean as $$
  select exists (
    select 1 from public.profiles where nickname = check_nickname
  );
$$ language sql stable security definer;

-- ============================================
-- 9. 스타터 몬스터 시드 데이터 (3속성 × 3진화단계)
-- ============================================
insert into public.monster_species
  (id, name, element, stage, evolve_level, base_hp, base_atk, base_def, sprite_key) values
  (1, '이모탄',   'fire',  1, 15, 40, 12, 8,  'fire_1'),
  (2, '이모드릴', 'fire',  2, 30, 70, 20, 14, 'fire_2'),
  (3, '이모라돈', 'fire',  3, null, 120, 34, 22, 'fire_3'),
  (4, '아쿠파피', 'water', 1, 15, 44, 10, 10, 'water_1'),
  (5, '아쿠나가', 'water', 2, 30, 76, 17, 18, 'water_2'),
  (6, '아쿠드래곤', 'water', 3, null, 128, 28, 30, 'water_3'),
  (7, '새프링',   'grass', 1, 15, 42, 11, 9,  'grass_1'),
  (8, '새프트리', 'grass', 2, 30, 74, 19, 16, 'grass_2'),
  (9, '새프로드', 'grass', 3, null, 124, 30, 26, 'grass_3');

update public.monster_species set evolves_to = 2 where id = 1;
update public.monster_species set evolves_to = 3 where id = 2;
update public.monster_species set evolves_to = 5 where id = 4;
update public.monster_species set evolves_to = 6 where id = 5;
update public.monster_species set evolves_to = 8 where id = 7;
update public.monster_species set evolves_to = 9 where id = 8;

-- 보스 개체 (스테이지 클리어용, 예시 1스테이지 보스)
insert into public.monster_species
  (id, name, element, stage, base_hp, base_atk, base_def, is_boss, sprite_key) values
  (100, '파이어킹', 'fire', 1, 200, 25, 15, true, 'boss_fire_1');
