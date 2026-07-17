-- ============================================
-- 052: 신규 유저 환영 패키지 (온보딩 초반 이탈 방지)
-- 스타터 몬스터를 처음 계약하는 순간(create_starter_monster) 우편함으로 소액 골드+레어 무기를
-- 자동 지급. 초반 그라인딩 부담을 살짝 덜어줘서 첫 세션 이탈률을 낮추려는 목적.
-- mails.source_key에 unique(user_id, source_key) 제약이 있어서 실수로 중복 지급될 일은 없음.
-- ============================================

create or replace function public.create_starter_monster(p_species_key text)
returns public.owned_monsters as $$
declare
  v_species_id integer;
  v_species record;
  v_existing integer;
  v_row public.owned_monsters;
begin
  v_species_id := case p_species_key
    when 'fire_1' then 1
    when 'water_1' then 4
    when 'grass_1' then 7
    else null
  end;
  if v_species_id is null then
    raise exception '유효하지 않은 스타터입니다.';
  end if;

  select count(*) into v_existing from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_existing > 0 then
    raise exception '이미 활성 몬스터가 있습니다.';
  end if;

  select * into v_species from public.monster_species where id = v_species_id;

  insert into public.owned_monsters (user_id, species_id, level, exp, hp, atk, def, is_active)
  values (auth.uid(), v_species_id, 1, 0, v_species.base_hp, v_species.base_atk, v_species.base_def, true)
  returning * into v_row;

  insert into public.user_skills (user_id, skill_key, skill_level)
  values (auth.uid(), 'basic_strike', 1)
  on conflict (user_id, skill_key) do nothing;

  update public.profiles set equipped_skills = array['basic_strike'] where id = auth.uid();

  -- 신규 유저 환영 패키지 (골드 3000 + 레어 무기 1개), 계정당 1회만
  insert into public.mails (user_id, title, body, gold_amount, item_key, source_key)
  values (
    auth.uid(),
    '🎁 모험을 시작한 당신에게',
    '계약을 축하해요! 초반 여정에 도움이 되길 바라며 작은 선물을 준비했어요.',
    3000,
    'weapon_rare',
    'starter_pack'
  )
  on conflict (user_id, source_key) do nothing;

  return v_row;
end;
$$ language plpgsql security definer;
