-- ============================================
-- 086: 던전 완주 축하 보너스 판정을 stage=10 -> stage=500으로 수정 (긴급 버그)
-- 079에서 최고층을 500으로 올렸는데 claim_dungeon_reward의 완주 판정은
-- stage=10에 그대로 남아있어서, 실제로는 10층에서 "완주 축하" 우편이 잘못
-- 발송되고 있었음(진짜 완주는 500층이어야 함). 500층 던전 관련 콘텐츠 작업 중
-- 재검토하다 발견해서 즉시 수정.
-- 반환타입(integer) 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.claim_dungeon_reward(p_session_id uuid)
returns integer as $$
declare
  v_session public.dungeon_sessions;
  v_gold integer;
  v_prev_cleared_stage integer;
  v_first_full_clear boolean;
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

  v_gold := public.calc_dungeon_gold(v_session.dungeon_type, v_session.stage);
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

  return v_gold;
end;
$$ language plpgsql security definer;
