-- ============================================
-- 023: PvP 시스템 (비동기 매칭전투 + 전용재화 + 코스튬 상점)
-- 로비 채팅은 이미 001/004에 chat_messages 테이블+사칭방지 트리거가 있어서 스키마 변경 불필요.
-- Supabase SQL Editor에 순서대로 실행 (001~022 먼저 적용되어 있어야 함)
-- ============================================

-- ============================================
-- 1. PvP 재화/전적/쿨다운 컬럼
-- ============================================
alter table public.profiles add column pvp_currency integer not null default 0;
alter table public.profiles add column pvp_wins integer not null default 0;
alter table public.profiles add column pvp_losses integer not null default 0;
alter table public.profiles add column last_pvp_battle_at timestamptz;

-- ============================================
-- 2. 몬스터 실제 최대스탯 계산 헬퍼
-- ============================================
create or replace function public.calc_monster_stats(p_species_id integer, p_level integer, p_unlocked_job_tier integer)
returns table(max_hp integer, atk integer, def integer) as $$
declare
  v_species record;
  v_growth numeric;
  v_job_mult numeric;
begin
  select * into v_species from public.monster_species where id = p_species_id;
  v_growth := 1 + (p_level - 1) * 0.12;
  v_job_mult := case coalesce(p_unlocked_job_tier, 0)
    when 1 then 2.0 when 2 then 3.5 when 3 then 6.0 when 4 then 10.0 else 1.0
  end;
  max_hp := round(v_species.base_hp * v_growth * v_job_mult);
  atk := round(v_species.base_atk * v_growth * v_job_mult);
  def := round(v_species.base_def * v_growth * v_job_mult);
  return next;
end;
$$ language plpgsql stable;

create or replace function public.calc_combat_power(p_atk integer, p_def integer, p_max_hp integer)
returns integer as $$
begin
  return round(p_atk * 4.5 + p_def * 3.2 + p_max_hp * 0.6);
end;
$$ language sql immutable;

-- ============================================
-- 3. PvP 전투
-- ============================================
create table public.pvp_battle_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  opponent_user_id uuid references public.profiles(id) on delete set null,
  opponent_name text not null,
  opponent_is_real boolean not null,
  my_power integer not null,
  opponent_power integer not null,
  result text not null check (result in ('win', 'lose')),
  reward integer not null default 0,
  created_at timestamptz not null default now()
);
create index pvp_battle_log_user_idx on public.pvp_battle_log(user_id, created_at desc);

alter table public.pvp_battle_log enable row level security;
create policy "pvp_battle_log는 본인만 조회" on public.pvp_battle_log for select using (auth.uid() = user_id);
revoke insert, update, delete on public.pvp_battle_log from authenticated;

create or replace function public.start_pvp_battle()
returns table(
  result text, opponent_name text, opponent_is_real boolean,
  my_power integer, opponent_power integer, reward integer, currency_balance integer
) as $$
declare
  v_my_monster record;
  v_my_stats record;
  v_my_power integer;
  v_last_battle timestamptz;
  v_opp_row record;
  v_opp_stats record;
  v_opp_power integer;
  v_opp_name text;
  v_opp_is_real boolean;
  v_opp_user_id uuid;
  v_my_roll numeric;
  v_opp_roll numeric;
  v_result text;
  v_reward integer;
  v_synthetic_names text[] := array['그림자 전사', '환영의 검사', '유령 기사', '미지의 도전자', '수련용 인형', '떠돌이 검객', '가면의 결투가'];
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select last_pvp_battle_at into v_last_battle from public.profiles where id = auth.uid();
  if v_last_battle is not null and now() - v_last_battle < interval '20 seconds' then
    raise exception '너무 빠릅니다. 잠시 후 다시 시도해주세요.';
  end if;

  select * into v_my_monster from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_my_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  select * into v_my_stats from public.calc_monster_stats(v_my_monster.species_id, v_my_monster.level, v_my_monster.unlocked_job_tier);
  v_my_power := public.calc_combat_power(v_my_stats.atk, v_my_stats.def, v_my_stats.max_hp);

  select om.user_id, om.species_id, om.level, om.unlocked_job_tier, p.nickname
    into v_opp_row
  from public.owned_monsters om
  join public.profiles p on p.id = om.user_id
  where om.is_active = true and om.user_id <> auth.uid()
  order by random()
  limit 1;

  if v_opp_row.user_id is not null then
    select * into v_opp_stats from public.calc_monster_stats(v_opp_row.species_id, v_opp_row.level, v_opp_row.unlocked_job_tier);
    v_opp_power := public.calc_combat_power(v_opp_stats.atk, v_opp_stats.def, v_opp_stats.max_hp);
    if v_opp_power < v_my_power * 0.75 or v_opp_power > v_my_power * 1.25 then
      v_opp_row := null;
    end if;
  end if;

  if v_opp_row.user_id is null then
    v_opp_power := round(v_my_power * (0.9 + random() * 0.2));
    v_opp_name := v_synthetic_names[1 + floor(random() * array_length(v_synthetic_names, 1))::int];
    v_opp_is_real := false;
    v_opp_user_id := null;
  else
    v_opp_name := coalesce(v_opp_row.nickname, '익명의 도전자');
    v_opp_is_real := true;
    v_opp_user_id := v_opp_row.user_id;
  end if;

  v_my_roll := v_my_power * (0.85 + random() * 0.3);
  v_opp_roll := v_opp_power * (0.85 + random() * 0.3);

  if v_my_roll >= v_opp_roll then
    v_result := 'win';
    v_reward := greatest(30, round(30 + v_opp_power / 50.0));
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_wins = pvp_wins + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  else
    v_result := 'lose';
    v_reward := 0;
    update public.profiles
      set pvp_losses = pvp_losses + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  end if;

  insert into public.pvp_battle_log (user_id, opponent_user_id, opponent_name, opponent_is_real, my_power, opponent_power, result, reward)
  values (auth.uid(), v_opp_user_id, v_opp_name, v_opp_is_real, v_my_power, v_opp_power, v_result, v_reward);

  return query select v_result, v_opp_name, v_opp_is_real, v_my_power, v_opp_power, v_reward,
    (select pvp_currency from public.profiles where id = auth.uid());
end;
$$ language plpgsql security definer;

create or replace function public.fetch_my_combat_power()
returns integer as $$
declare
  v_monster record;
  v_stats record;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  select * into v_monster from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_monster is null then return 0; end if;
  select * into v_stats from public.calc_monster_stats(v_monster.species_id, v_monster.level, v_monster.unlocked_job_tier);
  return public.calc_combat_power(v_stats.atk, v_stats.def, v_stats.max_hp);
end;
$$ language plpgsql stable security definer;

-- ============================================
-- 4. PvP 상점 - 30개 랜덤 코스튬, 1시간마다 갱신 (전체 유저 공용 진열대)
-- ============================================
create table public.pvp_shop_listings (
  id uuid primary key default gen_random_uuid(),
  period_key text not null,
  slot_index integer not null,
  item_key text not null references public.item_catalog(item_key),
  price integer not null,
  unique (period_key, slot_index)
);
create index pvp_shop_listings_period_idx on public.pvp_shop_listings(period_key);

alter table public.pvp_shop_listings enable row level security;
create policy "pvp_shop_listings는 누구나 조회 가능" on public.pvp_shop_listings for select using (true);
revoke insert, update, delete on public.pvp_shop_listings from authenticated;

create table public.pvp_costume_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_key text not null references public.item_catalog(item_key),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

alter table public.pvp_costume_inventory enable row level security;
create policy "pvp_costume_inventory는 본인만 조회" on public.pvp_costume_inventory for select using (auth.uid() = user_id);
revoke insert, update, delete on public.pvp_costume_inventory from authenticated;

create or replace function public.sync_pvp_shop()
returns void as $$
declare
  v_period text := to_char(date_trunc('hour', now()), 'YYYYMMDDHH24');
  v_exists integer;
  v_slots text[] := array['weapon', 'armor', 'gloves', 'shoes'];
  v_rarities text[] := array['normal', 'rare', 'epic', 'legendary', 'mythic'];
  v_base_price integer[] := array[3000, 8000, 20000, 55000, 150000];
  i integer;
  v_roll numeric;
  v_rarity_idx integer;
  v_slot text;
  v_item_key text;
  v_price integer;
begin
  select count(*) into v_exists from public.pvp_shop_listings where period_key = v_period;
  if v_exists > 0 then
    return;
  end if;

  for i in 1..30 loop
    v_roll := random();
    if v_roll < 0.40 then v_rarity_idx := 1;
    elsif v_roll < 0.68 then v_rarity_idx := 2;
    elsif v_roll < 0.86 then v_rarity_idx := 3;
    elsif v_roll < 0.96 then v_rarity_idx := 4;
    else v_rarity_idx := 5;
    end if;

    v_slot := v_slots[1 + floor(random() * 4)::int];
    v_item_key := v_slot || '_' || v_rarities[v_rarity_idx];
    v_price := v_base_price[v_rarity_idx] + floor(random() * v_base_price[v_rarity_idx] * 0.2)::int;

    insert into public.pvp_shop_listings (period_key, slot_index, item_key, price)
    values (v_period, i, v_item_key, v_price)
    on conflict on constraint pvp_shop_listings_period_key_slot_index_key do nothing;
  end loop;
end;
$$ language plpgsql security definer;

create or replace function public.buy_pvp_costume(p_listing_id uuid)
returns void as $$
declare
  v_listing public.pvp_shop_listings;
  v_currency integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_listing from public.pvp_shop_listings where id = p_listing_id;
  if v_listing is null then
    raise exception '판매 중인 상품이 아닙니다.';
  end if;

  select pvp_currency into v_currency from public.profiles where id = auth.uid() for update;
  if v_currency is null or v_currency < v_listing.price then
    raise exception 'PvP 재화가 부족합니다.';
  end if;

  if exists (select 1 from public.pvp_costume_inventory where user_id = auth.uid() and item_key = v_listing.item_key) then
    raise exception '이미 보유한 코스튬입니다.';
  end if;

  update public.profiles set pvp_currency = pvp_currency - v_listing.price where id = auth.uid();
  insert into public.pvp_costume_inventory (user_id, item_key) values (auth.uid(), v_listing.item_key);
end;
$$ language plpgsql security definer;
