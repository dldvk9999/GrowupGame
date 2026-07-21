-- ============================================
-- 130: 유물뽑기 가격을 전체 뽑기 중 최고가로 인상 + 일일 무료뽑기 지원 - 사용자 요청
--
-- 가격: 레벨1 기준 1000골드(스킬 300/장비 100보다 훨씬 비쌈), 레벨이 오를수록
-- 300골드씩 증가(레벨50 기준 15,700골드) - "제일 비싸게" 요구사항 반영.
--
-- 무료뽑기: daily_free_draw_state의 draw_type 체크제약에 'relic' 추가,
-- claim_daily_free_draw가 유물 뽑기도 처리하도록 확장(반환컬럼 3개 추가돼
-- DROP FUNCTION 필요 - relic_key/enhance_attempted/enhance_success).
--
-- draw_relic은 반환타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.draw_relic()
returns table(
  relic_key text, rarity text, was_duplicate boolean, enhance_attempted boolean,
  enhance_success boolean, new_level integer, cost integer, draw_level integer
) as $$
declare
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
  v_attempted boolean := false;
  v_success boolean := false;
  v_success_chance numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select p.total_relic_draws into v_draws from public.profiles p where p.id = auth.uid();
  v_draw_level := least(50, 1 + v_draws / 1000);
  -- (수정) 뽑기 중 최고가로 인상: 레벨1=1000골드, 레벨당 +300골드(사용자 요청)
  v_cost := 1000 + (v_draw_level - 1) * 300;

  select p.gold into v_gold from public.profiles p where p.id = auth.uid() for update;
  if v_gold is null or v_gold < v_cost then
    raise exception '골드가 부족합니다.';
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

  return query select v_picked_key, v_rarity_name, v_was_dup, v_attempted, v_success, v_final_level, v_cost,
    least(50, 1 + (v_draws + 1) / 1000);
end;
$$ language plpgsql security definer;

-- 무료뽑기 대상에 유물 추가
alter table public.daily_free_draw_state drop constraint if exists daily_free_draw_state_draw_type_check;
alter table public.daily_free_draw_state add constraint daily_free_draw_state_draw_type_check
  check (draw_type in ('weapon', 'armor', 'gloves', 'shoes', 'skill', 'relic'));

drop function if exists public.claim_daily_free_draw(text);

create or replace function public.claim_daily_free_draw(p_type text)
returns table(
  skill_key text, item_key text, slot text, rarity text, was_duplicate boolean, new_level integer,
  relic_key text, enhance_attempted boolean, enhance_success boolean
) as $$
declare
  v_gold_before integer;
  v_today date := current_date;
  v_last_claim date;
  v_skill_result record;
  v_equip_result record;
  v_relic_result record;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_type not in ('weapon', 'armor', 'gloves', 'shoes', 'skill', 'relic') then
    raise exception '유효하지 않은 뽑기 종류입니다.';
  end if;

  insert into public.daily_free_draw_state (user_id, draw_type, last_claim_date)
  values (auth.uid(), p_type, null)
  on conflict (user_id, draw_type) do nothing;

  select last_claim_date into v_last_claim from public.daily_free_draw_state
    where user_id = auth.uid() and draw_type = p_type for update;
  if v_last_claim = v_today then
    raise exception '오늘의 무료 뽑기는 이미 사용했어요.';
  end if;

  select gold into v_gold_before from public.profiles where id = auth.uid() for update;
  -- 유물뽑기가 뽑기 중 가장 비싸므로(레벨50 기준 15,700) 임시 버퍼도 넉넉히 잡음
  update public.profiles set gold = gold + 100000 where id = auth.uid();

  if p_type = 'skill' then
    select * into v_skill_result from public.draw_skill();
  elsif p_type = 'relic' then
    select * into v_relic_result from public.draw_relic();
  else
    select * into v_equip_result from public.draw_equipment(p_type);
  end if;

  update public.profiles set gold = v_gold_before where id = auth.uid();

  update public.daily_free_draw_state set last_claim_date = v_today
    where user_id = auth.uid() and draw_type = p_type;

  if p_type = 'skill' then
    return query select v_skill_result.skill_key, null::text, null::text, null::text,
      v_skill_result.was_duplicate, v_skill_result.new_skill_level,
      null::text, null::boolean, null::boolean;
  elsif p_type = 'relic' then
    return query select null::text, null::text, null::text, v_relic_result.rarity,
      v_relic_result.was_duplicate, v_relic_result.new_level,
      v_relic_result.relic_key, v_relic_result.enhance_attempted, v_relic_result.enhance_success;
  else
    return query select null::text, v_equip_result.item_key, v_equip_result.slot, v_equip_result.rarity,
      v_equip_result.was_duplicate, v_equip_result.new_enhance_level,
      null::text, null::boolean, null::boolean;
  end if;
end;
$$ language plpgsql security definer;
