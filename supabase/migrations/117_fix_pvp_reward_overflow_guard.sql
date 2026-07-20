-- ============================================
-- 117: [예방적 버그 수정] PvP 보상이 add_gold 100만 상한을 넘으면 크래시할 수 있던 문제
-- (110 월드보스 크래시 건을 계기로, 다른 곳에도 비슷한 리스크가 없는지 점검하다 발견)
--
-- add_gold(target_user, amount)는 amount > 1,000,000이면 무조건 예외를 던짐(030).
-- 107(start_pvp_battle)의 보상 공식은 base_reward*3(실유저 승리 보너스)인데,
-- base_reward = max(20, 20 + 상대전투력/65)라 상대 전투력이 매우 높으면(약 2165만
-- 이상) base_reward*3이 100만을 넘어 add_gold가 크래시함. 레벨 상한이 없는 게임이라
-- (character-and-growth.md) 장기적으로 전투력이 그 정도까지 자라는 유저가 나올 수
-- 있음 - 실제로 터지기 전에 미리 방지.
--
-- 수정: add_gold 호출 직전에 v_reward를 90만으로 클램프.
-- start_pvp_battle/start_pvp_revenge_battle 둘 다 반환타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

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
  v_base_reward := greatest(20, round(20 + v_opp_power / 65.0));

  if v_my_roll >= v_opp_roll then
    v_result := 'win';
    v_reward := case when v_opp_is_real then v_base_reward * 3 else v_base_reward end;
  else
    v_result := 'lose';
    v_reward := case when v_opp_is_real then v_base_reward else 0 end;
  end if;

  v_reward := least(v_reward, 900000); -- add_gold 100만 상한(030) 대비 안전 클램프

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
  v_my_power integer;
  v_my_nickname text;
  v_last_battle timestamptz;
  v_opp_row record;
  v_opp_stats record;
  v_opp_bonus record;
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
  v_my_power := public.calc_combat_power(
    v_my_stats.atk + coalesce(v_my_bonus.bonus_atk, 0),
    v_my_stats.def + coalesce(v_my_bonus.bonus_def, 0),
    v_my_stats.max_hp + coalesce(v_my_bonus.bonus_hp, 0)
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
  v_opp_power := public.calc_combat_power(
    v_opp_stats.atk + coalesce(v_opp_bonus.bonus_atk, 0),
    v_opp_stats.def + coalesce(v_opp_bonus.bonus_def, 0),
    v_opp_stats.max_hp + coalesce(v_opp_bonus.bonus_hp, 0)
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

  v_reward := least(v_reward, 900000); -- add_gold 100만 상한(030) 대비 안전 클램프

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
