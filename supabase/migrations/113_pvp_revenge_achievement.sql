-- ============================================
-- 113: PvP 복수전 승리 업적 "복수의 화신" - 신규 콘텐츠
-- 108/109로 복수전을 만들었으니, 반복해서 즐길 장기 목표(업적)를 하나 추가함.
--
-- profiles.pvp_revenge_wins 신설 - start_pvp_revenge_battle 승리 시에만 증가
-- (일반 start_pvp_battle 승리는 여기 포함 안 됨, 순수 복수전 전용 카운터).
-- claim_achievement는 반환타입(integer) 그대로라 DROP FUNCTION 불필요.
-- start_pvp_revenge_battle도 반환타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

alter table public.profiles
  add column if not exists pvp_revenge_wins integer not null default 0;

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

-- claim_achievement에 복수전 승리 업적 CASE만 추가 (097 기준 재정의)
create or replace function public.claim_achievement(p_achievement_key text)
returns integer as $$
declare
  v_monster record;
  v_stage_cleared_count integer;
  v_total_gacha_draws integer;
  v_pvp_wins integer;
  v_pvp_revenge_wins integer;
  v_attendance_total integer;
  v_equipped_slot_count integer;
  v_distinct_rarities integer;
  v_costume_count integer;
  v_referred_by uuid;
  v_eligible boolean := false;
  v_reward integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if exists (select 1 from public.achievement_claims where user_id = auth.uid() and achievement_key = p_achievement_key) then
    raise exception '이미 수령한 업적이에요.';
  end if;

  select level, unlocked_job_tier into v_monster
    from public.owned_monsters where user_id = auth.uid() and is_active = true;

  case p_achievement_key
    when 'level_10' then
      v_eligible := coalesce(v_monster.level, 0) >= 10; v_reward := 500;
    when 'level_30' then
      v_eligible := coalesce(v_monster.level, 0) >= 30; v_reward := 1500;
    when 'level_60' then
      v_eligible := coalesce(v_monster.level, 0) >= 60; v_reward := 3000;
    when 'level_100' then
      v_eligible := coalesce(v_monster.level, 0) >= 100; v_reward := 6000;
    when 'level_140' then
      v_eligible := coalesce(v_monster.level, 0) >= 140; v_reward := 10000;
    when 'level_180' then
      v_eligible := coalesce(v_monster.level, 0) >= 180; v_reward := 20000;

    when 'job_tier_1' then
      v_eligible := coalesce(v_monster.unlocked_job_tier, 0) >= 1; v_reward := 1000;
    when 'job_tier_3' then
      v_eligible := coalesce(v_monster.unlocked_job_tier, 0) >= 3; v_reward := 5000;
    when 'job_tier_5' then
      v_eligible := coalesce(v_monster.unlocked_job_tier, 0) >= 5; v_reward := 15000;

    when 'stage_clear_10' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 10; v_reward := 500;
    when 'stage_clear_100' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 100; v_reward := 3000;
    when 'stage_clear_500' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 500; v_reward := 15000;
    when 'stage_clear_1000' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 1000; v_reward := 40000;

    when 'gacha_100' then
      select coalesce(p.total_skill_draws, 0) + coalesce((select sum(total_draws) from public.equipment_gacha_progress where user_id = auth.uid()), 0)
        into v_total_gacha_draws from public.profiles p where p.id = auth.uid();
      v_eligible := v_total_gacha_draws >= 100; v_reward := 1000;
    when 'gacha_1000' then
      select coalesce(p.total_skill_draws, 0) + coalesce((select sum(total_draws) from public.equipment_gacha_progress where user_id = auth.uid()), 0)
        into v_total_gacha_draws from public.profiles p where p.id = auth.uid();
      v_eligible := v_total_gacha_draws >= 1000; v_reward := 5000;
    when 'gacha_5000' then
      select coalesce(p.total_skill_draws, 0) + coalesce((select sum(total_draws) from public.equipment_gacha_progress where user_id = auth.uid()), 0)
        into v_total_gacha_draws from public.profiles p where p.id = auth.uid();
      v_eligible := v_total_gacha_draws >= 5000; v_reward := 20000;

    when 'pvp_win_1' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 1; v_reward := 300;
    when 'pvp_win_10' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 10; v_reward := 1500;
    when 'pvp_win_50' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 50; v_reward := 6000;

    when 'pvp_win_100' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 100; v_reward := 25000;

    when 'pvp_revenge_10' then
      select pvp_revenge_wins into v_pvp_revenge_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_revenge_wins, 0) >= 10; v_reward := 8000;

    when 'world_boss_participate' then
      v_eligible := exists (select 1 from public.world_boss_contributions where user_id = auth.uid() and total_damage > 0);
      v_reward := 500;

    when 'attendance_week' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 7; v_reward := 2000;
    when 'attendance_month' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 30; v_reward := 10000;

    when 'attendance_100' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 100; v_reward := 30000;
    when 'attendance_200' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 200; v_reward := 60000;

    when 'attendance_365' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 365; v_reward := 120000;

    when 'founder' then
      select (created_at < '2026-08-01'::timestamptz) into v_eligible from public.profiles where id = auth.uid();
      v_reward := 5000;

    when 'tower_10' then
      select coalesce(highest_floor, 0) >= 10 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 4000;
    when 'tower_30' then
      select coalesce(highest_floor, 0) >= 30 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 15000;

    when 'tower_100' then
      select coalesce(highest_floor, 0) >= 100 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 60000;

    when 'full_set_equipped' then
      select count(distinct slot), count(distinct split_part(item_key, '_', 2))
        into v_equipped_slot_count, v_distinct_rarities
        from public.user_inventory where user_id = auth.uid() and equipped = true;
      v_eligible := (v_equipped_slot_count = 4 and v_distinct_rarities = 1); v_reward := 3000;

    when 'costume_collector' then
      select count(*) into v_costume_count from public.pvp_costume_inventory where user_id = auth.uid();
      v_eligible := v_costume_count >= 5; v_reward := 2000;

    when 'costume_master' then
      select count(*) into v_costume_count from public.pvp_costume_inventory where user_id = auth.uid();
      v_eligible := v_costume_count >= 20; v_reward := 10000;

    when 'power_10k' then
      v_eligible := public.fetch_my_combat_power() >= 10000; v_reward := 3000;
    when 'power_100k' then
      v_eligible := public.fetch_my_combat_power() >= 100000; v_reward := 12000;
    when 'power_1m' then
      v_eligible := public.fetch_my_combat_power() >= 1000000; v_reward := 50000;

    when 'dungeon_depth_100' then
      select bool_or(cleared_stage >= 100) into v_eligible from public.dungeon_progress where user_id = auth.uid();
      v_reward := 5000;
    when 'dungeon_depth_300' then
      select bool_or(cleared_stage >= 300) into v_eligible from public.dungeon_progress where user_id = auth.uid();
      v_reward := 20000;
    when 'dungeon_depth_500' then
      select bool_or(cleared_stage >= 500) into v_eligible from public.dungeon_progress where user_id = auth.uid();
      v_reward := 80000;

    when 'referral_5' then
      select count(*) >= 5 into v_eligible from public.profiles where referred_by = auth.uid();
      v_reward := 5000;
    when 'referral_20' then
      select count(*) >= 20 into v_eligible from public.profiles where referred_by = auth.uid();
      v_reward := 25000;

    when 'worldboss_damage_30m' then
      select coalesce(sum(total_damage), 0) >= 30000000 into v_eligible from public.world_boss_contributions where user_id = auth.uid();
      v_reward := 8000;
    when 'worldboss_damage_300m' then
      select coalesce(sum(total_damage), 0) >= 300000000 into v_eligible from public.world_boss_contributions where user_id = auth.uid();
      v_reward := 40000;

    when 'max_enhance' then
      select exists(select 1 from public.user_inventory where user_id = auth.uid() and enhance_level >= 1000) into v_eligible;
      v_reward := 30000;

    when 'skill_collector' then
      select count(distinct skill_key) >= 50 into v_eligible from public.user_skills where user_id = auth.uid();
      v_reward := 25000;

    else
      raise exception '알 수 없는 업적입니다.';
  end case;

  if not v_eligible then
    raise exception '아직 달성 조건을 채우지 못했어요.';
  end if;

  perform public.add_gold(auth.uid(), v_reward);
  insert into public.achievement_claims (user_id, achievement_key) values (auth.uid(), p_achievement_key);

  -- 레벨10 업적을 처음 달성했고 추천인이 등록돼있으면, 추천인에게 보너스 우편 발송
  if p_achievement_key = 'level_10' then
    select referred_by into v_referred_by from public.profiles where id = auth.uid();
    if v_referred_by is not null then
      insert into public.mails (user_id, title, body, gold_amount, item_key, source_key)
      values (
        v_referred_by,
        '🤝 추천한 친구가 성장했어요!',
        '내가 추천한 친구가 레벨 10을 달성했어요. 추천 보너스를 받아가세요!',
        2000,
        null,
        'referral_bonus_' || auth.uid()::text
      )
      on conflict (user_id, source_key) do nothing;
    end if;
  end if;

  return v_reward;
end;
$$ language plpgsql security definer;
