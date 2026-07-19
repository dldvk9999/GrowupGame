-- ============================================
-- 098: 던전 일일 콤보 보너스 (신규 던전 콘텐츠)
-- 하루 3회 던전 입장권을 전부 "클리어"(입장만이 아니라 실제로 이겨서 보상까지
-- 수령)하면 추가 콤보 보너스 골드를 즉시 지급함. "입장 횟수"(dungeon_attempts,
-- 패배해도 증가)가 아니라 "오늘 실제로 클리어해서 보상을 수령한 세션 수"
-- (dungeon_sessions에서 claimed=true인 오늘자 행 개수)로 정확히 판정 - 입장만
-- 하고 못 이긴 경우는 카운트되지 않음. 던전 시스템 전체와 동일하게 매일 오전
-- 8시(서울시간) 기준으로 하루를 구분함(use_dungeon_attempt와 동일 공식).
-- 반환 타입이 table(gold, is_elite) -> table(gold, is_elite, combo_bonus)로
-- 바뀌어서 DROP FUNCTION 선행 필요.
-- ============================================

drop function if exists public.claim_dungeon_reward(uuid);

create or replace function public.claim_dungeon_reward(p_session_id uuid)
returns table(gold integer, is_elite boolean, combo_bonus integer) as $$
declare
  v_session public.dungeon_sessions;
  v_gold integer;
  v_prev_cleared_stage integer;
  v_first_full_clear boolean;
  v_is_elite boolean;
  v_today date;
  v_today_claimed_count integer;
  v_combo_bonus integer := 0;
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

  v_is_elite := random() < 0.08;
  v_gold := public.calc_dungeon_gold(v_session.dungeon_type, v_session.stage);
  if v_is_elite then
    v_gold := least(1000000, v_gold * 2);
  end if;

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

  return query select v_gold, v_is_elite, v_combo_bonus;
end;
$$ language plpgsql security definer;
