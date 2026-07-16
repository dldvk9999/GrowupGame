-- ============================================
-- 028: 장비 일괄합성 RPC
-- Supabase SQL Editor에 순서대로 실행 (001~027 먼저 적용되어 있어야 함)
-- ============================================

create or replace function public.synthesize_equipment_batch(p_item_key text)
returns table(target_item_key text, target_new_level integer, source_remaining_level integer, times integer) as $$
declare
  v_slot text;
  v_rarity_order integer;
  v_next_key text;
  v_source_level integer;
  v_target_level integer;
  v_times integer := 0;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select ic.slot, ic.rarity_order into v_slot, v_rarity_order
    from public.item_catalog ic where ic.item_key = p_item_key;
  if v_slot is null then
    raise exception '유효하지 않은 아이템입니다.';
  end if;
  if v_rarity_order >= 5 then
    raise exception '신화 등급은 더 합성할 수 없습니다.';
  end if;

  select ic.item_key into v_next_key
    from public.item_catalog ic where ic.slot = v_slot and ic.rarity_order = v_rarity_order + 1;
  if v_next_key is null then
    raise exception '합성 가능한 상위 등급이 없습니다.';
  end if;

  select ui.enhance_level into v_source_level
    from public.user_inventory ui where ui.user_id = auth.uid() and ui.item_key = p_item_key;
  if v_source_level is null or v_source_level < 10 then
    raise exception '합성 재료가 부족합니다. (강화수치 10 이상 필요)';
  end if;

  select ui.enhance_level into v_target_level
    from public.user_inventory ui where ui.user_id = auth.uid() and ui.item_key = v_next_key;
  if v_target_level is null then
    insert into public.user_inventory (user_id, item_key, slot, equipped, enhance_level)
    values (auth.uid(), v_next_key, v_slot, false, 0);
    v_target_level := 0;
  end if;

  while v_source_level >= 10 and v_target_level < 1000 loop
    v_source_level := v_source_level - 10;
    v_target_level := v_target_level + 1;
    v_times := v_times + 1;
  end loop;

  update public.user_inventory ui set enhance_level = v_source_level
    where ui.user_id = auth.uid() and ui.item_key = p_item_key;
  update public.user_inventory ui set enhance_level = v_target_level
    where ui.user_id = auth.uid() and ui.item_key = v_next_key;

  return query select v_next_key, v_target_level, v_source_level, v_times;
end;
$$ language plpgsql security definer;
