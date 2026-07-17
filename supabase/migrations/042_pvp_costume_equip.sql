-- ============================================
-- 042: PvP 코스튬 착용 시스템
-- 지금까지 코스튬은 pvp_costume_inventory에 보유 여부만 있고 "착용" 개념이 아예 없었음.
-- profiles.equipped_costumes(슬롯별 최대 1개, equipped_skills와 동일 패턴)를 신설하고
-- set_costume_loadout RPC로 서버 검증(본인이 실제로 보유한 코스튬인지, 슬롯당 1개인지)하며 변경.
-- ============================================

alter table public.profiles add column equipped_costumes text[] not null default '{}';

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
    -- 실제 보유한 코스튬인지 검증
    select count(*) into v_owned_count from public.pvp_costume_inventory
      where user_id = auth.uid() and item_key = any(p_item_keys);
    if v_owned_count <> array_length(p_item_keys, 1) then
      raise exception '보유하지 않은 코스튬이 포함되어 있습니다.';
    end if;

    -- 슬롯(무기/방어구/장갑/신발)당 최대 1개만 착용 가능 - item_key가 slot_rarity 형태라 slot 접두어로 판별
    select count(distinct split_part(k, '_', 1)) into v_slot_count from unnest(p_item_keys) k;
    if v_slot_count <> array_length(p_item_keys, 1) then
      raise exception '같은 슬롯에 코스튬을 2개 이상 착용할 수 없습니다.';
    end if;
  end if;

  update public.profiles set equipped_costumes = coalesce(p_item_keys, '{}') where id = auth.uid();
end;
$$ language plpgsql security definer;
