-- ============================================
-- 101: 일일 무료뽑기를 5종(무기/방어구/장갑/신발/스킬)으로 분리 (사용자 요청)
-- 기존엔 "스킬 또는 장비(슬롯 선택) 중 1종만 하루 1회"였는데, 이제 5종 전부 각각
-- 독립적으로 하루 1회씩 무료로 돌릴 수 있음.
--
-- 테이블을 (user_id, draw_type) 복합키로 재구성(draw_type: weapon/armor/gloves/
-- shoes/skill). 기존 정책이 "하루 1개만" 이었던 걸 "5개 다" 로 바꾸는 것이므로,
-- 정책 자체가 바뀌는 시점의 기존 상태(오늘 이미 뭘 뽑았는지)는 의미가 없어져서
-- 테이블을 통째로 재생성함 - 다음 접속 시 유저 전원이 5종 전부를 새로 받을 수
-- 있게 되는 것뿐이라 게임 경제에 미치는 영향은 미미함(무료뽑기 자체가 저비용 항목).
-- ============================================

drop function if exists public.claim_daily_free_draw(text, text);
drop table if exists public.daily_free_draw_state;

create table public.daily_free_draw_state (
  user_id uuid not null references public.profiles(id) on delete cascade,
  draw_type text not null check (draw_type in ('weapon', 'armor', 'gloves', 'shoes', 'skill')),
  last_claim_date date,
  primary key (user_id, draw_type)
);

alter table public.daily_free_draw_state enable row level security;
create policy "daily_free_draw_state는 본인만 조회" on public.daily_free_draw_state for select using (auth.uid() = user_id);
revoke insert, update, delete on public.daily_free_draw_state from authenticated;

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
  -- 뽑기 비용이 얼마든 실패하지 않도록 충분한 임시 버퍼 지급(뽑기레벨 50 기준 최대 비용의 여유배).
  perform public.add_gold(auth.uid(), 100000);

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
