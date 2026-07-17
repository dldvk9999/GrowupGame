-- ============================================
-- 049: 일일 무료 뽑기 (스킬 또는 장비 중 1종, 하루 1회)
-- 가챠 장르의 대표적인 재방문 유도 장치. 골드 소비 없이 하루 한 번 스킬뽑기 또는
-- 장비뽑기(슬롯 선택) 중 하나를 공짜로 돌릴 수 있음.
--
-- 구현 방식: 기존 draw_skill()/draw_equipment(slot) 로직을 그대로 재사용해서
-- (확률표/합성 로직 중복 없이) 정상적으로 비용을 차감시킨 뒤, 함수 시작 시점의
-- 골드 잔액으로 그대로 되돌려서 "무료"를 보장한다. 시작 시 잔액이 뽑기 비용보다
-- 적어도 실패하지 않도록 호출 전 충분한 임시 버퍼를 지급했다가 마지막에 정확히
-- 시작 시점 잔액으로 리셋하므로, 최종적으로 유저 골드는 순증감 없이 뽑기 결과만 남는다.
-- ============================================

create table public.daily_free_draw_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_claim_date date
);

alter table public.daily_free_draw_state enable row level security;
create policy "daily_free_draw_state는 본인만 조회" on public.daily_free_draw_state for select using (auth.uid() = user_id);
revoke insert, update, delete on public.daily_free_draw_state from authenticated;

create or replace function public.claim_daily_free_draw(p_type text, p_slot text default null)
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
  if p_type not in ('skill', 'equipment') then
    raise exception '유효하지 않은 뽑기 종류입니다.';
  end if;
  if p_type = 'equipment' and p_slot not in ('weapon', 'armor', 'gloves', 'shoes') then
    raise exception '유효하지 않은 슬롯입니다.';
  end if;

  insert into public.daily_free_draw_state (user_id, last_claim_date)
  values (auth.uid(), null)
  on conflict (user_id) do nothing;

  select last_claim_date into v_last_claim from public.daily_free_draw_state where user_id = auth.uid() for update;
  if v_last_claim = v_today then
    raise exception '오늘의 무료 뽑기는 이미 사용했어요.';
  end if;

  select gold into v_gold_before from public.profiles where id = auth.uid() for update;
  -- 뽑기 비용이 얼마든 실패하지 않도록 충분한 임시 버퍼 지급(뽑기레벨 50 기준 최대 비용의 여유배).
  perform public.add_gold(auth.uid(), 100000);

  if p_type = 'skill' then
    select * into v_skill_result from public.draw_skill();
  else
    select * into v_equip_result from public.draw_equipment(p_slot);
  end if;

  -- 시작 시점 잔액으로 정확히 리셋 -> 뽑기 비용이 얼마였든 최종 순변동 0(무료 뽑기 보장)
  update public.profiles set gold = v_gold_before where id = auth.uid();

  update public.daily_free_draw_state set last_claim_date = v_today where user_id = auth.uid();

  if p_type = 'skill' then
    return query select v_skill_result.skill_key, null::text, null::text, null::text,
      v_skill_result.was_duplicate, v_skill_result.new_skill_level;
  else
    return query select null::text, v_equip_result.item_key, v_equip_result.slot, v_equip_result.rarity,
      v_equip_result.was_duplicate, v_equip_result.new_enhance_level;
  end if;
end;
$$ language plpgsql security definer;
