-- ============================================
-- 059: 업적 1종 추가 - "풀세트 착용" (057 세트효과와 연계)
-- claim_achievement에 CASE 분기만 추가하는 재정의, 반환타입(integer) 그대로라 DROP 불필요.
-- ============================================

create or replace function public.claim_achievement(p_achievement_key text)
returns integer as $$
declare
  v_monster record;
  v_stage_cleared_count integer;
  v_total_gacha_draws integer;
  v_pvp_wins integer;
  v_attendance_total integer;
  v_equipped_slot_count integer;
  v_distinct_rarities integer;
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

    when 'world_boss_participate' then
      v_eligible := exists (select 1 from public.world_boss_contributions where user_id = auth.uid() and total_damage > 0);
      v_reward := 500;

    when 'attendance_week' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 7; v_reward := 2000;
    when 'attendance_month' then
      select total_claim_count into v_attendance_total from public.attendance_state where user_id = auth.uid();
      v_eligible := coalesce(v_attendance_total, 0) >= 30; v_reward := 10000;

    when 'full_set_equipped' then
      select count(distinct slot), count(distinct split_part(item_key, '_', 2))
        into v_equipped_slot_count, v_distinct_rarities
        from public.user_inventory where user_id = auth.uid() and equipped = true;
      v_eligible := (v_equipped_slot_count = 4 and v_distinct_rarities = 1); v_reward := 3000;

    else
      raise exception '알 수 없는 업적입니다.';
  end case;

  if not v_eligible then
    raise exception '아직 달성 조건을 채우지 못했어요.';
  end if;

  perform public.add_gold(auth.uid(), v_reward);
  insert into public.achievement_claims (user_id, achievement_key) values (auth.uid(), p_achievement_key);

  return v_reward;
end;
$$ language plpgsql security definer;
