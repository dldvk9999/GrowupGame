-- ============================================
-- 120: 유물 보너스를 전투력(PvP/랭킹) 및 자동사냥 골드 계산에 통합
-- calc_equipped_stat_bonus(051)와 나란히 calc_relic_bonus(119)를 호출해서
-- ATK/DEF/HP flat은 더하고, percent는 (base+장비flat+유물flat) 합계에 최종 곱함
-- (057 세트효과가 "누적 flat값에 1.05를 곱해서 다시 flat으로 반환"하는 것과 동일한
-- "최종 퍼센트 승수" 철학, 다만 유물은 calc_combat_power 호출부에서 직접 곱함).
--
-- 골드는 grant_idle_reward에만 반영(자동사냥 전용 - 105/118과 같은 범위 제한 원칙,
-- 스테이지/던전/탑/월드보스는 범위 밖으로 명시적으로 남겨둠, harness/relics.md 참고).
--
-- 5개 함수 전부 반환타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.fetch_my_combat_power()
returns integer as $$
declare
  v_monster record;
  v_stats record;
  v_bonus record;
  v_relic record;
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
  v_atk := (v_stats.atk + coalesce(v_bonus.bonus_atk, 0) + coalesce(v_relic.bonus_atk, 0)) * (1 + coalesce(v_relic.pct_atk, 0) / 100);
  v_def := (v_stats.def + coalesce(v_bonus.bonus_def, 0) + coalesce(v_relic.bonus_def, 0)) * (1 + coalesce(v_relic.pct_def, 0) / 100);
  v_hp := (v_stats.max_hp + coalesce(v_bonus.bonus_hp, 0) + coalesce(v_relic.bonus_hp, 0)) * (1 + coalesce(v_relic.pct_hp, 0) / 100);
  return public.calc_combat_power(round(v_atk)::integer, round(v_def)::integer, round(v_hp)::integer);
end;
$$ language plpgsql stable security definer;

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
        round((cs.atk + coalesce(eb.bonus_atk, 0) + coalesce(rb.bonus_atk, 0)) * (1 + coalesce(rb.pct_atk, 0) / 100))::integer,
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
    r.equipped_title
  from ranked r
  order by r.power desc
  limit 50;
end;
$$ language plpgsql security definer;

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
  v_my_power integer;
  v_last_battle timestamptz;
  v_opp_row record;
  v_opp_stats record;
  v_opp_bonus record;
  v_opp_relic record;
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
  v_my_power := public.calc_combat_power(
    round((v_my_stats.atk + coalesce(v_my_bonus.bonus_atk, 0) + coalesce(v_my_relic.bonus_atk, 0)) * (1 + coalesce(v_my_relic.pct_atk, 0) / 100))::integer,
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

  if v_opp_row.user_id is not null then
    select * into v_opp_stats from public.calc_monster_stats(v_opp_row.species_id, v_opp_row.level, v_opp_row.unlocked_job_tier);
    select * into v_opp_bonus from public.calc_equipped_stat_bonus(v_opp_row.user_id);
    select * into v_opp_relic from public.calc_relic_bonus(v_opp_row.user_id);
    v_opp_power := public.calc_combat_power(
      round((v_opp_stats.atk + coalesce(v_opp_bonus.bonus_atk, 0) + coalesce(v_opp_relic.bonus_atk, 0)) * (1 + coalesce(v_opp_relic.pct_atk, 0) / 100))::integer,
      round((v_opp_stats.def + coalesce(v_opp_bonus.bonus_def, 0) + coalesce(v_opp_relic.bonus_def, 0)) * (1 + coalesce(v_opp_relic.pct_def, 0) / 100))::integer,
      round((v_opp_stats.max_hp + coalesce(v_opp_bonus.bonus_hp, 0) + coalesce(v_opp_relic.bonus_hp, 0)) * (1 + coalesce(v_opp_relic.pct_hp, 0) / 100))::integer
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
  v_my_power integer;
  v_my_nickname text;
  v_last_battle timestamptz;
  v_opp_row record;
  v_opp_stats record;
  v_opp_bonus record;
  v_opp_relic record;
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
  v_my_power := public.calc_combat_power(
    round((v_my_stats.atk + coalesce(v_my_bonus.bonus_atk, 0) + coalesce(v_my_relic.bonus_atk, 0)) * (1 + coalesce(v_my_relic.pct_atk, 0) / 100))::integer,
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
  v_opp_power := public.calc_combat_power(
    round((v_opp_stats.atk + coalesce(v_opp_bonus.bonus_atk, 0) + coalesce(v_opp_relic.bonus_atk, 0)) * (1 + coalesce(v_opp_relic.pct_atk, 0) / 100))::integer,
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
  else
    v_result := 'lose';
    v_reward := v_base_reward;
  end if;

  v_reward := least(v_reward, 900000);

  if v_result = 'win' then
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_wins = pvp_wins + 1,
        pvp_revenge_wins = pvp_revenge_wins + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  else
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

create or replace function public.grant_idle_reward(p_chapter integer, p_player_level integer)
returns table(gold integer, is_golden boolean) as $$
declare
  v_last timestamptz;
  v_gold numeric;
  v_level integer;
  v_chapter integer;
  v_golden boolean;
  v_is_weekend boolean;
  v_relic record;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select last_idle_reward_at into v_last from public.profiles where id = auth.uid() for update;
  if v_last is not null and now() - v_last < interval '2.5 seconds' then
    raise exception '너무 빠른 요청입니다.';
  end if;

  select level into v_level from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_level is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  select coalesce(max(ceil(stage_id / 10.0)), 1) into v_chapter
    from public.stage_progress
    where user_id = auth.uid() and cleared = true;

  v_gold := public.calc_idle_gold(v_chapter, v_level);

  v_is_weekend := extract(dow from (now() at time zone 'Asia/Seoul')) in (0, 6);
  if v_is_weekend then
    v_gold := round(v_gold * 1.5);
  end if;

  v_golden := random() < 0.05;
  if v_golden then
    v_gold := v_gold * 3;
  end if;

  -- 유물 골드획득% 보너스 (자동사냥 전용 범위, harness/relics.md 참고)
  select * into v_relic from public.calc_relic_bonus(auth.uid());
  if coalesce(v_relic.pct_gold, 0) > 0 then
    v_gold := round(v_gold * (1 + v_relic.pct_gold / 100));
  end if;

  v_gold := least(v_gold, 1000000);

  update public.profiles set last_idle_reward_at = now() where id = auth.uid();
  perform public.add_gold(auth.uid(), v_gold::integer);

  return query select v_gold::integer, v_golden;
end;
$$ language plpgsql security definer;
