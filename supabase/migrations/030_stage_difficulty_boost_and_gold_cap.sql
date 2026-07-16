-- ============================================
-- 030: 스테이지 난이도 대폭 상향 (5/10스테이지마다 계단식 추가상승) + add_gold 상한 재상향
-- stages.js 변경사항을 calc_stage_gold에 그대로 반영
-- Supabase SQL Editor에 순서대로 실행 (001~029 먼저 적용되어 있어야 함)
-- ============================================

create or replace function public.calc_stage_gold(p_chapter integer, p_stage integer)
returns integer as $$
declare
  v_index integer := (p_chapter - 1) * 10 + p_stage;
  v_is_boss boolean := (p_stage = 10);
  v_chapter_step numeric := 1 + (p_chapter - 1) * 0.05;
  v_mid_chapter_step numeric := case when p_stage >= 5 then 1.15 else 1 end;
  v_step_multiplier numeric := v_chapter_step * v_mid_chapter_step;
  v_hp numeric := round((30 + v_index * 7.5 * (case when v_is_boss then 3.0 else 1 end)) * v_step_multiplier);
begin
  return round((round(v_hp * (case when v_is_boss then 0.9 else 0.4 end)) + p_stage * 2) * 5);
end;
$$ language plpgsql immutable;

-- 난이도 대폭 상향으로 최후반 챕터(100) 보스 골드가 기존 상한(400000)을 훌쩍 넘어서게 됨
-- (계산상 최대치 약 69만 골드) - 여유있게 재상향
create or replace function public.add_gold(target_user uuid, amount integer)
returns void as $$
begin
  if auth.uid() <> target_user then
    raise exception 'not authorized';
  end if;
  if amount < 0 or amount > 1000000 then
    raise exception 'invalid amount';
  end if;
  update public.profiles set gold = gold + amount where id = target_user;
end;
$$ language plpgsql security definer;
