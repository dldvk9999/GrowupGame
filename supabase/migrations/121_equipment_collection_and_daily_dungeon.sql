-- ============================================
-- 121: 장비 컬렉션북 업적 + 요일별 던전 보너스 확장 - 신규 콘텐츠(사용자 요청)
--
-- [장비 컬렉션북] user_inventory는 판매/삭제 경로가 없어(equipment.md) 한번 얻은
-- item_key는 영구히 남음 - 즉 "역대 보유한 고유 아이템 종류 수"가 이미 그대로
-- count(distinct item_key)로 추적되고 있었음. 새 테이블 없이 업적 2종만 추가:
-- 절반 수집(10/20)과 완전 수집(20/20, 4슬롯×5등급 전부).
--
-- [요일별 던전 보너스] 기존 100(주간 행운의 던전)은 "이번 주 내내 같은 던전이 1.5배"였는데,
-- 매일 다른 요일마다 다른 보상 타입에 보너스를 주는 "일간" 버전을 추가해서 더 자주
-- 바뀌는 느낌을 줌. 주간 행운 던전과 중첩 가능(둘 다 곱연산, 최종 사냥 클램프 있음).
--
-- claim_achievement는 반환타입 그대로(DROP 불필요). claim_dungeon_reward는 반환타입
-- 그대로지만 로직이 커져서 diff 재검증 필요(100 최신본 기준 재정의, DROP 불필요).
-- ============================================

-- claim_achievement에 장비 컬렉션 업적 2종 CASE만 추가 (114 기준 재정의)
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

-- ============================================
-- 요일별 던전 보너스 (신규 던전 콘텐츠) - 100(주간 행운의 던전)이 "이번 주 내내
-- 같은 던전"이라면, 이건 "오늘 하루만" 다른 보상 타입에 붙는 보너스라 매일 바뀌는
-- 느낌을 줌. 월/목=골드던전, 화/금=경험치던전 +30%, 수/토/일은 요일보너스 없음
-- (주말은 이미 자동사냥 골드 1.5배가 따로 있어서 매일 중첩시키지 않음, 105 참고).
-- 100과 마찬가지로 순수 계산이라 별도 테이블/초기화 불필요, 클라이언트 조작 불가.
-- 반환 타입에 is_daily_bonus 추가되어 DROP FUNCTION 필요.
-- ============================================

drop function if exists public.claim_dungeon_reward(uuid);

create or replace function public.claim_dungeon_reward(p_session_id uuid)
returns table(gold integer, is_elite boolean, combo_bonus integer, is_lucky_week boolean, is_daily_bonus boolean) as $$
declare
  v_session public.dungeon_sessions;
  v_gold integer;
  v_prev_cleared_stage integer;
  v_first_full_clear boolean;
  v_is_elite boolean;
  v_today date;
  v_today_claimed_count integer;
  v_combo_bonus integer := 0;
  v_lucky_type text;
  v_is_lucky_week boolean;
  v_dow integer;
  v_daily_bonus_type text;
  v_is_daily_bonus boolean;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.dungeon_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null then
    raise exception '유효하지 않은 던전 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 보상을 받은 던전입니다.';
  end if;
  if now() - v_session.created_at < interval '2 seconds' then
    raise exception '너무 빠릅니다. 실제로 전투를 진행해주세요.';
  end if;

  update public.dungeon_sessions set claimed = true where id = p_session_id;

  select cleared_stage into v_prev_cleared_stage from public.dungeon_progress
    where user_id = auth.uid() and dungeon_type = v_session.dungeon_type;
  v_first_full_clear := (v_session.stage = 500) and (coalesce(v_prev_cleared_stage, 0) < 500);

  insert into public.dungeon_progress (user_id, dungeon_type, cleared_stage)
  values (auth.uid(), v_session.dungeon_type, v_session.stage)
  on conflict (user_id, dungeon_type) do update
    set cleared_stage = greatest(public.dungeon_progress.cleared_stage, v_session.stage);

  v_lucky_type := case when mod(extract(week from now())::integer, 2) = 0 then 'gold' else 'exp' end;
  v_is_lucky_week := (v_session.dungeon_type = v_lucky_type);

  -- 요일별 보너스 판정 (한국시간 기준, 0=일 ~ 6=토)
  v_dow := extract(dow from (now() at time zone 'Asia/Seoul'))::integer;
  v_daily_bonus_type := case
    when v_dow in (1, 4) then 'gold'  -- 월/목
    when v_dow in (2, 5) then 'exp'   -- 화/금
    else null                          -- 수/토/일: 요일보너스 없음(주말은 자동사냥 골드 보너스가 따로 있음)
  end;
  v_is_daily_bonus := (v_daily_bonus_type is not null and v_session.dungeon_type = v_daily_bonus_type);

  v_is_elite := random() < 0.08;
  v_gold := public.calc_dungeon_gold(v_session.dungeon_type, v_session.stage);
  if v_is_lucky_week then
    v_gold := round(v_gold * 1.5);
  end if;
  if v_is_daily_bonus then
    v_gold := round(v_gold * 1.3);
  end if;
  if v_is_elite then
    v_gold := v_gold * 2;
  end if;
  -- calc_dungeon_gold 자체는 이미 클램프돼있지만(080), 행운/요일보너스/정예 배율을
  -- 다 곱한 뒤에는 다시 100만을 넘을 수 있으므로 반드시 최종적으로 한 번 더 클램프함
  v_gold := least(1000000, v_gold);

  perform public.add_gold(auth.uid(), v_gold);

  if v_first_full_clear then
    insert into public.mails (user_id, title, body, gold_amount, item_key, source_key)
    values (
      auth.uid(),
      '🏰 ' || (case v_session.dungeon_type when 'exp' then '경험치' else '골드' end) || ' 던전 완주 축하!',
      '500층까지 전부 클리어했어요! 대단해요, 이제 500층을 반복 도전할 수 있어요.',
      100000,
      null,
      'dungeon_full_clear_' || v_session.dungeon_type
    )
    on conflict (user_id, source_key) do nothing;
  end if;

  v_today := ((now() at time zone 'Asia/Seoul') - interval '8 hours')::date;
  select count(*) into v_today_claimed_count from public.dungeon_sessions
    where user_id = auth.uid()
      and dungeon_type = v_session.dungeon_type
      and claimed = true
      and ((created_at at time zone 'Asia/Seoul') - interval '8 hours')::date = v_today;

  if v_today_claimed_count = 3 then
    v_combo_bonus := 8000;
    perform public.add_gold(auth.uid(), v_combo_bonus);
  end if;

  return query select v_gold, v_is_elite, v_combo_bonus, v_is_lucky_week, v_is_daily_bonus;
end;
$$ language plpgsql security definer;

-- 던전 선택 화면에서 "오늘의 요일 보너스"를 미리 보여주기 위한 조회 전용 함수.
-- claim_dungeon_reward 안의 판정식과 정확히 동일해야 함(하나를 바꾸면 반드시 같이 바꿀 것).
create or replace function public.fetch_daily_dungeon_bonus_type()
returns text as $$
declare
  v_dow integer;
begin
  v_dow := extract(dow from (now() at time zone 'Asia/Seoul'))::integer;
  return case
    when v_dow in (1, 4) then 'gold'
    when v_dow in (2, 5) then 'exp'
    else null
  end;
end;
$$ language plpgsql stable;
