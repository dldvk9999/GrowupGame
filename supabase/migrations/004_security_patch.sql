-- ============================================
-- 004: 보안 패치
-- 클라이언트가 테이블에 직접 write해서 골드/레벨/아이템을 조작할 수 있던
-- 구멍을 막음. 민감한 쓰기는 검증 로직이 들어간 RPC(SECURITY DEFINER)를
-- 통해서만 가능하도록 변경.
-- Supabase SQL Editor에 순서대로 실행
-- ============================================

-- ============================================
-- 1. profiles: gold는 client가 직접 못 바꾸게, nickname만 허용
-- ============================================
revoke update on public.profiles from authenticated;
grant update (nickname) on public.profiles to authenticated;

-- add_gold에 금액 상한 추가 (기존 함수 재정의)
create or replace function public.add_gold(target_user uuid, amount integer)
returns void as $$
begin
  if auth.uid() <> target_user then
    raise exception 'not authorized';
  end if;
  if amount < 0 or amount > 20000 then
    raise exception 'invalid amount';
  end if;
  update public.profiles set gold = gold + amount where id = target_user;
end;
$$ language plpgsql security definer;

-- ============================================
-- 2. owned_monsters: 클라이언트 직접 insert/update 차단, RPC로만 허용
-- ============================================
drop policy if exists "owned_monsters는 본인만 생성" on public.owned_monsters;
drop policy if exists "owned_monsters는 본인만 수정" on public.owned_monsters;
revoke insert, update on public.owned_monsters from authenticated;

-- 스타터 생성: 레벨1 고정, 지정된 3종만 허용, 이미 활성 몬스터 있으면 거부
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

  return v_row;
end;
$$ language plpgsql security definer;

-- 성장 결과 저장: 레벨 변화량/스탯 상한선/진화 경로를 서버에서 재검증
create or replace function public.save_monster_growth(
  p_owned_monster_id uuid, p_level integer, p_exp integer,
  p_hp integer, p_atk integer, p_def integer, p_species_id integer
) returns void as $$
declare
  v_owner uuid;
  v_old_level integer;
  v_old_species integer;
  v_species record;
  v_growth numeric;
  v_ceiling_hp integer;
  v_ceiling_atk integer;
  v_ceiling_def integer;
begin
  select user_id, level, species_id into v_owner, v_old_level, v_old_species
    from public.owned_monsters where id = p_owned_monster_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception '권한이 없습니다.';
  end if;

  if p_level < v_old_level or p_level > v_old_level + 50 then
    raise exception '레벨 변화량이 비정상적입니다.';
  end if;

  if p_species_id <> v_old_species then
    perform 1 from public.monster_species
      where id = v_old_species and evolves_to = p_species_id and evolve_level <= p_level;
    if not found then
      raise exception '유효하지 않은 진화입니다.';
    end if;
  end if;

  select * into v_species from public.monster_species where id = p_species_id;
  v_growth := 1 + (p_level - 1) * 0.12;
  -- 최대 전직 배율(1.9배)까지 감안한 넉넉한 상한선 (+5% 반올림 여유)
  v_ceiling_hp := ceil(v_species.base_hp * v_growth * 1.9 * 1.05);
  v_ceiling_atk := ceil(v_species.base_atk * v_growth * 1.9 * 1.05);
  v_ceiling_def := ceil(v_species.base_def * v_growth * 1.9 * 1.05);

  if p_hp < 0 or p_atk < 0 or p_def < 0
     or p_hp > v_ceiling_hp or p_atk > v_ceiling_atk or p_def > v_ceiling_def then
    raise exception '스탯 값이 비정상적입니다.';
  end if;

  update public.owned_monsters set
    level = p_level, exp = p_exp, hp = p_hp, atk = p_atk, def = p_def, species_id = p_species_id
  where id = p_owned_monster_id;
end;
$$ language plpgsql security definer;

-- ============================================
-- 3. stage_progress: 클라이언트 직접 insert/update 차단, RPC로만 허용
-- ============================================
drop policy if exists "stage_progress는 본인만 upsert" on public.stage_progress;
drop policy if exists "stage_progress는 본인만 수정" on public.stage_progress;
revoke insert, update on public.stage_progress from authenticated;

create or replace function public.clear_stage(p_stage_id integer)
returns void as $$
declare
  v_prev_cleared boolean;
  v_self_cleared boolean;
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
end;
$$ language plpgsql security definer;

-- ============================================
-- 4. user_inventory: 직접 insert 차단, update는 equipped 컬럼만 허용
--    + 아이템 가격/스탯을 서버 카탈로그 테이블 기준으로 검증 (클라이언트 값 불신)
-- ============================================
drop policy if exists "user_inventory는 본인만 생성" on public.user_inventory;
revoke insert on public.user_inventory from authenticated;
revoke update on public.user_inventory from authenticated;
grant update (equipped) on public.user_inventory to authenticated;

-- itemCatalog.js와 동일한 값의 서버측 카탈로그 (구매 검증용 단일 진실 공급원)
create table public.item_catalog (
  item_key text primary key,
  slot text not null check (slot in ('weapon', 'armor', 'gloves', 'shoes')),
  price integer not null
);

insert into public.item_catalog (item_key, slot, price) values
  ('weapon_normal', 'weapon', 80), ('weapon_rare', 'weapon', 300), ('weapon_epic', 'weapon', 1200), ('weapon_legendary', 'weapon', 5000), ('weapon_mythic', 'weapon', 20000),
  ('armor_normal', 'armor', 80), ('armor_rare', 'armor', 300), ('armor_epic', 'armor', 1200), ('armor_legendary', 'armor', 5000), ('armor_mythic', 'armor', 20000),
  ('gloves_normal', 'gloves', 40), ('gloves_rare', 'gloves', 150), ('gloves_epic', 'gloves', 600), ('gloves_legendary', 'gloves', 2500), ('gloves_mythic', 'gloves', 10000),
  ('shoes_normal', 'shoes', 240), ('shoes_rare', 'shoes', 900), ('shoes_epic', 'shoes', 3600), ('shoes_legendary', 'shoes', 15000), ('shoes_mythic', 'shoes', 60000);

alter table public.item_catalog enable row level security;
create policy "item_catalog는 누구나 조회 가능" on public.item_catalog for select using (true);

create or replace function public.buy_item(p_item_key text)
returns public.user_inventory as $$
declare
  v_item record;
  v_gold integer;
  v_row public.user_inventory;
begin
  select * into v_item from public.item_catalog where item_key = p_item_key;
  if v_item is null then
    raise exception '존재하지 않는 아이템입니다.';
  end if;

  select gold into v_gold from public.profiles where id = auth.uid() for update;
  if v_gold is null or v_gold < v_item.price then
    raise exception '골드가 부족합니다.';
  end if;

  update public.profiles set gold = gold - v_item.price where id = auth.uid();

  insert into public.user_inventory (user_id, item_key, slot, equipped)
  values (auth.uid(), v_item.item_key, v_item.slot, false)
  returning * into v_row;

  return v_row;
end;
$$ language plpgsql security definer;

-- ============================================
-- 5. chat_messages: 닉네임 위조(사칭) 방지 - 서버에서 실제 닉네임으로 덮어씀
-- ============================================
create or replace function public.set_chat_nickname()
returns trigger as $$
begin
  select nickname into new.nickname from public.profiles where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists chat_nickname_guard on public.chat_messages;
create trigger chat_nickname_guard
  before insert on public.chat_messages
  for each row execute function public.set_chat_nickname();
