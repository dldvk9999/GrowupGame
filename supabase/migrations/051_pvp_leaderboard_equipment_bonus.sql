-- ============================================
-- 051: PvP 전투력/랭킹에 장착 장비 보너스 반영 (기존엔 종족+레벨+전직만 계산해서
-- 강화 장비를 낀 유저와 안 낀 유저가 똑같이 취급되던 불공정 문제 수정)
--
-- itemCatalog.js의 슬롯 base(무기6/방어구6/장갑3/신발18)와 등급 배율(노멀1/레어1.8/
-- 에픽2.8/전설4.2/신화6.5), 강화 공식(statBonus×(1+enhance×0.08))을 SQL로 그대로 포팅.
-- item_key가 "슬롯_등급" 형태(예: weapon_epic)라 rarity는 split_part로 추출.
-- ⚠️ itemCatalog.js의 SLOTS.base나 RARITIES.statMultiplier가 바뀌면 이 함수도 같이 고쳐야 함.
-- ============================================

create or replace function public.calc_equipped_stat_bonus(p_user_id uuid)
returns table(bonus_atk integer, bonus_def integer, bonus_hp integer) as $$
declare
  v_atk integer := 0;
  v_def integer := 0;
  v_hp integer := 0;
  v_row record;
  v_slot_base integer;
  v_rarity_mult numeric;
  v_enhanced integer;
begin
  for v_row in
    select item_key, slot, enhance_level from public.user_inventory
    where user_id = p_user_id and equipped = true
  loop
    v_slot_base := case v_row.slot
      when 'weapon' then 6 when 'armor' then 6 when 'gloves' then 3 when 'shoes' then 18 else 0
    end;
    v_rarity_mult := case split_part(v_row.item_key, '_', 2)
      when 'normal' then 1 when 'rare' then 1.8 when 'epic' then 2.8
      when 'legendary' then 4.2 when 'mythic' then 6.5 else 1
    end;
    v_enhanced := round(round(v_slot_base * v_rarity_mult) * (1 + v_row.enhance_level * 0.08));
    if v_row.slot in ('weapon', 'gloves') then
      v_atk := v_atk + v_enhanced;
    elsif v_row.slot = 'armor' then
      v_def := v_def + v_enhanced;
    elsif v_row.slot = 'shoes' then
      v_hp := v_hp + v_enhanced;
    end if;
  end loop;
  return query select v_atk, v_def, v_hp;
end;
$$ language plpgsql stable;

-- start_pvp_battle: 전투력 계산에 장비 보너스 포함 (023/038의 로직 그대로 유지 + 장비 보너스만 추가)
create or replace function public.start_pvp_battle()
returns table(
  result text, opponent_name text, opponent_is_real boolean,
  my_power integer, opponent_power integer, reward integer, currency_balance integer
) as $$
declare
  v_my_monster record;
  v_my_stats record;
  v_my_bonus record;
  v_my_power integer;
  v_last_battle timestamptz;
  v_opp_row record;
  v_opp_stats record;
  v_opp_bonus record;
  v_opp_power integer;
  v_opp_name text;
  v_opp_is_real boolean;
  v_opp_user_id uuid;
  v_my_roll numeric;
  v_opp_roll numeric;
  v_result text;
  v_reward integer;
  v_synthetic_names text[] := array['그림자 전사', '환영의 검사', '유령 기사', '미지의 도전자', '수련용 인형', '떠돌이 검객', '가면의 결투가'];
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select last_pvp_battle_at into v_last_battle from public.profiles where id = auth.uid();
  if v_last_battle is not null and now() - v_last_battle < interval '2 seconds' then
    raise exception '너무 빠릅니다. 잠시 후 다시 시도해주세요.';
  end if;

  select * into v_my_monster from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_my_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  select * into v_my_stats from public.calc_monster_stats(v_my_monster.species_id, v_my_monster.level, v_my_monster.unlocked_job_tier);
  select * into v_my_bonus from public.calc_equipped_stat_bonus(auth.uid());
  v_my_power := public.calc_combat_power(
    v_my_stats.atk + coalesce(v_my_bonus.bonus_atk, 0),
    v_my_stats.def + coalesce(v_my_bonus.bonus_def, 0),
    v_my_stats.max_hp + coalesce(v_my_bonus.bonus_hp, 0)
  );

  select om.user_id, om.species_id, om.level, om.unlocked_job_tier, p.nickname
    into v_opp_row
  from public.owned_monsters om
  join public.profiles p on p.id = om.user_id
  where om.is_active = true and om.user_id <> auth.uid()
  order by random()
  limit 1;

  if v_opp_row.user_id is not null then
    select * into v_opp_stats from public.calc_monster_stats(v_opp_row.species_id, v_opp_row.level, v_opp_row.unlocked_job_tier);
    select * into v_opp_bonus from public.calc_equipped_stat_bonus(v_opp_row.user_id);
    v_opp_power := public.calc_combat_power(
      v_opp_stats.atk + coalesce(v_opp_bonus.bonus_atk, 0),
      v_opp_stats.def + coalesce(v_opp_bonus.bonus_def, 0),
      v_opp_stats.max_hp + coalesce(v_opp_bonus.bonus_hp, 0)
    );
    if v_opp_power < v_my_power * 0.75 or v_opp_power > v_my_power * 1.25 then
      v_opp_row := null;
    end if;
  end if;

  if v_opp_row.user_id is null then
    v_opp_power := round(v_my_power * (0.9 + random() * 0.2));
    v_opp_name := v_synthetic_names[1 + floor(random() * array_length(v_synthetic_names, 1))::int];
    v_opp_is_real := false;
    v_opp_user_id := null;
  else
    v_opp_name := coalesce(v_opp_row.nickname, '익명의 도전자');
    v_opp_is_real := true;
    v_opp_user_id := v_opp_row.user_id;
  end if;

  v_my_roll := v_my_power * (0.85 + random() * 0.3);
  v_opp_roll := v_opp_power * (0.85 + random() * 0.3);

  if v_my_roll >= v_opp_roll then
    v_result := 'win';
    v_reward := greatest(20, round(20 + v_opp_power / 65.0));
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_wins = pvp_wins + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  else
    v_result := 'lose';
    v_reward := 0;
    update public.profiles
      set pvp_losses = pvp_losses + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  end if;

  insert into public.pvp_battle_log (user_id, opponent_user_id, opponent_name, opponent_is_real, my_power, opponent_power, result, reward)
  values (auth.uid(), v_opp_user_id, v_opp_name, v_opp_is_real, v_my_power, v_opp_power, v_result, v_reward);

  return query select v_result, v_opp_name, v_opp_is_real, v_my_power, v_opp_power, v_reward,
    (select pvp_currency from public.profiles where id = auth.uid());
end;
$$ language plpgsql security definer;

-- fetch_my_combat_power: 마이페이지/PvP 화면에 보이는 내 전투력도 장비 보너스 포함해서 동기화
create or replace function public.fetch_my_combat_power()
returns integer as $$
declare
  v_monster record;
  v_stats record;
  v_bonus record;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  select * into v_monster from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_monster is null then return 0; end if;
  select * into v_stats from public.calc_monster_stats(v_monster.species_id, v_monster.level, v_monster.unlocked_job_tier);
  select * into v_bonus from public.calc_equipped_stat_bonus(auth.uid());
  return public.calc_combat_power(
    v_stats.atk + coalesce(v_bonus.bonus_atk, 0),
    v_stats.def + coalesce(v_bonus.bonus_def, 0),
    v_stats.max_hp + coalesce(v_bonus.bonus_hp, 0)
  );
end;
$$ language plpgsql stable security definer;

-- fetch_leaderboard: 랭킹도 동일한 기준(장비 보너스 포함)으로 통일
create or replace function public.fetch_leaderboard()
returns table(
  rank integer, nickname text, level integer, unlocked_job_tier integer,
  element text, combat_power integer, is_me boolean, equipped_title text
) as $$
begin
  return query
  with ranked as (
    select
      p.nickname,
      om.level,
      om.unlocked_job_tier,
      ms.element,
      public.calc_combat_power(
        cs.atk + coalesce(eb.bonus_atk, 0),
        cs.def + coalesce(eb.bonus_def, 0),
        cs.max_hp + coalesce(eb.bonus_hp, 0)
      ) as power,
      om.user_id,
      p.equipped_title
    from public.owned_monsters om
    join public.profiles p on p.id = om.user_id
    join public.monster_species ms on ms.id = om.species_id
    cross join lateral public.calc_monster_stats(om.species_id, om.level, om.unlocked_job_tier) cs
    cross join lateral public.calc_equipped_stat_bonus(om.user_id) eb
    where om.is_active = true
  )
  select
    row_number() over (order by r.power desc)::integer as rank,
    r.nickname,
    r.level,
    r.unlocked_job_tier,
    r.element,
    r.power,
    r.user_id = auth.uid() as is_me,
    r.equipped_title
  from ranked r
  order by r.power desc
  limit 50;
end;
$$ language plpgsql stable security definer;

-- fetch_my_rank: 랭킹과 동일한 기준(장비 보너스 포함)으로 통일해야 표시된 순위가 실제와 일치함
create or replace function public.fetch_my_rank()
returns integer as $$
declare
  v_my_power integer;
  v_rank integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select public.calc_combat_power(
    cs.atk + coalesce(eb.bonus_atk, 0),
    cs.def + coalesce(eb.bonus_def, 0),
    cs.max_hp + coalesce(eb.bonus_hp, 0)
  ) into v_my_power
  from public.owned_monsters om
  cross join lateral public.calc_monster_stats(om.species_id, om.level, om.unlocked_job_tier) cs
  cross join lateral public.calc_equipped_stat_bonus(om.user_id) eb
  where om.user_id = auth.uid() and om.is_active = true;

  if v_my_power is null then return null; end if;

  select count(*) + 1 into v_rank
  from public.owned_monsters om
  cross join lateral public.calc_monster_stats(om.species_id, om.level, om.unlocked_job_tier) cs
  cross join lateral public.calc_equipped_stat_bonus(om.user_id) eb
  where om.is_active = true
    and public.calc_combat_power(
      cs.atk + coalesce(eb.bonus_atk, 0),
      cs.def + coalesce(eb.bonus_def, 0),
      cs.max_hp + coalesce(eb.bonus_hp, 0)
    ) > v_my_power;

  return v_rank;
end;
$$ language plpgsql stable security definer;
