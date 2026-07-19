-- ============================================
-- 100: 이번 주 행운의 던전 (신규 던전 콘텐츠) - 최신 아이들/방치형 게임들의 "주간
-- 로테이션 이벤트" 트렌드를 이 게임 구조에 안전하게 맞춰 적용함. 매주 서버가
-- 결정론적으로(extract(week from now())의 홀짝) 경험치/골드 던전 중 하나를
-- "이번 주 행운의 던전"으로 선정 - 그 던전에서 클리어 시 골드 보상이 1.5배.
-- 별도 상태 테이블/시딩 없이 순수 계산이라 저장소 추가나 주간 초기화 작업이
-- 전혀 필요 없음(월요일이 되면 저절로 다음 주차로 넘어감). 다른 유저와 항상
-- 동일한 계산 결과라 클라이언트가 조작할 수 없음.
-- 반환 타입에 is_lucky_week 추가되어 DROP FUNCTION 선행 필요.
-- ============================================

drop function if exists public.claim_dungeon_reward(uuid);

create or replace function public.claim_dungeon_reward(p_session_id uuid)
returns table(gold integer, is_elite boolean, combo_bonus integer, is_lucky_week boolean) as $$
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

  -- 이번 주 행운의 던전: 매주 서버가 결정론적으로(주차 홀짝) exp/gold 중 하나를 선정,
  -- 별도 테이블 없이 extract(week from now())만으로 계산 가능해서 상태 저장 불필요.
  -- 다른 유저와도 항상 동일한 주차 기준이라 클라이언트가 조작할 수 없음.
  v_lucky_type := case when mod(extract(week from now())::integer, 2) = 0 then 'gold' else 'exp' end;
  v_is_lucky_week := (v_session.dungeon_type = v_lucky_type);

  v_is_elite := random() < 0.08;
  v_gold := public.calc_dungeon_gold(v_session.dungeon_type, v_session.stage);
  if v_is_lucky_week then
    v_gold := round(v_gold * 1.5);
  end if;
  if v_is_elite then
    v_gold := v_gold * 2;
  end if;
  -- calc_dungeon_gold 자체는 이미 클램프돼있지만(080), 행운(1.5배)/정예(2배) 배율을
  -- 곱한 뒤에는 다시 100만을 넘을 수 있으므로 반드시 최종적으로 한 번 더 클램프함
  -- (정예 없이 행운만 걸려도 150만까지 나올 수 있었던 걸 재검증 중 발견/즉시 수정).
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

  -- 일일 콤보 보너스: 오늘(오전 8시 기준) 이 던전타입에서 "실제로 클리어(수령)"한
  -- 세션이 정확히 3개가 된 순간(=오늘 입장권을 전부 승리로 소진한 순간) 지급
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

  return query select v_gold, v_is_elite, v_combo_bonus, v_is_lucky_week;
end;
$$ language plpgsql security definer;

-- 던전 선택 화면에서 "이번 주 행운의 던전"을 미리 보여주기 위한 조회 전용 함수.
-- claim_dungeon_reward 안의 판정식과 정확히 동일해야 함(하나를 바꾸면 반드시 같이 바꿀 것).
create or replace function public.fetch_lucky_dungeon_type()
returns text as $$
begin
  return case when mod(extract(week from now())::integer, 2) = 0 then 'gold' else 'exp' end;
end;
$$ language plpgsql stable;
