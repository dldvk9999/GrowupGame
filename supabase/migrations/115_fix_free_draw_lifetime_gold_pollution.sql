-- ============================================
-- 115: [버그 수정] 일일 무료뽑기의 임시 버퍼 골드가 누적 획득량(lifetime_gold_earned)을
-- 오염시키던 문제 수정 (114 작업 직후 자체 재검토 중 발견)
--
-- 101(claim_daily_free_draw)은 "충분한 임시 버퍼를 add_gold로 지급했다가 뽑기 직후
-- 시작 시점 잔액으로 정확히 리셋"해서 무료 뽑기를 보장하는 트릭을 씀 - 최종 순증감은
-- 항상 0이라 profiles.gold엔 문제가 없었음.
--
-- 그런데 114에서 add_gold 내부에 lifetime_gold_earned 누적을 추가하면서, 이 "실제로는
-- 리셋되어 사라지는" 임시 버퍼(10만)까지 "진짜로 번 골드"처럼 매번 누적돼버리는 부작용이
-- 생김. 유저가 일일 무료뽑기(최대 5종)를 매일 돌리면 실제로는 한 푼도 안 늘었는데
-- lifetime_gold_earned는 하루 최대 50만씩 허수로 불어나는 구조 - 114의 업적("다 써도
-- 사라지지 않는 진짜 기록")이라는 취지 자체가 무색해짐.
--
-- 수정: 이 함수의 임시 버퍼 지급만 add_gold 대신 profiles.gold를 직접 UPDATE하도록
-- 변경(다른 검증/한도 로직 없이 순수 임시값이라 add_gold를 거칠 필요가 원래 없었음).
-- 반환 타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.claim_daily_free_draw(p_type text)
returns table(skill_key text, item_key text, slot text, rarity text, was_duplicate boolean, new_level integer) as $$
declare
  v_gold_before integer;
  v_today date := current_date;
  v_last_claim date;
  v_skill_result record;
  v_equip_result record;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_type not in ('weapon', 'armor', 'gloves', 'shoes', 'skill') then
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
  -- (수정) add_gold 대신 직접 UPDATE - 이 10만은 실제로 "번" 골드가 아니라 뽑기 비용을
  -- 감당하기 위한 순수 임시 버퍼(바로 아래에서 시작 잔액으로 정확히 리셋됨)라
  -- lifetime_gold_earned(114)에 잡히면 안 됨
  update public.profiles set gold = gold + 100000 where id = auth.uid();

  if p_type = 'skill' then
    select * into v_skill_result from public.draw_skill();
  else
    select * into v_equip_result from public.draw_equipment(p_type);
  end if;

  -- 시작 시점 잔액으로 정확히 리셋 -> 뽑기 비용이 얼마였든 최종 순변동 0(무료 뽑기 보장)
  update public.profiles set gold = v_gold_before where id = auth.uid();

  update public.daily_free_draw_state set last_claim_date = v_today
    where user_id = auth.uid() and draw_type = p_type;

  if p_type = 'skill' then
    return query select v_skill_result.skill_key, null::text, null::text, null::text,
      v_skill_result.was_duplicate, v_skill_result.new_skill_level;
  else
    return query select null::text, v_equip_result.item_key, v_equip_result.slot, v_equip_result.rarity,
      v_equip_result.was_duplicate, v_equip_result.new_enhance_level;
  end if;
end;
$$ language plpgsql security definer;
