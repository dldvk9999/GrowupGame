-- ============================================
-- 040: 일반(비보스) 스테이지 몬스터 1.8배 상향, stages.js와 calc_stage_gold 동기화
-- 실측 결과 보스 대비 일반 몹이 상대적으로 너무 쉬워서(예: lv119·3차전직·신화4강 장비 기준
-- 32-3 잡몹이 스킬 1방에 4타면 끝나고 받는 피해도 미미함) 보스는 그대로 두고 일반 몹 hp/atk/def만
-- 1.8배 추가 상향함. 골드 보상은 hp 기준이라 자연히 같이 오름(최댓값 검증: 챕터100 최고 일반스테이지
-- 기준 약 18.5만 골드로 add_gold 상한 1,000,000 이내라 상한 변경 불필요).
-- ============================================

create or replace function public.calc_stage_gold(p_chapter integer, p_stage integer)
returns integer as $$
declare
  v_index integer := (p_chapter - 1) * 10 + p_stage;
  v_is_boss boolean := (p_stage = 10);
  v_chapter_step numeric := 1 + (p_chapter - 1) * 0.05;
  v_mid_chapter_step numeric := case when p_stage >= 5 then 1.15 else 1 end;
  v_normal_boost numeric := case when v_is_boss then 1 else 1.8 end;
  v_step_multiplier numeric := v_chapter_step * v_mid_chapter_step * v_normal_boost;
  v_hp numeric := round((30 + v_index * 7.5 * (case when v_is_boss then 3.0 else 1 end)) * v_step_multiplier);
begin
  return round((round(v_hp * (case when v_is_boss then 0.9 else 0.4 end)) + p_stage * 2) * 5);
end;
$$ language plpgsql immutable;
