-- ============================================
-- 162: 봉인의 상점(Seal Shop) 신설 - 신규 콘텐츠(159의 "알려진 제한"에서 예고했던 후속)
--
-- 159(봉인된 던전)의 파편이 랭킹/업적 말고는 쓸 곳이 없다는 걸 스스로 문서에 남겨뒀던
-- 부분을 해소함 - 파편 전용 코스튬 4종(슬롯당 1개, "봉인" 테마)을 신설하되, 기존
-- pvp_costume_inventory("PvP 코스튬 20종 전부 수집" 업적의 모수)와는 **완전히 분리된
-- 별도 테이블**로 설계함. 같은 테이블에 섞어 넣으면 그 업적의 "20종"이라는 숫자 자체가
-- 조용히 깨져버리기 때문(설계 당시 이미 예상해서 sealed-dungeon.md에 남겨둔 주의사항).
--
-- 코스튬 표시 메타데이터(이름/색상/슬롯)도 기존 item_catalog/ITEM_CATALOG(장비 뽑기용
-- 20종 크로스곱)에 손대지 않고, 클라이언트의 별도 SEAL_COSTUME_CATALOG 상수로만 관리함
-- - item_catalog에 새 행을 추가하면 장비 뽑기 확률표/희귀도 체계까지 건드릴 위험이 있어
--   원천적으로 그 경로를 피함(item_catalog FK도 걸지 않음).
--
-- 골드는 여전히 전혀 관여하지 않음(159의 설계 원칙 유지) - 오직 파편만 소비.
-- ============================================

create table public.seal_costume_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_key text not null check (item_key in ('weapon_seal', 'armor_seal', 'gloves_seal', 'shoes_seal')),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_key)
);
alter table public.seal_costume_inventory enable row level security;
create policy "seal_costume_inventory는 본인만 조회" on public.seal_costume_inventory for select using (auth.uid() = user_id);
revoke insert, update, delete on public.seal_costume_inventory from authenticated;

/** 봉인의 상점에서 코스튬 구매 - 파편만 소비, 골드 무관. 슬롯당 고정가 150파편 */
create or replace function public.buy_seal_costume(p_item_key text)
returns table(remaining_fragments bigint) as $$
declare
  v_price constant integer := 150;
  v_fragments bigint;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_item_key not in ('weapon_seal', 'armor_seal', 'gloves_seal', 'shoes_seal') then
    raise exception '존재하지 않는 봉인 코스튬입니다.';
  end if;
  if exists (select 1 from public.seal_costume_inventory where user_id = auth.uid() and item_key = p_item_key) then
    raise exception '이미 보유한 코스튬입니다.';
  end if;

  update public.profiles set seal_fragments = seal_fragments - v_price
    where id = auth.uid() and seal_fragments >= v_price
    returning seal_fragments into v_fragments;

  if v_fragments is null then
    raise exception '봉인의 파편이 부족해요. (필요: %개)', v_price;
  end if;

  insert into public.seal_costume_inventory (user_id, item_key) values (auth.uid(), p_item_key);

  remaining_fragments := v_fragments;
  return next;
end;
$$ language plpgsql security definer;

/** 내 봉인 코스튬 보유 목록 */
create or replace function public.fetch_my_seal_costumes()
returns table(item_key text) as $$
begin
  if auth.uid() is null then
    return;
  end if;
  return query select sci.item_key from public.seal_costume_inventory sci where sci.user_id = auth.uid();
end;
$$ language plpgsql stable security definer;

-- set_costume_loadout(042) 재정의 - 보유 검증을 pvp_costume_inventory 뿐 아니라
-- seal_costume_inventory까지 함께 확인하도록 확장. 반환타입(void) 그대로라 DROP 불필요.
-- 슬롯당 1개 제한 로직은 그대로 유지(봉인 코스튬도 item_key가 슬롯_접미사 형태라
-- split_part(k, '_', 1) 판별이 동일하게 적용됨 - 'weapon_seal' -> 'weapon').
create or replace function public.set_costume_loadout(p_item_keys text[])
returns void as $$
declare
  v_owned_count integer;
  v_slot_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_item_keys is not null and array_length(p_item_keys, 1) is not null then
    select count(*) into v_owned_count from (
      select item_key from public.pvp_costume_inventory where user_id = auth.uid() and item_key = any(p_item_keys)
      union
      select item_key from public.seal_costume_inventory where user_id = auth.uid() and item_key = any(p_item_keys)
    ) owned;
    if v_owned_count <> array_length(p_item_keys, 1) then
      raise exception '보유하지 않은 코스튬이 포함되어 있습니다.';
    end if;

    select count(distinct split_part(k, '_', 1)) into v_slot_count from unnest(p_item_keys) k;
    if v_slot_count <> array_length(p_item_keys, 1) then
      raise exception '같은 슬롯에 코스튬을 2개 이상 착용할 수 없습니다.';
    end if;
  end if;

  update public.profiles set equipped_costumes = coalesce(p_item_keys, '{}') where id = auth.uid();
end;
$$ language plpgsql security definer;
