-- ============================================
-- 178: 시즌 패스(배틀패스형 보상 트랙) 신설 - 신규 콘텐츠(사용자 요청 - 리텐션 강화)
--
-- 매달 자동으로 리셋되는(season_key = 'YYYY-MM') 20단계 보상 트랙. 포인트는 새로운
-- 콤보/타이머를 안 만들고, 이미 있는 "가이드미션 완료"(claim_mission_reward)와
-- "출석체크"(claim_attendance) 두 클레임 액션에 얹어서 지급함 - 둘 다 이미 각자의
-- 안티치트(2초 게이트/하루 1회)가 있어서 새 방지장치가 따로 필요 없음.
--
-- 보상은 골드/루비 소량만 사용(새 재화 없음, 티어당 상한 있음) - 보상표는 클라이언트
-- 표시용으로도 미러링하지만 실제 지급은 이 함수 안의 CASE문이 유일한 권위(클라이언트가
-- 보상 액수를 파라미터로 넘기지 않음 - 넘기면 임의 금액 위조가 가능해지므로 절대 금지).
-- ============================================

create table public.season_pass_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_key text not null, -- 'YYYY-MM'(한국시간 기준), 매달 자동으로 새 행이 생기며 리셋됨
  points integer not null default 0,
  claimed_tiers integer[] not null default '{}',
  primary key (user_id, season_key)
);
alter table public.season_pass_progress enable row level security;
create policy "season_pass_progress는 본인만 조회" on public.season_pass_progress for select using (auth.uid() = user_id);
revoke insert, update, delete on public.season_pass_progress from authenticated;

/** 내부 전용 헬퍼(다른 security definer 함수에서만 호출) - 이번 달 시즌 포인트 적립 */
create or replace function public.grant_season_points(p_amount integer)
returns void as $$
declare
  v_season_key text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
begin
  if auth.uid() is null or p_amount is null or p_amount <= 0 then
    return;
  end if;
  insert into public.season_pass_progress (user_id, season_key, points)
  values (auth.uid(), v_season_key, p_amount)
  on conflict (user_id, season_key) do update
    set points = public.season_pass_progress.points + p_amount;
end;
$$ language plpgsql security definer;
revoke execute on function public.grant_season_points(integer) from public, anon, authenticated;

/** 이번 달 내 시즌 패스 진행도 */
create or replace function public.fetch_my_season_pass()
returns table(season_key text, points integer, claimed_tiers integer[]) as $$
declare
  v_season_key text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
  v_row public.season_pass_progress;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  select * into v_row from public.season_pass_progress
    where user_id = auth.uid() and season_pass_progress.season_key = v_season_key;
  season_key := v_season_key;
  points := coalesce(v_row.points, 0);
  claimed_tiers := coalesce(v_row.claimed_tiers, '{}');
  return next;
end;
$$ language plpgsql stable security definer;

/**
 * 시즌 패스 티어 보상 수령 - 요구 포인트/보상액은 전부 이 함수 안에서만 결정함
 * (클라이언트가 금액을 파라미터로 넘기지 않음 - 위조 방지).
 * 20단계, 필요 포인트는 티어*150 누적, 보상은 5단계마다 루비도 소량 포함.
 */
create or replace function public.claim_season_tier(p_tier integer)
returns table(new_gold integer, new_rubies integer, remaining_points integer) as $$
declare
  v_season_key text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
  v_row public.season_pass_progress;
  v_required integer;
  v_gold integer;
  v_rubies integer;
  v_gold_result integer;
  v_rubies_result integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_tier < 1 or p_tier > 20 then
    raise exception '유효하지 않은 단계입니다.';
  end if;

  select * into v_row from public.season_pass_progress
    where user_id = auth.uid() and season_pass_progress.season_key = v_season_key
    for update;
  if v_row.user_id is null then
    raise exception '아직 시즌 포인트가 없어요.';
  end if;
  if p_tier = any(v_row.claimed_tiers) then
    raise exception '이미 수령한 단계예요.';
  end if;

  v_required := p_tier * 150;
  if v_row.points < v_required then
    raise exception '포인트가 부족해요. (필요: %, 보유: %)', v_required, v_row.points;
  end if;

  -- 보상표(서버 권위) - 5단계마다 루비 포함, 최종(20단계)에 조금 더 후하게
  v_gold := case
    when p_tier = 20 then 6000
    when p_tier % 5 = 0 then 3000
    else 800 + p_tier * 100
  end;
  v_rubies := case
    when p_tier = 20 then 15
    when p_tier % 5 = 0 then 6
    else 0
  end;

  update public.profiles set gold = gold + v_gold, rubies = rubies + v_rubies
    where id = auth.uid()
    returning gold, rubies into v_gold_result, v_rubies_result;

  update public.season_pass_progress
    set claimed_tiers = array_append(claimed_tiers, p_tier)
    where user_id = auth.uid() and season_pass_progress.season_key = v_season_key;

  new_gold := v_gold_result;
  new_rubies := v_rubies_result;
  remaining_points := v_row.points;
  return next;
end;
$$ language plpgsql security definer;

-- claim_attendance(056) 재정의 - 출석체크마다 시즌 포인트 20 지급. 반환타입 그대로, DROP 불필요.
create or replace function public.claim_attendance()
returns table(cycle_day integer, reward_gold integer, streak_broken boolean, total_claim_count integer) as $$
declare
  v_state record;
  v_today date := current_date;
  v_next_day integer;
  v_reward integer;
  v_broken boolean := false;
  v_updated public.attendance_state;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  insert into public.attendance_state (user_id, cycle_day, last_claim_date, total_claim_count)
  values (auth.uid(), 0, null, 0)
  on conflict (user_id) do nothing;

  select * into v_state from public.attendance_state where user_id = auth.uid() for update;

  if v_state.last_claim_date = v_today then
    raise exception '오늘은 이미 출석체크를 했어요.';
  end if;

  if v_state.last_claim_date = v_today - 1 then
    v_next_day := v_state.cycle_day + 1;
    if v_next_day > 7 then v_next_day := 1; end if;
  else
    if v_state.last_claim_date is not null then v_broken := true; end if;
    v_next_day := 1;
  end if;

  v_reward := case v_next_day
    when 1 then 500 when 2 then 800 when 3 then 1200 when 4 then 1800
    when 5 then 2500 when 6 then 3500 else 8000
  end;

  perform public.add_gold(auth.uid(), v_reward);
  perform public.grant_season_points(20); -- (신규) 출석체크마다 시즌 포인트 20

  update public.attendance_state as att set
    cycle_day = v_next_day,
    last_claim_date = v_today,
    total_claim_count = att.total_claim_count + 1
  where att.user_id = auth.uid()
  returning * into v_updated;

  return query select v_next_day, v_reward, v_broken, v_updated.total_claim_count;
end;
$$ language plpgsql security definer;

-- claim_mission_reward(081) 재정의 - 미션 완료마다 시즌 포인트 30 지급. 반환타입 그대로, DROP 불필요.
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

  if now() - v_row.assigned_at < interval '2 seconds' then
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

  v_skill_draw_level := least(50, 1 + v_skill_draws / 1000);
  select coalesce(avg(least(50, 1 + total_draws / 1000)), 1) into v_equip_draw_level_avg
    from public.equipment_gacha_progress where user_id = auth.uid();
  v_combined_draw_level := round((v_skill_draw_level + v_equip_draw_level_avg) / 2.0);

  v_spend_gold_target := 100000 * least(5, greatest(1,
    case
      when v_combined_draw_level <= 8 then 1
      when v_combined_draw_level <= 20 then 2
      when v_combined_draw_level <= 30 then 3
      when v_combined_draw_level <= 43 then 4
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
  perform public.grant_season_points(30); -- (신규) 가이드미션 완료마다 시즌 포인트 30

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
