-- ============================================
-- 006: 마이페이지(닉네임 1회 수정) + 스킬 뽑기 시스템
-- Supabase SQL Editor에 순서대로 실행
-- ============================================

-- ============================================
-- 1. profiles 확장: 닉네임 1회수정 플래그, 장착 스킬, 누적 뽑기횟수
-- ============================================
alter table public.profiles add column nickname_edited boolean not null default false;
alter table public.profiles add column equipped_skills text[] not null default '{}';
alter table public.profiles add column total_skill_draws integer not null default 0;

-- 기존엔 client가 nickname 컬럼을 직접 UPDATE 가능했는데(004),
-- 이제 "1회 제한"을 서버가 강제해야 하므로 직접 권한 회수하고 RPC로만 변경 가능하게 함
revoke update (nickname) on public.profiles from authenticated;

-- 회원가입 시 선택한 닉네임을 트리거가 직접 반영 (signUp의 options.data.nickname로 전달됨)
-- 이건 "1회 수정"에 포함되지 않는 최초 설정임
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_wanted text;
  v_final text;
begin
  v_wanted := new.raw_user_meta_data->>'nickname';
  v_final := 'u' || substr(replace(new.id::text, '-', ''), 1, 8);

  if v_wanted is not null and v_wanted ~ '^[a-zA-Z0-9가-힣]{2,12}$' then
    begin
      insert into public.profiles (id, nickname) values (new.id, v_wanted);
      return new;
    exception when unique_violation then
      -- 동시가입 등으로 충돌하면 랜덤 기본 닉네임으로 폴백
      null;
    end;
  end if;

  insert into public.profiles (id, nickname) values (new.id, v_final);
  return new;
end;
$$ language plpgsql security definer;

-- 마이페이지 닉네임 변경: 평생 1회만 허용
create or replace function public.update_nickname(p_nickname text)
returns void as $$
declare
  v_edited boolean;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_nickname !~ '^[a-zA-Z0-9가-힣]{2,12}$' then
    raise exception '닉네임은 한글/영문/숫자 2~12자로 입력해주세요.';
  end if;

  select nickname_edited into v_edited from public.profiles where id = auth.uid();
  if v_edited then
    raise exception '닉네임은 이미 한 번 수정했습니다.';
  end if;

  begin
    update public.profiles set nickname = p_nickname, nickname_edited = true where id = auth.uid();
  exception when unique_violation then
    raise exception '이미 사용 중인 닉네임입니다.';
  end;
end;
$$ language plpgsql security definer;

-- ============================================
-- 2. 스킬 카탈로그 (서버 진실 공급원, skillCatalog.js와 값 동일하게 유지)
-- ============================================
create table public.skill_catalog (
  skill_key text primary key,
  name text not null,
  icon text not null,
  rarity text not null check (rarity in ('normal', 'rare', 'epic', 'legendary', 'mythic')),
  rarity_order integer not null,
  type text not null check (type in ('damage', 'heal')),
  base_value numeric not null,   -- damage면 배율, heal이면 최대체력 대비 비율
  cooldown_ms integer not null,
  description text
);

alter table public.skill_catalog enable row level security;
create policy "skill_catalog는 누구나 조회 가능" on public.skill_catalog for select using (true);

insert into public.skill_catalog (skill_key, name, icon, rarity, rarity_order, type, base_value, cooldown_ms, description) values
  ('basic_strike',   '기본 찌르기',   '🗡️', 'normal',    1, 'damage', 1.00, 800,  '기본 공격'),
  ('quick_slash',    '속사 베기',     '💨', 'normal',    1, 'damage', 1.05, 900,  '빠르고 가벼운 연속 베기'),
  ('minor_heal',     '작은 회복',     '💧', 'normal',    1, 'heal',   0.10, 5000, '체력을 소량 회복'),
  ('flame_bolt',     '화염탄',        '🔥', 'rare',      2, 'damage', 1.40, 1800, '화염 구체를 발사'),
  ('aqua_jet',       '물살 가르기',   '🌊', 'rare',      2, 'damage', 1.45, 1900, '물살로 강하게 베어냄'),
  ('field_heal',     '야전 치유',     '✳️', 'rare',      2, 'heal',   0.15, 5500, '전투 중 상처를 응급 치료'),
  ('thunder_strike', '뇌격',          '⚡', 'epic',      3, 'damage', 1.96, 2800, '번개를 내리쳐 강타'),
  ('shadow_fang',    '그림자 송곳니', '🌑', 'epic',      3, 'damage', 2.00, 2900, '그림자 속에서 급습'),
  ('greater_heal',   '상급 치유',     '💠', 'epic',      3, 'heal',   0.20, 6000, '깊은 상처까지 회복'),
  ('dragon_roar',    '용의 포효',     '🐲', 'legendary', 4, 'damage', 2.74, 4200, '용의 기운을 담은 포효'),
  ('void_pierce',    '공허 관통',     '🌀', 'legendary', 4, 'damage', 2.80, 4300, '차원을 가르는 일격'),
  ('sanctuary',      '성역의 가호',   '🕊️', 'legendary', 4, 'heal',   0.28, 7000, '성역의 축복으로 회복'),
  ('world_ender',    '종말의 일격',   '☄️', 'mythic',    5, 'damage', 3.84, 6500, '세상을 가르는 궁극기'),
  ('genesis_blast',  '창세의 폭발',   '✨', 'mythic',    5, 'damage', 3.90, 6600, '태초의 힘을 폭발시킴'),
  ('eternal_life',   '불멸의 축복',   '👑', 'mythic',    5, 'heal',   0.40, 9000, '불멸에 가까운 회복력');

-- ============================================
-- 3. 보유 스킬 (중복 뽑으면 새로 안 생기고 skill_level만 오름)
-- ============================================
create table public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_key text not null references public.skill_catalog(skill_key),
  skill_level integer not null default 1 check (skill_level >= 1 and skill_level <= 100),
  acquired_at timestamptz not null default now(),
  unique (user_id, skill_key)
);

alter table public.user_skills enable row level security;
create policy "user_skills는 본인만 조회" on public.user_skills for select using (auth.uid() = user_id);
-- insert/update는 client 직접 불가, draw_skill RPC로만

-- ============================================
-- 4. 스킬 뽑기 RPC
--    뽑기레벨(1~20) = 1 + floor(누적뽑기횟수/5), 레벨 높을수록 고등급 확률 상승
-- ============================================
create or replace function public.draw_skill()
returns table(skill_key text, new_skill_level integer, was_duplicate boolean, cost integer, draw_level integer) as $$
declare
  v_draws integer;
  v_draw_level integer;
  v_cost integer;
  v_gold integer;
  v_roll numeric;
  v_rarity_order integer;
  v_picked_key text;
  v_existing_level integer;
  v_final_level integer;
  v_was_dup boolean;
  w_normal numeric; w_rare numeric; w_epic numeric; w_legendary numeric; w_mythic numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select total_skill_draws into v_draws from public.profiles where id = auth.uid();
  v_draw_level := least(20, 1 + v_draws / 5);
  v_cost := 100 + (v_draw_level - 1) * 30;

  select gold into v_gold from public.profiles where id = auth.uid() for update;
  if v_gold is null or v_gold < v_cost then
    raise exception '골드가 부족합니다.';
  end if;

  -- 뽑기레벨 구간별 등급 확률 (normal/rare/epic/legendary/mythic 순, 합=1)
  if v_draw_level <= 3 then
    w_normal := 0.70; w_rare := 0.25; w_epic := 0.05; w_legendary := 0.00; w_mythic := 0.00;
  elsif v_draw_level <= 7 then
    w_normal := 0.50; w_rare := 0.32; w_epic := 0.15; w_legendary := 0.03; w_mythic := 0.00;
  elsif v_draw_level <= 11 then
    w_normal := 0.32; w_rare := 0.33; w_epic := 0.25; w_legendary := 0.09; w_mythic := 0.01;
  elsif v_draw_level <= 15 then
    w_normal := 0.18; w_rare := 0.27; w_epic := 0.30; w_legendary := 0.20; w_mythic := 0.05;
  elsif v_draw_level <= 19 then
    w_normal := 0.08; w_rare := 0.17; w_epic := 0.30; w_legendary := 0.32; w_mythic := 0.13;
  else
    w_normal := 0.03; w_rare := 0.10; w_epic := 0.25; w_legendary := 0.37; w_mythic := 0.25;
  end if;

  v_roll := random();
  if v_roll < w_normal then v_rarity_order := 1;
  elsif v_roll < w_normal + w_rare then v_rarity_order := 2;
  elsif v_roll < w_normal + w_rare + w_epic then v_rarity_order := 3;
  elsif v_roll < w_normal + w_rare + w_epic + w_legendary then v_rarity_order := 4;
  else v_rarity_order := 5;
  end if;

  select sc.skill_key into v_picked_key from public.skill_catalog sc
    where sc.rarity_order = v_rarity_order
    order by random() limit 1;

  update public.profiles set gold = gold - v_cost, total_skill_draws = total_skill_draws + 1
    where id = auth.uid();

  select us.skill_level into v_existing_level from public.user_skills us
    where us.user_id = auth.uid() and us.skill_key = v_picked_key;

  if v_existing_level is null then
    insert into public.user_skills (user_id, skill_key, skill_level) values (auth.uid(), v_picked_key, 1);
    v_final_level := 1;
    v_was_dup := false;
  else
    v_final_level := least(v_existing_level + 3, 100);
    update public.user_skills set skill_level = v_final_level
      where user_id = auth.uid() and skill_key = v_picked_key;
    v_was_dup := true;
  end if;

  return query select v_picked_key, v_final_level, v_was_dup, v_cost, least(20, 1 + (v_draws + 1) / 5);
end;
$$ language plpgsql security definer;

-- ============================================
-- 5. 스킬 편성 RPC (레벨에 따라 슬롯 수 제한)
-- ============================================
create or replace function public.set_skill_loadout(p_skill_keys text[])
returns void as $$
declare
  v_monster_level integer;
  v_slot_limit integer;
  v_owned_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select level into v_monster_level from public.owned_monsters
    where user_id = auth.uid() and is_active = true limit 1;
  if v_monster_level is null then v_monster_level := 1; end if;

  v_slot_limit := case
    when v_monster_level >= 75 then 5
    when v_monster_level >= 50 then 4
    when v_monster_level >= 25 then 3
    when v_monster_level >= 10 then 2
    else 1
  end;

  if array_length(p_skill_keys, 1) is not null and array_length(p_skill_keys, 1) > v_slot_limit then
    raise exception '아직 그만큼 스킬 슬롯이 열리지 않았습니다. (현재 % 슬롯)', v_slot_limit;
  end if;

  if array_length(p_skill_keys, 1) is not null then
    select count(*) into v_owned_count from public.user_skills
      where user_id = auth.uid() and skill_key = any(p_skill_keys);
    if v_owned_count <> array_length(p_skill_keys, 1) then
      raise exception '보유하지 않은 스킬이 포함되어 있습니다.';
    end if;
    if array_length(p_skill_keys, 1) <> (select count(distinct k) from unnest(p_skill_keys) k) then
      raise exception '같은 스킬을 중복 장착할 수 없습니다.';
    end if;
  end if;

  update public.profiles set equipped_skills = coalesce(p_skill_keys, '{}') where id = auth.uid();
end;
$$ language plpgsql security definer;

-- ============================================
-- 6. 스타터 생성 시 기본 스킬(기본 찌르기) 1개 자동 지급 + 장착
-- ============================================
create or replace function public.create_starter_monster(p_species_key text)
returns public.owned_monsters as $$
declare
  v_species_id integer;
  v_species record;
  v_existing integer;
  v_row public.owned_monsters;
begin
  v_species_id := case p_species_key
    when 'fire_1' then 1
    when 'water_1' then 4
    when 'grass_1' then 7
    else null
  end;
  if v_species_id is null then
    raise exception '유효하지 않은 스타터입니다.';
  end if;

  select count(*) into v_existing from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_existing > 0 then
    raise exception '이미 활성 몬스터가 있습니다.';
  end if;

  select * into v_species from public.monster_species where id = v_species_id;

  insert into public.owned_monsters (user_id, species_id, level, exp, hp, atk, def, is_active)
  values (auth.uid(), v_species_id, 1, 0, v_species.base_hp, v_species.base_atk, v_species.base_def, true)
  returning * into v_row;

  insert into public.user_skills (user_id, skill_key, skill_level)
  values (auth.uid(), 'basic_strike', 1)
  on conflict (user_id, skill_key) do nothing;

  update public.profiles set equipped_skills = array['basic_strike'] where id = auth.uid();

  return v_row;
end;
$$ language plpgsql security definer;
