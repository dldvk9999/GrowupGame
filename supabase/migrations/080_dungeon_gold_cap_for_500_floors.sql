-- ============================================
-- 080: 던전 최고층 500층 상향(079)에 따라 calc_dungeon_gold에 100만 상한 클램프 추가
--
-- 079에서 최고층을 10->500으로 올렸는데, 기존 calc_dungeon_gold 공식엔 상한
-- 클램프가 없어서 시뮬레이션 결과 약 103층부터 add_gold의 100만 상한을 넘기기
-- 시작하고 500층에선 약 1230만까지 치솟음을 확인함. add_gold는 100만 초과 시
-- 예외를 던지므로, 클램프 없이 배포했다면 고층 클리어 시 골드 지급 자체가
-- 실패하는 치명적 버그가 발생했을 것 - 500층 상향 작업 중 재검증하다 발견해서
-- 즉시 함께 수정함.
-- 반환타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.calc_dungeon_gold(p_dungeon_type text, p_stage integer)
returns integer as $$
declare
  v_hp numeric := round(220 + power(p_stage, 1.6) * 185);
  v_raw numeric;
begin
  if p_dungeon_type = 'gold' then
    v_raw := v_hp * 3.2;
  else
    v_raw := v_hp * 0.6;
  end if;
  return least(1000000, round(v_raw));
end;
$$ language plpgsql immutable;
