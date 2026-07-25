-- ============================================
-- 141: 유물 보유효과 추가 + 등급별 강화 성장률 차등 - 사용자 요청
--
-- 1) 등급별 성장률 차등: 기존엔 레벨당 +3%로 균일했음(base*rarityMult만 등급별로 다르고
--    성장곡선은 동일) - 이제 성장률 자체도 등급이 높을수록 가팔라짐(노멀2%~신화9%).
--    rarityMult(기본배율)와 성장률(레벨당 증가폭)이 둘 다 커지므로, 만렙(200강) 기준
--    최상급-최하급 격차가 기존보다 훨씬 커짐(사용자 요청: "높은 등급일수록 강화 시 상승 갭↑").
-- 2) 보유효과 신설: 유물도 장비/스킬처럼 "장착 안 해도" 보유만으로 약한 효과를 주도록 변경
--    (장착효과의 10%) - 장착개수 제한(5개, 131)이 여전히 메인 안전장치.
--
-- 클라이언트(relicCatalog.js RELIC_GROWTH_RATE/RELIC_POSSESSION_RATIO, relicBonus.js)와
-- 반드시 동일한 값을 유지할 것. 반환타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.calc_relic_bonus(p_user_id uuid)
returns table(bonus_atk integer, bonus_def integer, bonus_hp integer, pct_atk numeric, pct_def numeric, pct_hp numeric, pct_gold numeric) as $$
declare
  v_atk integer := 0;
  v_def integer := 0;
  v_hp integer := 0;
  v_pct_atk numeric := 0;
  v_pct_def numeric := 0;
  v_pct_hp numeric := 0;
  v_pct_gold numeric := 0;
  v_row record;
  v_growth_rate numeric;
  v_effective numeric;
  v_possession numeric;
begin
  for v_row in
    select rc.effect_category, rc.effect_mode, rc.base_value, rc.rarity_mult, rc.rarity_order, ur.level, ur.equipped
    from public.user_relics ur
    join public.relic_catalog rc on rc.relic_key = ur.relic_key
    where ur.user_id = p_user_id
  loop
    v_growth_rate := case v_row.rarity_order
      when 1 then 0.02 when 2 then 0.03 when 3 then 0.045 when 4 then 0.065 when 5 then 0.09 else 0.03
    end;
    v_effective := v_row.base_value * v_row.rarity_mult * (1 + v_row.level * v_growth_rate);
    -- 보유효과(장착 여부 무관, 전액의 10%) + 장착 중이면 전액 추가
    v_possession := v_effective * 0.10;
    v_effective := v_possession + (case when v_row.equipped then v_effective else 0 end);

    if v_row.effect_category = 'atk' and v_row.effect_mode = 'flat' then
      v_atk := v_atk + round(v_effective);
    elsif v_row.effect_category = 'atk' and v_row.effect_mode = 'percent' then
      v_pct_atk := v_pct_atk + v_effective;
    elsif v_row.effect_category = 'def' and v_row.effect_mode = 'flat' then
      v_def := v_def + round(v_effective);
    elsif v_row.effect_category = 'def' and v_row.effect_mode = 'percent' then
      v_pct_def := v_pct_def + v_effective;
    elsif v_row.effect_category = 'hp' and v_row.effect_mode = 'flat' then
      v_hp := v_hp + round(v_effective);
    elsif v_row.effect_category = 'hp' and v_row.effect_mode = 'percent' then
      v_pct_hp := v_pct_hp + v_effective;
    elsif v_row.effect_category = 'gold' and v_row.effect_mode = 'percent' then
      v_pct_gold := v_pct_gold + v_effective;
    end if;
    -- cooldown/exp/buff는 서버 계산 대상이 아니므로 여기서 집계 안 함(클라이언트 전용)
  end loop;

  return query select v_atk, v_def, v_hp, v_pct_atk, v_pct_def, v_pct_hp, v_pct_gold;
end;
$$ language plpgsql stable security definer;
