-- ============================================
-- 151: 전직 8~10차 게이팅 조건 재조정 - 사용자 요청
--
-- 1) 무한의 탑 요구층수 2배, 가이드미션 요구개수 3배 상향(8차 기준값에 적용)
--    8차: 탑60->120, 미션25->75 / 9차: 탑140, 미션90(8차보다 "조금 더") /
--    10차: 탑160, 미션105(9차보다 "조금 더") - 사용자 요청: "9차부턴 8차 기준으로
--    조금 더 필요로하게만" - 기존처럼 매 차수마다 큰 폭으로 벌어지지 않고 완만하게 증가
--
-- 2) 8차 요구업적을 pvp_win_300("투기장의 지배자", PvP 300승)에서 power_100k("압도적인
--    힘", 전투력 10만)로 교체 - 사용자 재확인: "8차전직쯤에 달성할만한 걸로" - PvP 300승은
--    별도의 긴 그라인딩이 필요해 "8차 전직 무렵 자연스럽게 달성" 조건으로는 부적합하다고
--    판단, 레벨/장비가 쌓이면 자연히 오르는 전투력 지표로 교체. pvp_win_300 자체는
--    독립 업적으로 그대로 유지(게이팅에서만 빠짐).
-- 9차(power_1m)/10차(stage_clear_1000) 요구업적은 그대로 유지(9/10차 업적이 없는 게
-- 아니라 이미 있었음 - 사용자 재확인 결과 정상 확인).
--
-- 반환타입 그대로라 DROP FUNCTION 불필요. 클라이언트(lib/jobDungeon.js)와 동기화 유지할 것.
-- ============================================

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
    -- (수정) 8~10차 탑/미션 요구치 상향(8차 기준 탑2배/미션3배) + 9~10차는 8차 대비 완만한 증가
    v_required_tower := case p_tier when 6 then 20 when 7 then 40 when 8 then 120 when 9 then 140 when 10 then 160 end;
    v_required_mission := case p_tier when 7 then 15 when 8 then 75 when 9 then 90 when 10 then 105 else null end;
    -- (수정) 8차 요구업적 pvp_win_300 -> power_100k로 교체(전투력10만, "8차전직쯤 달성할만한" 지표)
    v_required_achievement := case p_tier when 8 then 'power_100k' when 9 then 'power_1m' when 10 then 'stage_clear_1000' else null end;

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
