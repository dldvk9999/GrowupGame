-- ============================================
-- 152: 업적 대량 확장 - 사용자 요청("총 업적 약 200개 가까이")
--
-- 기존 55개 업적에 143개를 추가해서 총 198개로 확장함. 새 카테고리를 만들지 않고
-- 전부 기존 stat(레벨/전직차수/스테이지클리어/뽑기횟수/PvP승수/복수전승수/누적골드/
-- 월드보스누적피해/장비종류수/유물보유수/유물최고강화/장비최고강화/코스튬수/전투력/
-- 던전깊이/추천인수/출석일수/무한의탑최고층)의 중간 단계를 촘촘하게 채우는 방식으로
-- 확장함 - 서버가 이미 계산해두고 있는 변수를 그대로 재사용할 수 있어 안전하고,
-- 유저 입장에서도 "다음 목표가 너무 멀지 않은" 자연스러운 성장 곡선이 됨.
--
-- claim_achievement 재정의(반환타입 그대로, DROP 불필요) - 신규 CASE 분기 143개 추가.
-- 클라이언트(lib/achievements.js의 ACHIEVEMENT_CATALOG)와 키/target/reward가 반드시
-- 동일해야 함 - 한쪽만 고치면 UI엔 보이는데 서버가 거부하거나, 서버는 허용하는데
-- UI에 안 뜨는 불일치가 생김.
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


    -- ---- 아래부터 대량 추가된 업적 CASE 분기(사용자 요청 - 총 약 200개로 확장) ----
    when 'level_20' then
      v_eligible := coalesce(v_monster.level, 0) >= 20; v_reward := 1500;

    when 'level_40' then
      v_eligible := coalesce(v_monster.level, 0) >= 40; v_reward := 2500;

    when 'level_50' then
      v_eligible := coalesce(v_monster.level, 0) >= 50; v_reward := 2800;

    when 'level_70' then
      v_eligible := coalesce(v_monster.level, 0) >= 70; v_reward := 4200;

    when 'level_80' then
      v_eligible := coalesce(v_monster.level, 0) >= 80; v_reward := 4800;

    when 'level_90' then
      v_eligible := coalesce(v_monster.level, 0) >= 90; v_reward := 5500;

    when 'level_110' then
      v_eligible := coalesce(v_monster.level, 0) >= 110; v_reward := 7000;

    when 'level_120' then
      v_eligible := coalesce(v_monster.level, 0) >= 120; v_reward := 8000;

    when 'level_150' then
      v_eligible := coalesce(v_monster.level, 0) >= 150; v_reward := 12000;

    when 'level_160' then
      v_eligible := coalesce(v_monster.level, 0) >= 160; v_reward := 13500;

    when 'level_170' then
      v_eligible := coalesce(v_monster.level, 0) >= 170; v_reward := 15000;

    when 'level_190' then
      v_eligible := coalesce(v_monster.level, 0) >= 190; v_reward := 22000;

    when 'level_200' then
      v_eligible := coalesce(v_monster.level, 0) >= 200; v_reward := 24000;

    when 'level_220' then
      v_eligible := coalesce(v_monster.level, 0) >= 220; v_reward := 30000;

    when 'level_250' then
      v_eligible := coalesce(v_monster.level, 0) >= 250; v_reward := 38000;

    when 'level_280' then
      v_eligible := coalesce(v_monster.level, 0) >= 280; v_reward := 45000;

    when 'level_300' then
      v_eligible := coalesce(v_monster.level, 0) >= 300; v_reward := 55000;

    when 'level_350' then
      v_eligible := coalesce(v_monster.level, 0) >= 350; v_reward := 75000;

    when 'level_400' then
      v_eligible := coalesce(v_monster.level, 0) >= 400; v_reward := 95000;

    when 'level_450' then
      v_eligible := coalesce(v_monster.level, 0) >= 450; v_reward := 120000;

    when 'level_500' then
      v_eligible := coalesce(v_monster.level, 0) >= 500; v_reward := 150000;

    when 'job_tier_2' then
      v_eligible := coalesce(v_monster.unlocked_job_tier, 0) >= 2; v_reward := 2500;

    when 'job_tier_4' then
      v_eligible := coalesce(v_monster.unlocked_job_tier, 0) >= 4; v_reward := 9000;

    when 'job_tier_6' then
      v_eligible := coalesce(v_monster.unlocked_job_tier, 0) >= 6; v_reward := 28000;

    when 'job_tier_7' then
      v_eligible := coalesce(v_monster.unlocked_job_tier, 0) >= 7; v_reward := 42000;

    when 'job_tier_8' then
      v_eligible := coalesce(v_monster.unlocked_job_tier, 0) >= 8; v_reward := 60000;

    when 'job_tier_9' then
      v_eligible := coalesce(v_monster.unlocked_job_tier, 0) >= 9; v_reward := 80000;

    when 'stage_clear_25' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 25; v_reward := 800;

    when 'stage_clear_50' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 50; v_reward := 1500;

    when 'stage_clear_150' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 150; v_reward := 4500;

    when 'stage_clear_200' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 200; v_reward := 6000;

    when 'stage_clear_300' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 300; v_reward := 9000;

    when 'stage_clear_400' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 400; v_reward := 13000;

    when 'stage_clear_600' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 600; v_reward := 22000;

    when 'stage_clear_700' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 700; v_reward := 27000;

    when 'stage_clear_800' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 800; v_reward := 32000;

    when 'stage_clear_900' then
      select count(*) into v_stage_cleared_count from public.stage_progress where user_id = auth.uid() and cleared;
      v_eligible := v_stage_cleared_count >= 900; v_reward := 36000;

    when 'gacha_250' then
      select coalesce(p.total_skill_draws, 0) + coalesce((select sum(total_draws) from public.equipment_gacha_progress where user_id = auth.uid()), 0)
        into v_total_gacha_draws from public.profiles p where p.id = auth.uid();
      v_eligible := v_total_gacha_draws >= 250; v_reward := 1300;

    when 'gacha_500' then
      select coalesce(p.total_skill_draws, 0) + coalesce((select sum(total_draws) from public.equipment_gacha_progress where user_id = auth.uid()), 0)
        into v_total_gacha_draws from public.profiles p where p.id = auth.uid();
      v_eligible := v_total_gacha_draws >= 500; v_reward := 2200;

    when 'gacha_2000' then
      select coalesce(p.total_skill_draws, 0) + coalesce((select sum(total_draws) from public.equipment_gacha_progress where user_id = auth.uid()), 0)
        into v_total_gacha_draws from public.profiles p where p.id = auth.uid();
      v_eligible := v_total_gacha_draws >= 2000; v_reward := 8000;

    when 'gacha_3000' then
      select coalesce(p.total_skill_draws, 0) + coalesce((select sum(total_draws) from public.equipment_gacha_progress where user_id = auth.uid()), 0)
        into v_total_gacha_draws from public.profiles p where p.id = auth.uid();
      v_eligible := v_total_gacha_draws >= 3000; v_reward := 11000;

    when 'gacha_7500' then
      select coalesce(p.total_skill_draws, 0) + coalesce((select sum(total_draws) from public.equipment_gacha_progress where user_id = auth.uid()), 0)
        into v_total_gacha_draws from public.profiles p where p.id = auth.uid();
      v_eligible := v_total_gacha_draws >= 7500; v_reward := 16000;

    when 'gacha_10000' then
      select coalesce(p.total_skill_draws, 0) + coalesce((select sum(total_draws) from public.equipment_gacha_progress where user_id = auth.uid()), 0)
        into v_total_gacha_draws from public.profiles p where p.id = auth.uid();
      v_eligible := v_total_gacha_draws >= 10000; v_reward := 28000;

    when 'gacha_15000' then
      select coalesce(p.total_skill_draws, 0) + coalesce((select sum(total_draws) from public.equipment_gacha_progress where user_id = auth.uid()), 0)
        into v_total_gacha_draws from public.profiles p where p.id = auth.uid();
      v_eligible := v_total_gacha_draws >= 15000; v_reward := 35000;

    when 'gacha_20000' then
      select coalesce(p.total_skill_draws, 0) + coalesce((select sum(total_draws) from public.equipment_gacha_progress where user_id = auth.uid()), 0)
        into v_total_gacha_draws from public.profiles p where p.id = auth.uid();
      v_eligible := v_total_gacha_draws >= 20000; v_reward := 45000;

    when 'pvp_win_5' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 5; v_reward := 700;

    when 'pvp_win_25' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 25; v_reward := 3200;

    when 'pvp_win_75' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 75; v_reward := 9500;

    when 'pvp_win_150' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 150; v_reward := 16000;

    when 'pvp_win_200' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 200; v_reward := 20000;

    when 'pvp_win_250' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 250; v_reward := 30000;

    when 'pvp_win_400' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 400; v_reward := 45000;

    when 'pvp_win_500' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 500; v_reward := 60000;

    when 'pvp_win_750' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 750; v_reward := 80000;

    when 'pvp_win_1000' then
      select pvp_wins into v_pvp_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_wins, 0) >= 1000; v_reward := 120000;

    when 'pvp_revenge_1' then
      select pvp_revenge_wins into v_pvp_revenge_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_revenge_wins, 0) >= 1; v_reward := 400;

    when 'pvp_revenge_5' then
      select pvp_revenge_wins into v_pvp_revenge_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_revenge_wins, 0) >= 5; v_reward := 2000;

    when 'pvp_revenge_25' then
      select pvp_revenge_wins into v_pvp_revenge_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_revenge_wins, 0) >= 25; v_reward := 9000;

    when 'pvp_revenge_50' then
      select pvp_revenge_wins into v_pvp_revenge_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_revenge_wins, 0) >= 50; v_reward := 16000;

    when 'pvp_revenge_100' then
      select pvp_revenge_wins into v_pvp_revenge_wins from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_pvp_revenge_wins, 0) >= 100; v_reward := 28000;

    when 'lifetime_gold_100000' then
      select lifetime_gold_earned into v_lifetime_gold from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_lifetime_gold, 0) >= 100000; v_reward := 300;

    when 'lifetime_gold_5000000' then
      select lifetime_gold_earned into v_lifetime_gold from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_lifetime_gold, 0) >= 5000000; v_reward := 4000;

    when 'lifetime_gold_10000000' then
      select lifetime_gold_earned into v_lifetime_gold from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_lifetime_gold, 0) >= 10000000; v_reward := 7000;

    when 'lifetime_gold_20000000' then
      select lifetime_gold_earned into v_lifetime_gold from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_lifetime_gold, 0) >= 20000000; v_reward := 10000;

    when 'lifetime_gold_100000000' then
      select lifetime_gold_earned into v_lifetime_gold from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_lifetime_gold, 0) >= 100000000; v_reward := 22000;

    when 'lifetime_gold_200000000' then
      select lifetime_gold_earned into v_lifetime_gold from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_lifetime_gold, 0) >= 200000000; v_reward := 32000;

    when 'lifetime_gold_300000000' then
      select lifetime_gold_earned into v_lifetime_gold from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_lifetime_gold, 0) >= 300000000; v_reward := 42000;

    when 'lifetime_gold_1000000000' then
      select lifetime_gold_earned into v_lifetime_gold from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_lifetime_gold, 0) >= 1000000000; v_reward := 75000;

    when 'lifetime_gold_2000000000' then
      select lifetime_gold_earned into v_lifetime_gold from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_lifetime_gold, 0) >= 2000000000; v_reward := 110000;

    when 'lifetime_gold_5000000000' then
      select lifetime_gold_earned into v_lifetime_gold from public.profiles where id = auth.uid();
      v_eligible := coalesce(v_lifetime_gold, 0) >= 5000000000; v_reward := 170000;

    when 'worldboss_damage_1000000' then
      select coalesce(sum(total_damage), 0) >= 1000000 into v_eligible from public.world_boss_contributions where user_id = auth.uid();
      v_reward := 700;

    when 'worldboss_damage_5000000' then
      select coalesce(sum(total_damage), 0) >= 5000000 into v_eligible from public.world_boss_contributions where user_id = auth.uid();
      v_reward := 2500;

    when 'worldboss_damage_10000000' then
      select coalesce(sum(total_damage), 0) >= 10000000 into v_eligible from public.world_boss_contributions where user_id = auth.uid();
      v_reward := 4500;

    when 'worldboss_damage_50000000' then
      select coalesce(sum(total_damage), 0) >= 50000000 into v_eligible from public.world_boss_contributions where user_id = auth.uid();
      v_reward := 14000;

    when 'worldboss_damage_100000000' then
      select coalesce(sum(total_damage), 0) >= 100000000 into v_eligible from public.world_boss_contributions where user_id = auth.uid();
      v_reward := 24000;

    when 'worldboss_damage_150000000' then
      select coalesce(sum(total_damage), 0) >= 150000000 into v_eligible from public.world_boss_contributions where user_id = auth.uid();
      v_reward := 32000;

    when 'worldboss_damage_200000000' then
      select coalesce(sum(total_damage), 0) >= 200000000 into v_eligible from public.world_boss_contributions where user_id = auth.uid();
      v_reward := 38000;

    when 'worldboss_damage_500000000' then
      select coalesce(sum(total_damage), 0) >= 500000000 into v_eligible from public.world_boss_contributions where user_id = auth.uid();
      v_reward := 70000;

    when 'worldboss_damage_600000000' then
      select coalesce(sum(total_damage), 0) >= 600000000 into v_eligible from public.world_boss_contributions where user_id = auth.uid();
      v_reward := 82000;

    when 'worldboss_damage_1000000000' then
      select coalesce(sum(total_damage), 0) >= 1000000000 into v_eligible from public.world_boss_contributions where user_id = auth.uid();
      v_reward := 130000;

    when 'equip_collection_5' then
      select count(distinct item_key) into v_unique_items from public.user_inventory where user_id = auth.uid();
      v_eligible := coalesce(v_unique_items, 0) >= 5; v_reward := 1800;

    when 'equip_collection_15' then
      select count(distinct item_key) into v_unique_items from public.user_inventory where user_id = auth.uid();
      v_eligible := coalesce(v_unique_items, 0) >= 15; v_reward := 12000;

    when 'relic_collector_5' then
      select count(*) into v_relic_count from public.user_relics where user_id = auth.uid();
      v_eligible := coalesce(v_relic_count, 0) >= 5; v_reward := 1000;

    when 'relic_collector_10' then
      select count(*) into v_relic_count from public.user_relics where user_id = auth.uid();
      v_eligible := coalesce(v_relic_count, 0) >= 10; v_reward := 2500;

    when 'relic_collector_30' then
      select count(*) into v_relic_count from public.user_relics where user_id = auth.uid();
      v_eligible := coalesce(v_relic_count, 0) >= 30; v_reward := 12000;

    when 'relic_collector_40' then
      select count(*) into v_relic_count from public.user_relics where user_id = auth.uid();
      v_eligible := coalesce(v_relic_count, 0) >= 40; v_reward := 20000;

    when 'relic_collector_50' then
      select count(*) into v_relic_count from public.user_relics where user_id = auth.uid();
      v_eligible := coalesce(v_relic_count, 0) >= 50; v_reward := 35000;

    when 'relic_master_25' then
      select max(level) into v_max_relic_level from public.user_relics where user_id = auth.uid();
      v_eligible := coalesce(v_max_relic_level, 0) >= 25; v_reward := 3000;

    when 'relic_master_50' then
      select max(level) into v_max_relic_level from public.user_relics where user_id = auth.uid();
      v_eligible := coalesce(v_max_relic_level, 0) >= 50; v_reward := 7000;

    when 'relic_master_75' then
      select max(level) into v_max_relic_level from public.user_relics where user_id = auth.uid();
      v_eligible := coalesce(v_max_relic_level, 0) >= 75; v_reward := 13000;

    when 'relic_master_100' then
      select max(level) into v_max_relic_level from public.user_relics where user_id = auth.uid();
      v_eligible := coalesce(v_max_relic_level, 0) >= 100; v_reward := 20000;

    when 'relic_master_150' then
      select max(level) into v_max_relic_level from public.user_relics where user_id = auth.uid();
      v_eligible := coalesce(v_max_relic_level, 0) >= 150; v_reward := 27000;

    when 'max_enhance_100' then
      select exists(select 1 from public.user_inventory where user_id = auth.uid() and enhance_level >= 100) into v_eligible;
      v_reward := 3000;

    when 'max_enhance_300' then
      select exists(select 1 from public.user_inventory where user_id = auth.uid() and enhance_level >= 300) into v_eligible;
      v_reward := 9000;

    when 'max_enhance_500' then
      select exists(select 1 from public.user_inventory where user_id = auth.uid() and enhance_level >= 500) into v_eligible;
      v_reward := 16000;

    when 'max_enhance_700' then
      select exists(select 1 from public.user_inventory where user_id = auth.uid() and enhance_level >= 700) into v_eligible;
      v_reward := 22000;

    when 'costume_collector_1' then
      select count(*) into v_costume_count from public.pvp_costume_inventory where user_id = auth.uid();
      v_eligible := v_costume_count >= 1; v_reward := 500;

    when 'costume_collector_10' then
      select count(*) into v_costume_count from public.pvp_costume_inventory where user_id = auth.uid();
      v_eligible := v_costume_count >= 10; v_reward := 4000;

    when 'costume_collector_15' then
      select count(*) into v_costume_count from public.pvp_costume_inventory where user_id = auth.uid();
      v_eligible := v_costume_count >= 15; v_reward := 7000;

    when 'power_1000' then
      v_eligible := public.fetch_my_combat_power() >= 1000; v_reward := 500;

    when 'power_5000' then
      v_eligible := public.fetch_my_combat_power() >= 5000; v_reward := 1800;

    when 'power_50000' then
      v_eligible := public.fetch_my_combat_power() >= 50000; v_reward := 7000;

    when 'power_300000' then
      v_eligible := public.fetch_my_combat_power() >= 300000; v_reward := 20000;

    when 'power_500000' then
      v_eligible := public.fetch_my_combat_power() >= 500000; v_reward := 32000;

    when 'power_3000000' then
      v_eligible := public.fetch_my_combat_power() >= 3000000; v_reward := 65000;

    when 'power_5000000' then
      v_eligible := public.fetch_my_combat_power() >= 5000000; v_reward := 85000;

    when 'power_10000000' then
      v_eligible := public.fetch_my_combat_power() >= 10000000; v_reward := 120000;

    when 'power_50000000' then
      v_eligible := public.fetch_my_combat_power() >= 50000000; v_reward := 160000;

    when 'power_100000000' then
      v_eligible := public.fetch_my_combat_power() >= 100000000; v_reward := 200000;

    when 'dungeon_depth_10' then
      select bool_or(cleared_stage >= 10) into v_eligible from public.dungeon_progress where user_id = auth.uid();
      v_reward := 500;

    when 'dungeon_depth_50' then
      select bool_or(cleared_stage >= 50) into v_eligible from public.dungeon_progress where user_id = auth.uid();
      v_reward := 2200;

    when 'dungeon_depth_150' then
      select bool_or(cleared_stage >= 150) into v_eligible from public.dungeon_progress where user_id = auth.uid();
      v_reward := 7000;

    when 'dungeon_depth_200' then
      select bool_or(cleared_stage >= 200) into v_eligible from public.dungeon_progress where user_id = auth.uid();
      v_reward := 9500;

    when 'dungeon_depth_250' then
      select bool_or(cleared_stage >= 250) into v_eligible from public.dungeon_progress where user_id = auth.uid();
      v_reward := 12000;

    when 'dungeon_depth_350' then
      select bool_or(cleared_stage >= 350) into v_eligible from public.dungeon_progress where user_id = auth.uid();
      v_reward := 25000;

    when 'dungeon_depth_400' then
      select bool_or(cleared_stage >= 400) into v_eligible from public.dungeon_progress where user_id = auth.uid();
      v_reward := 35000;

    when 'dungeon_depth_450' then
      select bool_or(cleared_stage >= 450) into v_eligible from public.dungeon_progress where user_id = auth.uid();
      v_reward := 55000;

    when 'referral_1' then
      select count(*) >= 1 into v_eligible from public.profiles where referred_by = auth.uid();
      v_reward := 1000;

    when 'referral_3' then
      select count(*) >= 3 into v_eligible from public.profiles where referred_by = auth.uid();
      v_reward := 2500;

    when 'referral_10' then
      select count(*) >= 10 into v_eligible from public.profiles where referred_by = auth.uid();
      v_reward := 8000;

    when 'referral_15' then
      select count(*) >= 15 into v_eligible from public.profiles where referred_by = auth.uid();
      v_reward := 13000;

    when 'referral_30' then
      select count(*) >= 30 into v_eligible from public.profiles where referred_by = auth.uid();
      v_reward := 32000;

    when 'referral_50' then
      select count(*) >= 50 into v_eligible from public.profiles where referred_by = auth.uid();
      v_reward := 55000;

    when 'attendance_3' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 3; v_reward := 800;

    when 'attendance_14' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 14; v_reward := 3500;

    when 'attendance_50' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 50; v_reward := 15000;

    when 'attendance_75' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 75; v_reward := 22000;

    when 'attendance_150' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 150; v_reward := 40000;

    when 'attendance_250' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 250; v_reward := 70000;

    when 'attendance_300' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 300; v_reward := 90000;

    when 'attendance_500' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 500; v_reward := 150000;

    when 'attendance_730' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 730; v_reward := 220000;

    when 'tower_5' then
      select coalesce(highest_floor, 0) >= 5 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 1500;

    when 'tower_15' then
      select coalesce(highest_floor, 0) >= 15 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 6000;

    when 'tower_20' then
      select coalesce(highest_floor, 0) >= 20 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 8500;

    when 'tower_40' then
      select coalesce(highest_floor, 0) >= 40 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 18000;

    when 'tower_50' then
      select coalesce(highest_floor, 0) >= 50 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 25000;

    when 'tower_60' then
      select coalesce(highest_floor, 0) >= 60 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 32000;

    when 'tower_70' then
      select coalesce(highest_floor, 0) >= 70 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 40000;

    when 'tower_80' then
      select coalesce(highest_floor, 0) >= 80 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 48000;

    when 'tower_90' then
      select coalesce(highest_floor, 0) >= 90 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 55000;

    when 'tower_150' then
      select coalesce(highest_floor, 0) >= 150 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 90000;

    when 'tower_200' then
      select coalesce(highest_floor, 0) >= 200 into v_eligible from public.tower_progress where user_id = auth.uid();
      v_reward := 130000;

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

