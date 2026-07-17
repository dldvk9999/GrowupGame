-- ============================================
-- 044: 043 버그 수정 - equipment_gacha_progress 컬럼명 오타
-- 043에서 equipment_gacha_progress를 조회할 때 실제 컬럼명(total_draws) 대신
-- 존재하지 않는 draws로 잘못 참조해서, 가이드미션 완료 클레임 시
-- "column draws does not exist" 에러가 발생하며 claim_mission_reward 전체가 실패했음.
-- claim_mission_reward를 다시 재정의해서 total_draws로 수정.
-- ============================================

create or replace function public.claim_mission_reward()
returns public.mission_state as $$
declare
  v_row public.mission_state;
  v_monster record;
  v_equipped_count integer;
  v_slot_limit integer;
  v_completed boolean := false;
  v_next_number integer;
  v_next_key text;
  v_next_target integer;
  v_next_reward integer;
  v_next_priority boolean;
  v_rotation integer;
  v_skill_draws integer;
  v_skill_draw_level integer;
  v_equip_draw_level_avg numeric;
  v_combined_draw_level integer;
  v_spend_gold_target integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_row from public.mission_state where user_id = auth.uid();
  if v_row is null then
    raise exception '진행 중인 미션이 없습니다.';
  end if;

  if now() - v_row.assigned_at < interval '20 seconds' then
    raise exception '너무 빠릅니다. 잠시 후 다시 시도해주세요.';
  end if;

  select level, unlocked_job_tier into v_monster
    from public.owned_monsters where user_id = auth.uid() and is_active = true;

  select coalesce(array_length(equipped_skills, 1), 0), coalesce(total_skill_draws, 0)
    into v_equipped_count, v_skill_draws
    from public.profiles where id = auth.uid();

  v_slot_limit := case
    when v_monster.level >= 220 then 10
    when v_monster.level >= 190 then 9
    when v_monster.level >= 160 then 8
    when v_monster.level >= 130 then 7
    when v_monster.level >= 100 then 6
    when v_monster.level >= 75 then 5
    when v_monster.level >= 50 then 4
    when v_monster.level >= 25 then 3
    when v_monster.level >= 10 then 2
    else 1
  end;

  -- 종합 뽑기레벨 = 스킬 뽑기레벨과 4개 장비 슬롯 뽑기레벨 평균의 평균 (둘 다 1~20 범위)
  v_skill_draw_level := least(20, 1 + v_skill_draws / 1000);
  select coalesce(avg(least(20, 1 + total_draws / 1000)), 1) into v_equip_draw_level_avg
    from public.equipment_gacha_progress where user_id = auth.uid();
  v_combined_draw_level := round((v_skill_draw_level + v_equip_draw_level_avg) / 2.0);

  v_spend_gold_target := 100000 * least(5, greatest(1,
    case
      when v_combined_draw_level <= 3 then 1
      when v_combined_draw_level <= 8 then 2
      when v_combined_draw_level <= 12 then 3
      when v_combined_draw_level <= 17 then 4
      else 5
    end
  ));

  if v_row.mission_key = 'job_tier1' then
    v_completed := coalesce(v_monster.unlocked_job_tier, 0) >= 1;
  elsif v_row.mission_key = 'job_tier2' then
    v_completed := coalesce(v_monster.unlocked_job_tier, 0) >= 2;
  elsif v_row.mission_key = 'job_tier3' then
    v_completed := coalesce(v_monster.unlocked_job_tier, 0) >= 3;
  elsif v_row.mission_key = 'job_tier4' then
    v_completed := coalesce(v_monster.unlocked_job_tier, 0) >= 4;
  elsif v_row.mission_key = 'job_tier5' then
    v_completed := coalesce(v_monster.unlocked_job_tier, 0) >= 5;
  elsif v_row.mission_key = 'equip_skill_slot' then
    v_completed := v_equipped_count >= v_slot_limit;
  else
    v_completed := v_row.progress >= v_row.target;
  end if;

  if not v_completed then
    raise exception '아직 미션을 완료하지 않았습니다.';
  end if;

  perform public.add_gold(auth.uid(), v_row.reward_gold);

  v_next_number := v_row.mission_number + 1;

  if v_monster.level >= 30 and coalesce(v_monster.unlocked_job_tier, 0) < 1 then
    v_next_key := 'job_tier1'; v_next_target := 1; v_next_reward := 3000; v_next_priority := true;
  elsif v_monster.level >= 60 and coalesce(v_monster.unlocked_job_tier, 0) < 2 then
    v_next_key := 'job_tier2'; v_next_target := 1; v_next_reward := 6000; v_next_priority := true;
  elsif v_monster.level >= 100 and coalesce(v_monster.unlocked_job_tier, 0) < 3 then
    v_next_key := 'job_tier3'; v_next_target := 1; v_next_reward := 12000; v_next_priority := true;
  elsif v_monster.level >= 140 and coalesce(v_monster.unlocked_job_tier, 0) < 4 then
    v_next_key := 'job_tier4'; v_next_target := 1; v_next_reward := 24000; v_next_priority := true;
  elsif v_monster.level >= 180 and coalesce(v_monster.unlocked_job_tier, 0) < 5 then
    v_next_key := 'job_tier5'; v_next_target := 1; v_next_reward := 40000; v_next_priority := true;
  elsif v_equipped_count < v_slot_limit then
    v_next_key := 'equip_skill_slot'; v_next_target := 1; v_next_reward := 1000; v_next_priority := true;
  else
    v_rotation := v_next_number % 4;
    if v_rotation = 0 then
      v_next_key := 'kill_monsters'; v_next_target := 10; v_next_reward := 800;
    elsif v_rotation = 1 then
      v_next_key := 'spend_gold'; v_next_target := v_spend_gold_target; v_next_reward := round(v_spend_gold_target * 0.01)::integer;
    elsif v_rotation = 2 then
      v_next_key := 'login_minutes'; v_next_target := 1; v_next_reward := 600;
    else
      v_next_key := 'use_skills'; v_next_target := 15; v_next_reward := 700;
    end if;
    v_next_priority := false;
  end if;

  update public.mission_state set
    mission_number = v_next_number,
    mission_key = v_next_key,
    target = v_next_target,
    progress = 0,
    reward_gold = v_next_reward,
    is_priority = v_next_priority,
    updated_at = now(),
    assigned_at = now()
  where user_id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$ language plpgsql security definer;
