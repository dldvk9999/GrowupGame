-- ============================================
-- 064: 던전(경험치/골드) 10층 완주 첫 클리어 보너스 (신규 콘텐츠, 063과 동일 패턴)
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
  v_first_full_clear := (v_session.stage = 10) and (coalesce(v_prev_cleared_stage, 0) < 10);

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
      '10층까지 전부 클리어했어요! 대단해요, 이제 10층을 반복 도전할 수 있어요.',
      20000,
      null,
      'dungeon_full_clear_' || v_session.dungeon_type
    )
    on conflict (user_id, source_key) do nothing;
  end if;

  return v_gold;
end;
$$ language plpgsql security definer;
