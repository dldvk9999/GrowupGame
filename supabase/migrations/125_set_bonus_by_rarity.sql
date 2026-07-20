-- ============================================
-- 125: 세트 효과를 등급별로 차등 적용 - 신규 콘텐츠(사용자 요청)
-- 기존엔 4슬롯 풀세트면 등급 상관없이 항상 +5%였는데, 높은 등급일수록 세트 효과도
-- 더 크도록 변경: 노멀+3% / 레어+5% / 에픽+8% / 전설+12% / 신화+18%
-- (클라이언트 itemCatalog.js RARITIES.setBonus와 반드시 동일하게 유지할 것).
-- 반환타입 그대로라 DROP FUNCTION 불필요.
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
  v_set_rarity text;
  v_set_bonus_rate numeric;
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
  select count(distinct slot), count(distinct split_part(item_key, '_', 2)), min(split_part(item_key, '_', 2))
    into v_equipped_slot_count, v_distinct_rarities, v_set_rarity
  from public.user_inventory
  where user_id = p_user_id and equipped = true;

  if v_equipped_slot_count = 4 and v_distinct_rarities = 1 then
    v_set_bonus_rate := case v_set_rarity
      when 'normal' then 0.03 when 'rare' then 0.05 when 'epic' then 0.08
      when 'legendary' then 0.12 when 'mythic' then 0.18 else 0.05
    end;
    v_atk := round(v_atk * (1 + v_set_bonus_rate));
    v_def := round(v_def * (1 + v_set_bonus_rate));
    v_hp := round(v_hp * (1 + v_set_bonus_rate));
  end if;

  return query select v_atk, v_def, v_hp;
end;
$$ language plpgsql stable;
