-- ============================================
-- 133: 스테이지 클리어 난이도 대폭 상향(체력/방어력) - 사용자 요청
-- 클라이언트(stages.js)의 몬스터 체력 계수를 7.5->11.0(보스 3.0->3.6)로 올렸는데,
-- calc_stage_gold(040)가 정확히 같은 체력 공식을 그대로 복사해서 골드 보상을
-- 계산하고 있어서(040의 NORMAL_MONSTER_BOOST 때도 동일하게 동기화했던 전례),
-- 여기도 안 고치면 몬스터는 더 강해졌는데 골드 보상은 예전 그대로인 불일치가 생김.
-- 방어력 계수 변경은 골드 계산에 안 쓰여서 여긴 안 건드림.
-- 반환타입 그대로라 DROP FUNCTION 불필요.
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
  v_hp numeric := round((30 + v_index * 11.0 * (case when v_is_boss then 3.6 else 1 end)) * v_step_multiplier);
begin
  return round((round(v_hp * (case when v_is_boss then 0.9 else 0.4 end)) + p_stage * 2) * 5);
end;
$$ language plpgsql immutable;

-- ⚠️ [예방적 발견/수정] clear_stage의 골드 클램프가 "정예(2배)" 분기에만 걸려있고
-- 평상시(v_is_elite=false, 92%) 경로엔 최종 클램프가 아예 없었음. calc_stage_gold의
-- 체력 계수를 올린 이번 변경으로 최후반 챕터(100)/스테이지10 보스 골드가 약 122만까지
-- 치솟아 add_gold의 100만 상한을 초과 -> "가장 어려운 마지막 보스를 깨면 오히려
-- 크래시로 보상을 못 받는" 심각한 회귀가 날 뻔했음(117/118/121과 같은 클래스의 함정,
-- 배포 전 시뮬레이션 검증 중 발견). 정예 여부와 무관하게 무조건 한 번 더 클램프.
-- 반환타입 그대로라 DROP FUNCTION 불필요.

create or replace function public.clear_stage(p_stage_id integer)
returns table(gold integer, is_elite boolean) as $$
declare
  v_prev_cleared boolean;
  v_self_cleared boolean;
  v_chapter integer;
  v_stage integer;
  v_gold integer;
  v_first_clear boolean;
  v_chapter_bonus integer;
  v_is_elite boolean;
begin
  if p_stage_id < 1 or p_stage_id > 1000 then
    raise exception '유효하지 않은 스테이지입니다.';
  end if;

  if p_stage_id > 1 then
    select cleared into v_prev_cleared from public.stage_progress
      where user_id = auth.uid() and stage_id = p_stage_id - 1;
    select cleared into v_self_cleared from public.stage_progress
      where user_id = auth.uid() and stage_id = p_stage_id;
    if coalesce(v_prev_cleared, false) = false and coalesce(v_self_cleared, false) = false then
      raise exception '아직 열리지 않은 스테이지입니다.';
    end if;
  end if;

  select coalesce(cleared, false) into v_self_cleared from public.stage_progress
    where user_id = auth.uid() and stage_id = p_stage_id;
  v_first_clear := coalesce(v_self_cleared, false) = false;

  insert into public.stage_progress (user_id, stage_id, cleared, cleared_at)
  values (auth.uid(), p_stage_id, true, now())
  on conflict (user_id, stage_id) do update set cleared = true, cleared_at = now();

  v_chapter := ((p_stage_id - 1) / 10) + 1;
  v_stage := ((p_stage_id - 1) % 10) + 1;

  v_is_elite := random() < 0.08;
  v_gold := public.calc_stage_gold(v_chapter, v_stage);
  if v_is_elite then
    v_gold := v_gold * 2;
  end if;
  -- 정예 여부와 무관하게 마지막에 한 번 더 무조건 클램프(위 설명 참고)
  v_gold := least(1000000, v_gold);

  perform public.add_gold(auth.uid(), v_gold);

  if v_stage = 10 and v_first_clear then
    v_chapter_bonus := v_chapter * 5000;
    insert into public.mails (user_id, title, body, gold_amount, item_key, source_key)
    values (
      auth.uid(),
      '🎉 챕터 ' || v_chapter || ' 클리어 축하!',
      '수호자를 처치하고 챕터를 클리어했어요! 다음 챕터도 화이팅!',
      v_chapter_bonus,
      null,
      'chapter_clear_' || v_chapter
    )
    on conflict (user_id, source_key) do nothing;
  end if;

  return query select v_gold, v_is_elite;
end;
$$ language plpgsql security definer;

-- ============================================
-- 유물 100회뽑기가 다른 뽑기보다 눈에 띄게 오래 걸리던 문제 수정(사용자 제보) -
-- 원인: 장비/스킬 뽑기는 draw_equipment_batch/draw_skill_batch처럼 "N회를 서버
-- 안에서 반복문 한 번에 처리하고 결과를 한꺼번에 반환"하는 배치 RPC가 있는데,
-- 유물만 그게 없어서 클라이언트(drawRelicBatch)가 draw_relic()을 100번 각각
-- 순차 await로 호출했음 - 매 호출마다 왕복 네트워크 레이턴시가 그대로 누적되는 구조라
-- 100회면 다른 뽑기보다 훨씬 느림. draw_equipment_batch와 동일한 "반복문+return next"
-- 패턴으로 draw_relic_batch를 신설해서 한 번의 요청으로 끝나게 함.
-- ============================================

create or replace function public.draw_relic_batch(p_count integer)
returns table(
  relic_key text, rarity text, was_duplicate boolean, enhance_attempted boolean,
  enhance_success boolean, new_level integer, cost integer, draw_level integer
) as $$
declare
  v_i integer;
  v_draws integer;
  v_draw_level integer;
  v_cost integer;
  v_gold integer;
  v_roll numeric;
  v_rarity_order integer;
  v_rarity_name text;
  v_picked_key text;
  v_existing_level integer;
  v_final_level integer;
  v_was_dup boolean;
  v_attempted boolean;
  v_success boolean;
  v_success_chance numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_count < 1 or p_count > 100 then
    raise exception '유효하지 않은 횟수입니다.';
  end if;

  for v_i in 1..p_count loop
    v_attempted := false;
    v_success := false;

    select p.total_relic_draws into v_draws from public.profiles p where p.id = auth.uid();
    v_draw_level := least(50, 1 + v_draws / 1000);
    v_cost := 1000 + (v_draw_level - 1) * 300;

    select p.gold into v_gold from public.profiles p where p.id = auth.uid() for update;
    if v_gold is null or v_gold < v_cost then
      exit;
    end if;

    v_roll := random();
    if v_draw_level <= 8 then
      if v_roll < 0.70 then v_rarity_order := 1; elsif v_roll < 0.95 then v_rarity_order := 2; else v_rarity_order := 3; end if;
    elsif v_draw_level <= 18 then
      if v_roll < 0.50 then v_rarity_order := 1; elsif v_roll < 0.82 then v_rarity_order := 2; elsif v_roll < 0.97 then v_rarity_order := 3; else v_rarity_order := 4; end if;
    elsif v_draw_level <= 28 then
      if v_roll < 0.32 then v_rarity_order := 1; elsif v_roll < 0.65 then v_rarity_order := 2; elsif v_roll < 0.90 then v_rarity_order := 3; elsif v_roll < 0.99 then v_rarity_order := 4; else v_rarity_order := 5; end if;
    elsif v_draw_level <= 38 then
      if v_roll < 0.18 then v_rarity_order := 1; elsif v_roll < 0.45 then v_rarity_order := 2; elsif v_roll < 0.75 then v_rarity_order := 3; elsif v_roll < 0.95 then v_rarity_order := 4; else v_rarity_order := 5; end if;
    elsif v_draw_level <= 48 then
      if v_roll < 0.08 then v_rarity_order := 1; elsif v_roll < 0.25 then v_rarity_order := 2; elsif v_roll < 0.55 then v_rarity_order := 3; elsif v_roll < 0.87 then v_rarity_order := 4; else v_rarity_order := 5; end if;
    else
      if v_roll < 0.03 then v_rarity_order := 1; elsif v_roll < 0.13 then v_rarity_order := 2; elsif v_roll < 0.38 then v_rarity_order := 3; elsif v_roll < 0.75 then v_rarity_order := 4; else v_rarity_order := 5; end if;
    end if;

    v_rarity_name := case v_rarity_order
      when 1 then 'normal' when 2 then 'rare' when 3 then 'epic' when 4 then 'legendary' else 'mythic'
    end;

    select rc.relic_key into v_picked_key from public.relic_catalog rc
      where rc.rarity_order = v_rarity_order
      order by random() limit 1;

    update public.profiles set gold = gold - v_cost, total_relic_draws = total_relic_draws + 1
      where id = auth.uid();

    select ur.level into v_existing_level from public.user_relics ur
      where ur.user_id = auth.uid() and ur.relic_key = v_picked_key;

    if v_existing_level is null then
      insert into public.user_relics (user_id, relic_key, level) values (auth.uid(), v_picked_key, 0);
      v_final_level := 0;
      v_was_dup := false;
    else
      v_was_dup := true;
      if v_existing_level >= 200 then
        v_final_level := v_existing_level;
      else
        v_attempted := true;
        v_success_chance := greatest(0.30, 1 - v_existing_level * 0.0035);
        if random() < v_success_chance then
          v_success := true;
          v_final_level := least(200, v_existing_level + 1);
          update public.user_relics ur set level = v_final_level
            where ur.user_id = auth.uid() and ur.relic_key = v_picked_key;
        else
          v_final_level := v_existing_level;
        end if;
      end if;
    end if;

    relic_key := v_picked_key;
    rarity := v_rarity_name;
    was_duplicate := v_was_dup;
    enhance_attempted := v_attempted;
    enhance_success := v_success;
    new_level := v_final_level;
    cost := v_cost;
    draw_level := least(50, 1 + (v_draws + 1) / 1000);
    return next;
  end loop;

  return;
end;
$$ language plpgsql security definer;
