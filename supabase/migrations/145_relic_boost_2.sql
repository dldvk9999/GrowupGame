-- ============================================
-- 145: 유물 능력치 대폭 추가 상향 - 사용자 재요청("비싼 돈을 쓰는 가치가 있게")
--
-- 141에서 이미 등급별 성장률 차등 + 보유효과(10%)를 넣었는데, 사용자가 체감상
-- 부족하다고 재요청함. 이번엔 세 가지를 동시에 더 올림:
--  1) 기본 배율(rarity_mult) 자체를 등급별로 훨씬 크게 재조정(장비와 공유하던 값을
--     분리 - 유물 전용으로 더 가파르게)
--  2) 등급별 성장률(레벨당 증가폭)을 한 단계 더 올림
--  3) 보유효과 비율을 10%->20%로 상향
--
-- 클라이언트(relicCatalog.js RELIC_GROWTH_RATE/RELIC_POSSESSION_RATIO, relicBonus.js)와
-- 반드시 동일한 값을 유지할 것.
-- ============================================

-- 1) 기본 배율 확대(장비와 공유하던 1/1.8/2.8/4.2/6.5 -> 유물 전용으로 더 가파르게).
-- ⚠️ 처음엔 신화 18배까지 잡았는데, percent 타입 유물은 이 배율이 성장률과 곱연산되어
-- 200강 기준 +475%까지 치솟는 걸 배포 전 시뮬레이션으로 확인해서(아래 calc_relic_bonus의
-- 주석 참고) 더 안전한 값(신화 10배)으로 재조정함 - 그래도 기존(6.5배)보다는 확실히 강함.
update public.relic_catalog set rarity_mult = case rarity_order
  when 1 then 1.0
  when 2 then 2.0
  when 3 then 3.6
  when 4 then 6.0
  when 5 then 10.0
end;

-- 2) 등급별 성장률 + 보유효과 비율(20%) 재조정
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
    -- ⚠️ [배포 전 자체 발견/수정] 처음엔 성장률도 한 단계 더 올리려 했는데(신화16%),
    -- percent 타입 유물(예: 공격력% 유물)에서 base_value*rarity_mult*(1+level*growth)가
    -- 곱연산으로 계산되다보니 200강 신화 하나가 +475%까지 치솟는 걸 배포 전 시뮬레이션으로
    -- 확인함 - 유물 하나로 전체 공격력이 5배 넘게 뛰는 건 명백한 밸런스 붕괴라 판단해서,
    -- 성장률은 141 수준(노멀2%~신화9%)으로 되돌리고 rarity_mult(기본배율)와 보유효과
    -- 비율(20%)만 상향된 값을 유지함 - flat 타입은 절대치라 위험이 적지만 percent 타입은
    -- 성장률이 조금만 커져도 곱연산 특성상 위험하게 불어남을 확인.
    v_growth_rate := case v_row.rarity_order
      when 1 then 0.02 when 2 then 0.03 when 3 then 0.045 when 4 then 0.065 when 5 then 0.09 else 0.03
    end;
    v_effective := v_row.base_value * v_row.rarity_mult * (1 + v_row.level * v_growth_rate);
    -- (수정) 보유효과 10% -> 20% 상향 + 장착 중이면 전액 추가
    v_possession := v_effective * 0.20;
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
  end loop;

  return query select v_atk, v_def, v_hp, v_pct_atk, v_pct_def, v_pct_hp, v_pct_gold;
end;
$$ language plpgsql stable security definer;
