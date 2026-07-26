-- ============================================
-- 149: 경험치/골드 던전 "저장에 실패했어요" 오류 원인 수정 - 사용자 제보
--
-- claim_dungeon_reward의 "세션 생성 후 최소 2초" 안티치트 게이트가, 저층(특히 1층 HP
-- 405 수준)을 충분히 강해진 캐릭터가 스킬 한두 번으로 2초 안에 이겨버리면 걸려서
-- 예외를 던졌음 - 클라이언트(App.jsx handleDungeonClear)는 이 예외를 이제 토스트로
-- 보여주고는 있지만("저장에 실패했어요"), 근본 원인인 게이트 자체는 안 고쳐져 있었음.
-- 전직던전(140에서 3초->1초)/루비던전(1초)과 동일하게 2초->1초로 완화 - 정상적인
-- 빠른 승리는 통과, "즉시 클레임" 같은 명백한 어뷰징은 여전히 차단.
--
-- 반환타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

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
  if now() - v_session.created_at < interval '1 second' then
    -- (수정) 2초 -> 1초로 완화 - 강해진 캐릭터가 저층을 순식간에 이겨서 2초를 못 채워
    -- "저장에 실패했어요" 오류로 보였던 문제(사용자 제보)
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
