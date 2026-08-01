-- ============================================
-- 171: 스킬 보유효과를 PvP/전투력 계산에 반영 - todo.md 후속과제 이행(사용자 요청)
-- 클라이언트(skillCatalog.js의 sumSkillPossessionBonus)는 이미 계산하고 있었지만
-- 서버 전투력/PvP 계산에는 반영된 적이 없었음. 예전엔 "50종 계산식을 통째로 SQL로
-- 포팅해야 해서 범위가 큼"이라고 todo에 적어뒀었는데, 실제로 확인해보니 보유효과
-- 공식은 등급(skill_catalog.rarity, 이미 서버에 있음)과 스킬레벨(user_skills.skill_level,
-- 역시 이미 서버에 있음)만 있으면 계산 가능해서(스킬별 50종 효과 자체와는 무관 - 그건
-- "사용 시 효과"고 보유효과는 등급/레벨만 보는 별개의 단순 공식) 예상보다 범위가 작았음.
-- ============================================

/** 유저가 보유한 스킬 전체의 상시 ATK 보너스 - 클라이언트 sumSkillPossessionBonus와 동일 공식 유지할 것 */
create or replace function public.calc_skill_possession_bonus(p_user_id uuid)
returns integer as $$
  select coalesce(sum(
    round(
      (case sc.rarity
        when 'normal' then 2 when 'rare' then 4 when 'epic' then 8
        when 'legendary' then 16 when 'mythic' then 32 else 2 end
      )::numeric * (1 + (us.skill_level - 1) * 0.01)
    )
  ), 0)::integer
  from public.user_skills us
  join public.skill_catalog sc on sc.skill_key = us.skill_key
  where us.user_id = p_user_id;
$$ language sql stable;

-- fetch_my_combat_power(120) 재정의 - 스킬 보유효과 반영. 반환타입(integer) 그대로, DROP 불필요.
create or replace function public.fetch_my_combat_power()
returns integer as $$
declare
  v_monster record;
  v_stats record;
  v_bonus record;
  v_relic record;
  v_skill_bonus integer;
  v_atk numeric;
  v_def numeric;
  v_hp numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  select * into v_monster from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_monster is null then return 0; end if;
  select * into v_stats from public.calc_monster_stats(v_monster.species_id, v_monster.level, v_monster.unlocked_job_tier);
  select * into v_bonus from public.calc_equipped_stat_bonus(auth.uid());
  select * into v_relic from public.calc_relic_bonus(auth.uid());
  v_skill_bonus := public.calc_skill_possession_bonus(auth.uid());
  v_atk := (v_stats.atk + coalesce(v_bonus.bonus_atk, 0) + coalesce(v_relic.bonus_atk, 0) + v_skill_bonus) * (1 + coalesce(v_relic.pct_atk, 0) / 100);
  v_def := (v_stats.def + coalesce(v_bonus.bonus_def, 0) + coalesce(v_relic.bonus_def, 0)) * (1 + coalesce(v_relic.pct_def, 0) / 100);
  v_hp := (v_stats.max_hp + coalesce(v_bonus.bonus_hp, 0) + coalesce(v_relic.bonus_hp, 0)) * (1 + coalesce(v_relic.pct_hp, 0) / 100);
  return public.calc_combat_power(round(v_atk)::integer, round(v_def)::integer, round(v_hp)::integer);
end;
$$ language plpgsql stable security definer;

-- start_pvp_battle(140) 재정의 - 나/상대 양쪽 다 스킬 보유효과 반영. 반환타입 그대로, DROP 불필요.
create or replace function public.start_pvp_battle()
returns table(
  result text, opponent_name text, opponent_is_real boolean,
  my_power integer, opponent_power integer, reward integer, currency_balance integer
) as $$
declare
  v_my_monster record;
  v_my_stats record;
  v_my_bonus record;
  v_my_relic record;
  v_my_skill_bonus integer;
  v_my_power integer;
  v_last_battle timestamptz;
  v_opp_row record;
  v_found_opponent boolean := false;
  v_opp_stats record;
  v_opp_bonus record;
  v_opp_relic record;
  v_opp_skill_bonus integer;
  v_opp_power integer;
  v_opp_name text;
  v_opp_is_real boolean;
  v_opp_user_id uuid;
  v_my_roll numeric;
  v_opp_roll numeric;
  v_result text;
  v_base_reward integer;
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
  select * into v_my_relic from public.calc_relic_bonus(auth.uid());
  v_my_skill_bonus := public.calc_skill_possession_bonus(auth.uid());
  v_my_power := public.calc_combat_power(
    round((v_my_stats.atk + coalesce(v_my_bonus.bonus_atk, 0) + coalesce(v_my_relic.bonus_atk, 0) + v_my_skill_bonus) * (1 + coalesce(v_my_relic.pct_atk, 0) / 100))::integer,
    round((v_my_stats.def + coalesce(v_my_bonus.bonus_def, 0) + coalesce(v_my_relic.bonus_def, 0)) * (1 + coalesce(v_my_relic.pct_def, 0) / 100))::integer,
    round((v_my_stats.max_hp + coalesce(v_my_bonus.bonus_hp, 0) + coalesce(v_my_relic.bonus_hp, 0)) * (1 + coalesce(v_my_relic.pct_hp, 0) / 100))::integer
  );

  select om.user_id, om.species_id, om.level, om.unlocked_job_tier, p.nickname
    into v_opp_row
  from public.owned_monsters om
  join public.profiles p on p.id = om.user_id
  where om.is_active = true and om.user_id <> auth.uid()
  order by random()
  limit 1;
  v_found_opponent := found; -- (재수정) record 필드를 직접 참조하지 않고 별도 boolean만 사용

  if v_found_opponent then
    select * into v_opp_stats from public.calc_monster_stats(v_opp_row.species_id, v_opp_row.level, v_opp_row.unlocked_job_tier);
    select * into v_opp_bonus from public.calc_equipped_stat_bonus(v_opp_row.user_id);
    select * into v_opp_relic from public.calc_relic_bonus(v_opp_row.user_id);
    v_opp_skill_bonus := public.calc_skill_possession_bonus(v_opp_row.user_id);
    v_opp_power := public.calc_combat_power(
      round((v_opp_stats.atk + coalesce(v_opp_bonus.bonus_atk, 0) + coalesce(v_opp_relic.bonus_atk, 0) + v_opp_skill_bonus) * (1 + coalesce(v_opp_relic.pct_atk, 0) / 100))::integer,
      round((v_opp_stats.def + coalesce(v_opp_bonus.bonus_def, 0) + coalesce(v_opp_relic.bonus_def, 0)) * (1 + coalesce(v_opp_relic.pct_def, 0) / 100))::integer,
      round((v_opp_stats.max_hp + coalesce(v_opp_bonus.bonus_hp, 0) + coalesce(v_opp_relic.bonus_hp, 0)) * (1 + coalesce(v_opp_relic.pct_hp, 0) / 100))::integer
    );
    if v_opp_power < v_my_power * 0.75 or v_opp_power > v_my_power * 1.25 then
      v_found_opponent := false; -- 전투력 격차가 크면 실유저 매칭 취소, 아래에서 가상 상대로 대체
    end if;
  end if;

  if not v_found_opponent then
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
  v_base_reward := greatest(20, round(20 + v_opp_power / 65.0));

  if v_my_roll >= v_opp_roll then
    v_result := 'win';
    v_reward := case when v_opp_is_real then v_base_reward * 3 else v_base_reward end;
  else
    v_result := 'lose';
    v_reward := case when v_opp_is_real then v_base_reward else 0 end;
  end if;

  v_reward := least(v_reward, 900000);

  if v_result = 'win' then
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_wins = pvp_wins + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  else
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_losses = pvp_losses + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  end if;

  insert into public.pvp_battle_log (user_id, opponent_user_id, opponent_name, opponent_is_real, my_power, opponent_power, result, reward)
  values (auth.uid(), v_opp_user_id, v_opp_name, v_opp_is_real, v_my_power, v_opp_power, v_result, v_reward);

  return query select v_result, v_opp_name, v_opp_is_real, v_my_power, v_opp_power, v_reward,
    (select pvp_currency from public.profiles where id = auth.uid());
end;
$$ language plpgsql security definer;

-- start_pvp_revenge_battle(113) 재정의 - 스킬 보유효과 추가 + 원래 빠져있던 유물(relic)
-- 보너스도 이 김에 같이 반영(정기점검이 아니라 배치 작업 중 발견 - main PvP는 relic을
-- 반영하는데 복수전만 누락돼있었음, 형평성 버그로 판단해 같이 수정). 반환타입 그대로, DROP 불필요.
create or replace function public.start_pvp_revenge_battle(p_opponent_id uuid)
returns table(
  result text, opponent_name text, opponent_is_real boolean,
  my_power integer, opponent_power integer, reward integer, currency_balance integer
) as $$
declare
  v_my_monster record;
  v_my_stats record;
  v_my_bonus record;
  v_my_relic record;
  v_my_skill_bonus integer;
  v_my_power integer;
  v_my_nickname text;
  v_last_battle timestamptz;
  v_opp_row record;
  v_opp_stats record;
  v_opp_bonus record;
  v_opp_relic record;
  v_opp_skill_bonus integer;
  v_opp_power integer;
  v_opp_name text;
  v_my_roll numeric;
  v_opp_roll numeric;
  v_result text;
  v_base_reward integer;
  v_reward integer;
  v_notify_gold integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_opponent_id = auth.uid() then
    raise exception '자기 자신에게는 도전할 수 없습니다.';
  end if;

  select last_pvp_battle_at into v_last_battle from public.profiles where id = auth.uid();
  if v_last_battle is not null and now() - v_last_battle < interval '2 seconds' then
    raise exception '너무 빠릅니다. 잠시 후 다시 시도해주세요.';
  end if;

  select * into v_my_monster from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_my_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  select nickname into v_my_nickname from public.profiles where id = auth.uid();

  select * into v_my_stats from public.calc_monster_stats(v_my_monster.species_id, v_my_monster.level, v_my_monster.unlocked_job_tier);
  select * into v_my_bonus from public.calc_equipped_stat_bonus(auth.uid());
  select * into v_my_relic from public.calc_relic_bonus(auth.uid());
  v_my_skill_bonus := public.calc_skill_possession_bonus(auth.uid());
  v_my_power := public.calc_combat_power(
    round((v_my_stats.atk + coalesce(v_my_bonus.bonus_atk, 0) + coalesce(v_my_relic.bonus_atk, 0) + v_my_skill_bonus) * (1 + coalesce(v_my_relic.pct_atk, 0) / 100))::integer,
    round((v_my_stats.def + coalesce(v_my_bonus.bonus_def, 0) + coalesce(v_my_relic.bonus_def, 0)) * (1 + coalesce(v_my_relic.pct_def, 0) / 100))::integer,
    round((v_my_stats.max_hp + coalesce(v_my_bonus.bonus_hp, 0) + coalesce(v_my_relic.bonus_hp, 0)) * (1 + coalesce(v_my_relic.pct_hp, 0) / 100))::integer
  );

  select om.user_id, om.species_id, om.level, om.unlocked_job_tier, p.nickname
    into v_opp_row
  from public.owned_monsters om
  join public.profiles p on p.id = om.user_id
  where om.is_active = true and om.user_id = p_opponent_id;

  if v_opp_row.user_id is null then
    raise exception '상대를 찾을 수 없어요. 이미 몬스터를 바꿨을 수 있어요.';
  end if;

  select * into v_opp_stats from public.calc_monster_stats(v_opp_row.species_id, v_opp_row.level, v_opp_row.unlocked_job_tier);
  select * into v_opp_bonus from public.calc_equipped_stat_bonus(v_opp_row.user_id);
  select * into v_opp_relic from public.calc_relic_bonus(v_opp_row.user_id);
  v_opp_skill_bonus := public.calc_skill_possession_bonus(v_opp_row.user_id);
  v_opp_power := public.calc_combat_power(
    round((v_opp_stats.atk + coalesce(v_opp_bonus.bonus_atk, 0) + coalesce(v_opp_relic.bonus_atk, 0) + v_opp_skill_bonus) * (1 + coalesce(v_opp_relic.pct_atk, 0) / 100))::integer,
    round((v_opp_stats.def + coalesce(v_opp_bonus.bonus_def, 0) + coalesce(v_opp_relic.bonus_def, 0)) * (1 + coalesce(v_opp_relic.pct_def, 0) / 100))::integer,
    round((v_opp_stats.max_hp + coalesce(v_opp_bonus.bonus_hp, 0) + coalesce(v_opp_relic.bonus_hp, 0)) * (1 + coalesce(v_opp_relic.pct_hp, 0) / 100))::integer
  );
  v_opp_name := coalesce(v_opp_row.nickname, '익명의 도전자');

  v_my_roll := v_my_power * (0.85 + random() * 0.3);
  v_opp_roll := v_opp_power * (0.85 + random() * 0.3);
  v_base_reward := greatest(20, round(20 + v_opp_power / 65.0));

  if v_my_roll >= v_opp_roll then
    v_result := 'win';
    v_reward := v_base_reward * 3;
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_wins = pvp_wins + 1,
        pvp_revenge_wins = pvp_revenge_wins + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  else
    v_result := 'lose';
    v_reward := v_base_reward;
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_losses = pvp_losses + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  end if;

  insert into public.pvp_battle_log (user_id, opponent_user_id, opponent_name, opponent_is_real, my_power, opponent_power, result, reward)
  values (auth.uid(), v_opp_row.user_id, v_opp_name, true, v_my_power, v_opp_power, v_result, v_reward);

  v_notify_gold := greatest(10, round(v_base_reward * 0.3));
  insert into public.mails (user_id, title, body, gold_amount, item_key, source_key)
  values (
    v_opp_row.user_id,
    case when v_result = 'win' then '⚔️ 복수전 도전을 받았어요!' else '🛡️ 복수전을 막아냈어요!' end,
    coalesce(v_my_nickname, '누군가') || '님이 복수전을 걸어와 ' ||
      case when v_result = 'win' then '패배했어요. 다시 도전해서 되갚아주세요!' else '승리했어요! 계속 방어에 성공하고 있어요.' end,
    v_notify_gold,
    null,
    'pvp_revenged_' || gen_random_uuid()::text
  );

  return query select v_result, v_opp_name, true, v_my_power, v_opp_power, v_reward,
    (select pvp_currency from public.profiles where id = auth.uid());
end;
$$ language plpgsql security definer;

-- fetch_leaderboard(167, 전투력 랭킹) 재정의 - 스킬 보유효과 반영. 반환타입 그대로, DROP 불필요.
create or replace function public.fetch_leaderboard()
returns table(
  rank integer, nickname text, level integer, unlocked_job_tier integer,
  element text, combat_power integer, is_me boolean, equipped_title text, user_id uuid
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
        round((cs.atk + coalesce(eb.bonus_atk, 0) + coalesce(rb.bonus_atk, 0) + public.calc_skill_possession_bonus(om.user_id)) * (1 + coalesce(rb.pct_atk, 0) / 100))::integer,
        round((cs.def + coalesce(eb.bonus_def, 0) + coalesce(rb.bonus_def, 0)) * (1 + coalesce(rb.pct_def, 0) / 100))::integer,
        round((cs.max_hp + coalesce(eb.bonus_hp, 0) + coalesce(rb.bonus_hp, 0)) * (1 + coalesce(rb.pct_hp, 0) / 100))::integer
      ) as power,
      om.user_id,
      p.equipped_title
    from public.owned_monsters om
    join public.profiles p on p.id = om.user_id
    join public.monster_species ms on ms.id = om.species_id
    cross join lateral public.calc_monster_stats(om.species_id, om.level, om.unlocked_job_tier) cs
    cross join lateral public.calc_equipped_stat_bonus(om.user_id) eb
    cross join lateral public.calc_relic_bonus(om.user_id) rb
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
    r.equipped_title,
    r.user_id
  from ranked r
  order by r.power desc
  limit 50;
end;
$$ language plpgsql security definer;

-- fetch_public_profile(166) 재정의 - 스킬 보유효과 반영. 반환타입 그대로, DROP 불필요.
create or replace function public.fetch_public_profile(p_user_id uuid)
returns table(
  nickname text,
  equipped_title text,
  monster_name text,
  species_id integer,
  element text,
  level integer,
  exp integer,
  unlocked_job_tier integer,
  combat_power integer,
  equipped_items jsonb,
  equipped_costumes text[],
  exp_dungeon_cleared integer,
  gold_dungeon_cleared integer,
  tower_highest_floor integer,
  guild_name text,
  guild_tag text
) as $$
declare
  v_profile public.profiles;
  v_monster public.owned_monsters;
  v_stats record;
  v_bonus record;
  v_relic record;
  v_skill_bonus integer;
  v_atk numeric;
  v_def numeric;
  v_hp numeric;
  v_power integer;
  v_items jsonb;
  v_exp_cleared integer;
  v_gold_cleared integer;
  v_tower_floor integer;
  v_guild record;
  v_element text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile is null then
    raise exception '존재하지 않는 유저입니다.';
  end if;

  select * into v_monster from public.owned_monsters where user_id = p_user_id and is_active = true;
  if v_monster is not null then
    select ms.element into v_element from public.monster_species ms where ms.id = v_monster.species_id;
  end if;

  if v_monster is not null then
    select * into v_stats from public.calc_monster_stats(v_monster.species_id, v_monster.level, v_monster.unlocked_job_tier);
    select * into v_bonus from public.calc_equipped_stat_bonus(p_user_id);
    select * into v_relic from public.calc_relic_bonus(p_user_id);
    v_skill_bonus := public.calc_skill_possession_bonus(p_user_id);
    v_atk := (v_stats.atk + coalesce(v_bonus.bonus_atk, 0) + coalesce(v_relic.bonus_atk, 0) + v_skill_bonus) * (1 + coalesce(v_relic.pct_atk, 0) / 100);
    v_def := (v_stats.def + coalesce(v_bonus.bonus_def, 0) + coalesce(v_relic.bonus_def, 0)) * (1 + coalesce(v_relic.pct_def, 0) / 100);
    v_hp := (v_stats.max_hp + coalesce(v_bonus.bonus_hp, 0) + coalesce(v_relic.bonus_hp, 0)) * (1 + coalesce(v_relic.pct_hp, 0) / 100);
    v_power := public.calc_combat_power(round(v_atk)::integer, round(v_def)::integer, round(v_hp)::integer);
  else
    v_power := 0;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('slot', ui.slot, 'item_key', ui.item_key, 'enhance_level', ui.enhance_level) order by ui.slot), '[]'::jsonb)
    into v_items
    from public.user_inventory ui
    where ui.user_id = p_user_id and ui.equipped = true;

  select cleared_stage into v_exp_cleared from public.dungeon_progress where user_id = p_user_id and dungeon_type = 'exp';
  select cleared_stage into v_gold_cleared from public.dungeon_progress where user_id = p_user_id and dungeon_type = 'gold';
  select highest_floor into v_tower_floor from public.tower_progress where user_id = p_user_id;

  select g.name, g.tag into v_guild from public.guild_members gm join public.guilds g on g.id = gm.guild_id where gm.user_id = p_user_id;

  nickname := v_profile.nickname;
  equipped_title := v_profile.equipped_title;
  monster_name := v_monster.nickname;
  species_id := v_monster.species_id;
  element := v_element;
  level := coalesce(v_monster.level, 0);
  exp := coalesce(v_monster.exp, 0);
  unlocked_job_tier := coalesce(v_monster.unlocked_job_tier, 0);
  combat_power := v_power;
  equipped_items := v_items;
  equipped_costumes := coalesce(v_profile.equipped_costumes, '{}');
  exp_dungeon_cleared := coalesce(v_exp_cleared, 0);
  gold_dungeon_cleared := coalesce(v_gold_cleared, 0);
  tower_highest_floor := coalesce(v_tower_floor, 0);
  guild_name := v_guild.name;
  guild_tag := v_guild.tag;
  return next;
end;
$$ language plpgsql stable security definer;
