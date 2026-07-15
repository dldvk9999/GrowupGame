-- ============================================
-- 012: 난이도 재상향 + 자동사냥 레벨연동 강화에 맞춰 서버측 골드 공식 동기화
-- (stages.js / dungeonStages.js 변경사항을 calc_*_gold 함수에 그대로 반영)
-- Supabase SQL Editor에 순서대로 실행 (001~011 먼저 적용되어 있어야 함)
-- ============================================

-- 1. 스테이지 골드 - 난이도 상향된 hp 공식 반영
create or replace function public.calc_stage_gold(p_chapter integer, p_stage integer)
returns integer as $$
declare
  v_index integer := (p_chapter - 1) * 10 + p_stage;
  v_is_boss boolean := (p_stage = 10);
  v_chapter_step numeric := 1 + (p_chapter - 1) * 0.04;
  v_hp numeric := round(30 + v_index * 5.0 * (case when v_is_boss then 2.4 else 1 end) * v_chapter_step);
begin
  return round((round(v_hp * (case when v_is_boss then 0.9 else 0.4 end)) + p_stage * 2) * 5);
end;
$$ language plpgsql immutable;

-- 2. 자동사냥 골드 - 챕터/레벨 가중치 상향된 공식 반영
create or replace function public.calc_idle_gold(p_chapter integer, p_player_level integer)
returns integer as $$
declare
  v_hp numeric := greatest(10, round(8 + p_chapter * 2.0 + p_player_level * 3.0));
begin
  return greatest(5, round(v_hp * 0.15) * 5 * 8);
end;
$$ language plpgsql immutable;

-- 3. 일반 던전(경험치/골드) 보스 골드 - 난이도 상향된 hp 공식 반영
create or replace function public.calc_dungeon_gold(p_dungeon_type text, p_stage integer)
returns integer as $$
declare
  v_hp numeric := round(220 + power(p_stage, 1.6) * 185);
begin
  if p_dungeon_type = 'gold' then
    return round(v_hp * 3.2);
  else
    return round(v_hp * 0.6);
  end if;
end;
$$ language plpgsql immutable;

-- 4. 난이도 상향으로 최후반 챕터(100) 보스 골드 보상이 기존 상한(100000)을 넘어설 수 있어
--    add_gold 1회 상한을 넉넉하게 재상향
create or replace function public.add_gold(target_user uuid, amount integer)
returns void as $$
begin
  if auth.uid() <> target_user then
    raise exception 'not authorized';
  end if;
  if amount < 0 or amount > 400000 then
    raise exception 'invalid amount';
  end if;
  update public.profiles set gold = gold + amount where id = target_user;
end;
$$ language plpgsql security definer;
