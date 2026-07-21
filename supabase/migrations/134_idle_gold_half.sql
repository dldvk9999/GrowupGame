-- ============================================
-- 134: 자동사냥 골드 수급 절반 감소 - 사용자 요청
-- calc_idle_gold는 자동사냥(grant_idle_reward)뿐 아니라 오프라인 보상(claim_offline_gold_reward,
-- 이미 온라인 대비 50% 효율로 설계됨)의 기반값으로도 쓰이는 단일 진실 공급원이라,
-- 여기 하나만 고치면 두 경로 모두(그리고 주말보너스/황금몬스터/유물골드%/시즌이벤트처럼
-- 이 값 위에 배율을 얹는 다른 보너스들도) 비율 그대로 유지하며 일괄 절반 감소됨.
-- (참고: 자동사냥 "경험치"는 이미 이전 요청으로 절반 감소했음(stages.js) - 이번엔 "골드"만)
-- 반환타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.calc_idle_gold(p_chapter integer, p_player_level integer)
returns integer as $$
declare
  v_hp numeric := greatest(10, round(8 + p_chapter * 2.0 + p_player_level * 3.0));
begin
  return greatest(2, round(v_hp * 0.15) * 5 * 8 * 0.5);
end;
$$ language plpgsql immutable;
