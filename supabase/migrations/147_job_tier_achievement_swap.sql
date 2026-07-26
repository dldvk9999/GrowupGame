-- ============================================
-- 147: 전직 8차/10차 게이팅 업적 교체 - 사용자 요청
-- "차원의 정복자"(stage_clear_1000, 전체 스테이지 클리어)를 8차 요구조건에서 10차로 옮기고,
-- 8차 요구조건은 새 PvP 업적 "투기장의 지배자"(pvp_win_300, PvP 300승)로 교체함.
-- level_180("정점의 지배자")은 더 이상 전직 게이팅에 안 쓰임(독립 업적으로는 그대로 유지).
--
-- ⚠️ 기존 pvp_win_50 업적의 착용 칭호가 이미 "투기장의 지배자"였음(이름 충돌 발견) -
-- pvp_win_50(50승, 상대적으로 쉬움)의 칭호를 "투기장의 강자"로 바꾸고, 새로 만드는
-- pvp_win_300(300승, 훨씬 어려움)에 "투기장의 지배자"를 배정함(난이도에 맞는 재배치).
--
-- claim_achievement/set_equipped_title/start_job_dungeon 전부 반환타입 그대로라
-- DROP FUNCTION 불필요. 클라이언트(lib/achievements.js, lib/jobDungeon.js)와 동기화 유지할 것.
-- ============================================

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
  v_lifetime_gold bigint;
  v_unique_items integer;
  v_relic_count integer;
  v_max_relic_level integer;
  v_current_tier integer;
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

    when 'pvp_win_300' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 300; v_reward := 40000;

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

    when 'lifetime_gold_1m' then
      select lifetime_gold_earned into v_lifetime_gold from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_lifetime_gold, 0) >= 1000000; v_reward := 2000;
    when 'lifetime_gold_50m' then
      select lifetime_gold_earned into v_lifetime_gold from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_lifetime_gold, 0) >= 50000000; v_reward := 15000;
    when 'lifetime_gold_500m' then
      select lifetime_gold_earned into v_lifetime_gold from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_lifetime_gold, 0) >= 500000000; v_reward := 50000;

    when 'equip_collection_10' then
      select count(distinct item_key) into v_unique_items from public.user_inventory where user_id = auth.uid();
      v_eligible := coalesce(v_unique_items, 0) >= 10; v_reward := 4000;
    when 'equip_collection_20' then
      select count(distinct item_key) into v_unique_items from public.user_inventory where user_id = auth.uid();
      v_eligible := coalesce(v_unique_items, 0) >= 20; v_reward := 20000;

    when 'relic_collector' then
      select count(*) into v_relic_count from public.user_relics where user_id = auth.uid();
      v_eligible := coalesce(v_relic_count, 0) >= 20; v_reward := 6000;

    when 'relic_master' then
      select max(level) into v_max_relic_level from public.user_relics where user_id = auth.uid();
      v_eligible := coalesce(v_max_relic_level, 0) >= 200; v_reward := 30000;

    when 'job_tier_10' then
      select unlocked_job_tier into v_current_tier from public.owned_monsters where user_id = auth.uid() and is_active = true;
      v_eligible := coalesce(v_current_tier, 0) >= 10; v_reward := 100000;

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

create or replace function public.set_equipped_title(p_achievement_key text)
returns void as $$
declare
  v_title text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_achievement_key is null then
    update public.profiles set equipped_title = null where id = auth.uid();
    return;
  end if;

  if not exists (select 1 from public.achievement_claims where user_id = auth.uid() and achievement_key = p_achievement_key) then
    raise exception '아직 달성하지 않은 업적이에요.';
  end if;

  v_title := case p_achievement_key
    when 'level_180' then '정점의 지배자'
    when 'job_tier_5' then '전설의 전사'
    when 'job_tier_10' then '조율자의 계승자'
    when 'stage_clear_1000' then '차원의 정복자'
    when 'gacha_5000' then '행운의 화신'
    when 'pvp_win_50' then '투기장의 강자'
    when 'pvp_win_300' then '투기장의 지배자'
    when 'attendance_month' then '성실한 조련사'
    when 'full_set_equipped' then '완벽주의자'
    when 'founder' then '얼리버드'
    when 'costume_master' then '패셔니스타'
    when 'power_1m' then '종말의 위용'
    when 'referral_20' then '전도사'
    else null
  end;

  if v_title is null then
    raise exception '칭호가 없는 업적이에요.';
  end if;

  update public.profiles set equipped_title = v_title where id = auth.uid();
end;
$$ language plpgsql security definer;

create or replace function public.start_job_dungeon(p_tier integer)
returns uuid as $$
declare
  v_monster public.owned_monsters;
  v_required_level integer;
  v_session_id uuid;
  v_tower_floor integer;
  v_mission_number integer;
  v_required_tower integer;
  v_required_mission integer;
  v_required_achievement text;
  v_has_achievement boolean;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_tier not in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10) then
    raise exception '유효하지 않은 전직 단계입니다.';
  end if;

  select * into v_monster from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  v_required_level := case p_tier
    when 1 then 30 when 2 then 60 when 3 then 100 when 4 then 140 when 5 then 180
    when 6 then 240 when 7 then 300 when 8 then 360 when 9 then 420 when 10 then 480
  end;
  if v_monster.level < v_required_level then
    raise exception '레벨이 부족합니다. (Lv.% 필요)', v_required_level;
  end if;
  if v_monster.unlocked_job_tier <> p_tier - 1 then
    raise exception '이전 단계 전직을 먼저 완료해야 합니다.';
  end if;

  -- 6~10차는 레벨 외 추가 조건(무한의 탑 최소층 / 가이드미션 최소 진행 / 특정 업적 보유)을 검증
  if p_tier >= 6 then
    v_required_tower := case p_tier when 6 then 20 when 7 then 40 when 8 then 60 when 9 then 80 when 10 then 100 end;
    v_required_mission := case p_tier when 7 then 15 when 8 then 25 when 9 then 35 when 10 then 50 else null end;
    -- (수정, 사용자 요청) 8차/10차 요구 업적 교체: 8차는 PvP 300승("투기장의 지배자"),
    -- 10차는 전체 스테이지 클리어("차원의 정복자"). level_180은 더 이상 게이팅에 안 쓰임.
    v_required_achievement := case p_tier when 8 then 'pvp_win_300' when 9 then 'power_1m' when 10 then 'stage_clear_1000' else null end;

    select coalesce(highest_floor, 0) into v_tower_floor from public.tower_progress where user_id = auth.uid();
    if coalesce(v_tower_floor, 0) < v_required_tower then
      raise exception '무한의 탑 %층 이상 도달해야 합니다. (현재 %층)', v_required_tower, coalesce(v_tower_floor, 0);
    end if;

    if v_required_mission is not null then
      select mission_number into v_mission_number from public.mission_state where user_id = auth.uid();
      if coalesce(v_mission_number, 1) < v_required_mission then
        raise exception '가이드미션을 %개 이상 진행해야 합니다.', v_required_mission;
      end if;
    end if;

    if v_required_achievement is not null then
      select exists(
        select 1 from public.achievement_claims
        where user_id = auth.uid() and achievement_key = v_required_achievement
      ) into v_has_achievement;
      if not v_has_achievement then
        raise exception '필요한 업적을 아직 달성하지 못했습니다.';
      end if;
    end if;
  end if;

  insert into public.job_dungeon_sessions (user_id, owned_monster_id, tier)
  values (auth.uid(), v_monster.id, p_tier)
  returning id into v_session_id;

  return v_session_id;
end;
$$ language plpgsql security definer;
