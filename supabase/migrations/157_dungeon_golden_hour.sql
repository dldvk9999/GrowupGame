-- ============================================
-- 157: 경험치/골드 던전 "골든타임" 보너스 - 신규 콘텐츠
-- 매일 저녁 정해진 시간대(한국시간 20:00~21:00)에 접속을 유도하는 "해피아워"형
-- 보너스. 요일 보너스(121)/주간 행운(100)이 "날짜" 단위였다면, 이건 "하루 중 특정
-- 시각" 단위로 더 촘촘하게 재방문을 유도함 - 방치형 게임에서 흔한 "정시 접속 유도"
-- 패턴을 최소 구현(별도 테이블/스케줄러 없이 시각 판정만으로 켜고 끔, 100/121과
-- 동일한 설계 철학).
--
-- claim_dungeon_reward 반환 컬럼에 is_golden_hour 추가 -> DROP FUNCTION 선행 필요.
-- ============================================

drop function if exists public.claim_dungeon_reward(uuid);

create or replace function public.claim_dungeon_reward(p_session_id uuid)
returns table(gold integer, is_elite boolean, combo_bonus integer, is_lucky_week boolean, is_daily_bonus boolean, is_golden_hour boolean) as $$
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
  v_kst_hour integer;
  v_is_golden_hour boolean;
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
  if now() - v_session.created_at < interval '1 second' then
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

  -- 골든타임 판정 (한국시간 20시대, 즉 20:00:00~20:59:59) - fetch_golden_hour_active()와
  -- 반드시 동일 판정식 유지할 것(100/121과 동일한 이중관리 주의사항)
  v_kst_hour := extract(hour from (now() at time zone 'Asia/Seoul'))::integer;
  v_is_golden_hour := (v_kst_hour = 20);

  v_is_elite := random() < 0.08;
  v_gold := public.calc_dungeon_gold(v_session.dungeon_type, v_session.stage);
  if v_is_lucky_week then
    v_gold := round(v_gold * 1.5);
  end if;
  if v_is_daily_bonus then
    v_gold := round(v_gold * 1.3);
  end if;
  if v_is_golden_hour then
    v_gold := round(v_gold * 1.4);
  end if;
  if v_is_elite then
    v_gold := v_gold * 2;
  end if;
  -- 여러 배율(행운/요일/골든타임/정예)이 전부 겹치면 최대 5.46배까지 가능 - 모든 배율을
  -- 곱한 뒤 반드시 마지막에 한 번 더 클램프(121에서 겪었던 "일부 경로만 클램프 누락"
  -- 실수 클래스를 다시 밟지 않도록, 개별 클램프 대신 최종 클램프 하나만 사용)
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

  return query select v_gold, v_is_elite, v_combo_bonus, v_is_lucky_week, v_is_daily_bonus, v_is_golden_hour;
end;
$$ language plpgsql security definer;

/** 지금이 골든타임(한국시간 20시대)인지 조회 - 선택 화면 배너용, claim_dungeon_reward의 판정식과 동일하게 유지할 것 */
create or replace function public.fetch_golden_hour_active()
returns boolean as $$
begin
  return extract(hour from (now() at time zone 'Asia/Seoul'))::integer = 20;
end;
$$ language plpgsql stable;
