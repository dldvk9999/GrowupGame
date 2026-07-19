-- ============================================
-- 087: 던전 정예 몬스터 이벤트 (신규 던전 콘텐츠) - 자동사냥의 황금 몬스터(062)와
-- 동일한 설계를 던전(경험치/골드)에도 적용. 던전 클리어마다 서버가 자체적으로
-- 8% 확률을 판정해서, 당첨되면 골드 보상이 2배로 지급됨. 서버가 스스로 랜덤
-- 판정하고 결과만 반환하는 구조라 클라이언트가 조작할 수 없음.
-- 반환 타입이 integer -> table(gold, is_elite)로 바뀌어서 DROP FUNCTION 선행 필요.
-- ============================================

drop function if exists public.claim_dungeon_reward(uuid);

create or replace function public.claim_dungeon_reward(p_session_id uuid)
returns table(gold integer, is_elite boolean) as $$
declare
  v_session public.dungeon_sessions;
  v_gold integer;
  v_prev_cleared_stage integer;
  v_first_full_clear boolean;
  v_is_elite boolean;
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

  return query select v_gold, v_is_elite;
end;
$$ language plpgsql security definer;
