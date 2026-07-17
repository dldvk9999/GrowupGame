-- ============================================
-- 041: 스킬 편성 슬롯 최대치 5 -> 10으로 확장
-- 클라이언트 getSkillSlotCount와 동일한 레벨 구간(10/25/50/75/100/130/160/190/220마다 +1)으로 동기화.
-- ============================================

create or replace function public.set_skill_loadout(p_skill_keys text[])
returns void as $$
declare
  v_monster_level integer;
  v_slot_limit integer;
  v_owned_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select level into v_monster_level from public.owned_monsters
    where user_id = auth.uid() and is_active = true limit 1;
  if v_monster_level is null then v_monster_level := 1; end if;

  v_slot_limit := case
    when v_monster_level >= 220 then 10
    when v_monster_level >= 190 then 9
    when v_monster_level >= 160 then 8
    when v_monster_level >= 130 then 7
    when v_monster_level >= 100 then 6
    when v_monster_level >= 75 then 5
    when v_monster_level >= 50 then 4
    when v_monster_level >= 25 then 3
    when v_monster_level >= 10 then 2
    else 1
  end;

  if array_length(p_skill_keys, 1) is not null and array_length(p_skill_keys, 1) > v_slot_limit then
    raise exception '아직 그만큼 스킬 슬롯이 열리지 않았습니다. (현재 % 슬롯)', v_slot_limit;
  end if;

  if array_length(p_skill_keys, 1) is not null then
    select count(*) into v_owned_count from public.user_skills
      where user_id = auth.uid() and skill_key = any(p_skill_keys);
    if v_owned_count <> array_length(p_skill_keys, 1) then
      raise exception '보유하지 않은 스킬이 포함되어 있습니다.';
    end if;
    if array_length(p_skill_keys, 1) <> (select count(distinct k) from unnest(p_skill_keys) k) then
      raise exception '같은 스킬을 중복 장착할 수 없습니다.';
    end if;
  end if;

  update public.profiles set equipped_skills = coalesce(p_skill_keys, '{}') where id = auth.uid();
end;
$$ language plpgsql security definer;
