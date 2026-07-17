-- ============================================
-- 057: 장비 세트 효과 - 4슬롯(무기/방어구/장갑/신발)을 전부 장착하고 등급이 모두 같으면
-- 최종 장착 보너스에 +5%를 추가로 얹어줌(예: 신화 4종 풀세트). 등급이 하나라도 다르거나
-- 4슬롯 중 하나라도 비어있으면 세트 보너스 없음. 클라이언트 lib/inventory.js의
-- sumEquippedBonus/isFullSetEquipped와 동일한 로직을 SQL로 포팅해서, PvP/랭킹/
-- fetch_my_combat_power 전투력 계산에도 세트효과가 정확히 반영되게 함.
-- 반환 컬럼 구성은 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.calc_equipped_stat_bonus(p_user_id uuid)
returns table(bonus_atk integer, bonus_def integer, bonus_hp integer) as $$
declare
  v_atk integer := 0;
  v_def integer := 0;
  v_hp integer := 0;
  v_row record;
  v_slot_base integer;
  v_rarity_mult numeric;
  v_enhanced integer;
  v_distinct_rarities integer;
  v_equipped_slot_count integer;
begin
  for v_row in
    select item_key, slot, enhance_level from public.user_inventory
    where user_id = p_user_id and equipped = true
  loop
    v_slot_base := case v_row.slot
      when 'weapon' then 6 when 'armor' then 6 when 'gloves' then 3 when 'shoes' then 18 else 0
    end;
    v_rarity_mult := case split_part(v_row.item_key, '_', 2)
      when 'normal' then 1 when 'rare' then 1.8 when 'epic' then 2.8
      when 'legendary' then 4.2 when 'mythic' then 6.5 else 1
    end;
    v_enhanced := round(round(v_slot_base * v_rarity_mult) * (1 + v_row.enhance_level * 0.08));
    if v_row.slot in ('weapon', 'gloves') then
      v_atk := v_atk + v_enhanced;
    elsif v_row.slot = 'armor' then
      v_def := v_def + v_enhanced;
    elsif v_row.slot = 'shoes' then
      v_hp := v_hp + v_enhanced;
    end if;
  end loop;

  -- 세트 효과 판정: 4슬롯 전부 장착 + 등급(item_key의 '_' 뒤 부분)이 전부 동일한지
  select count(distinct slot), count(distinct split_part(item_key, '_', 2))
    into v_equipped_slot_count, v_distinct_rarities
  from public.user_inventory
  where user_id = p_user_id and equipped = true;

  if v_equipped_slot_count = 4 and v_distinct_rarities = 1 then
    v_atk := round(v_atk * 1.05);
    v_def := round(v_def * 1.05);
    v_hp := round(v_hp * 1.05);
  end if;

  return query select v_atk, v_def, v_hp;
end;
$$ language plpgsql stable;
