-- ============================================
-- 065: 친구 추천 시스템 (신규 콘텐츠)
-- 가입 후 24시간 이내에 딱 1번, 다른 유저(추천인)의 닉네임을 입력해서 "이 사람이 나를 추천했다"고
-- 등록할 수 있음. 추천받은 유저가 레벨10 업적을 달성하면(=실제로 플레이를 시작했다는 신호),
-- 추천인에게 골드 보너스 우편이 감. handle_new_user 트리거는 건드리지 않고 별도 RPC로 처리해서
-- 회원가입 자체의 안정성에 영향 없게 함.
--
-- 악용 방지 장치:
-- 1. 가입 후 24시간 이내에만 설정 가능(오래된 계정이 뒤늦게 추천인을 붙이는 것 방지)
-- 2. 한 번 설정하면 변경 불가(재시도 남용 방지)
-- 3. 자기 자신을 추천인으로 못 넣음
-- 4. 추천 보너스는 "추천받은 유저가 실제로 레벨10을 찍었을 때"만 지급(단순 가입만으로는 안 나감)
-- 5. mails.source_key 유니크 제약으로 중복 지급 방지
-- (완전한 멀티 계정 어뷰징 방지는 이메일 인증 등 이 프로젝트 범위 밖의 인프라가 필요해서
--  한계가 있음 - 다만 보상 자체가 크지 않아 실효성 낮은 어뷰징으로 설계함)
-- ============================================

alter table public.profiles add column if not exists referred_by uuid references public.profiles(id);

create or replace function public.set_referrer(p_referrer_nickname text)
returns void as $$
declare
  v_my_created_at timestamptz;
  v_my_referred_by uuid;
  v_referrer_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select created_at, referred_by into v_my_created_at, v_my_referred_by
    from public.profiles where id = auth.uid();

  if v_my_referred_by is not null then
    raise exception '이미 추천인이 등록되어 있어요.';
  end if;
  if now() - v_my_created_at > interval '24 hours' then
    raise exception '가입 후 24시간 이내에만 추천인을 등록할 수 있어요.';
  end if;

  select id into v_referrer_id from public.profiles where nickname = p_referrer_nickname;
  if v_referrer_id is null then
    raise exception '해당 닉네임의 유저를 찾을 수 없어요.';
  end if;
  if v_referrer_id = auth.uid() then
    raise exception '본인을 추천인으로 등록할 수 없어요.';
  end if;

  update public.profiles set referred_by = v_referrer_id where id = auth.uid();
end;
$$ language plpgsql security definer;

-- claim_achievement에 "level_10 달성 시 추천인에게 보너스 지급" 로직 추가.
-- 반환타입(integer) 그대로라 DROP FUNCTION 불필요.
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

    when 'costume_collector' then
      select count(*) into v_costume_count from public.pvp_costume_inventory where user_id = auth.uid();
      v_eligible := v_costume_count >= 5; v_reward := 2000;

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
