-- ============================================
-- 003: 인벤토리(아이템) 테이블 + 골드 증감 RPC
-- Supabase SQL Editor에 그대로 붙여넣고 실행
-- (stage_progress, profiles.gold는 001에 이미 있어서 스키마 변경 불필요)
-- ============================================

-- 1. 유저 인벤토리 테이블
create table public.user_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_key text not null,       -- 예: 'weapon_epic' (itemCatalog.js의 itemKey와 동일)
  slot text not null check (slot in ('weapon', 'armor', 'gloves', 'shoes')),
  equipped boolean not null default false,
  acquired_at timestamptz not null default now()
);

create index user_inventory_user_idx on public.user_inventory(user_id);

-- 슬롯당 장착 아이템 1개만 허용
create unique index user_inventory_one_equipped_per_slot
  on public.user_inventory (user_id, slot)
  where equipped;

alter table public.user_inventory enable row level security;

create policy "user_inventory는 본인만 조회"
  on public.user_inventory for select
  using (auth.uid() = user_id);

create policy "user_inventory는 본인만 생성"
  on public.user_inventory for insert
  with check (auth.uid() = user_id);

create policy "user_inventory는 본인만 수정"
  on public.user_inventory for update
  using (auth.uid() = user_id);

-- 2. 골드 지급 (몬스터 처치 보상). 원자적 증가.
create or replace function public.add_gold(target_user uuid, amount integer)
returns void as $$
begin
  if auth.uid() <> target_user then
    raise exception 'not authorized';
  end if;
  update public.profiles set gold = gold + amount where id = target_user;
end;
$$ language plpgsql security definer;

-- 3. 골드 차감 (상점 구매). 잔액 부족하면 false 반환, 성공하면 true.
create or replace function public.spend_gold(target_user uuid, amount integer)
returns boolean as $$
declare
  current_gold integer;
begin
  if auth.uid() <> target_user then
    raise exception 'not authorized';
  end if;

  select gold into current_gold from public.profiles where id = target_user for update;

  if current_gold is null or current_gold < amount then
    return false;
  end if;

  update public.profiles set gold = gold - amount where id = target_user;
  return true;
end;
$$ language plpgsql security definer;
