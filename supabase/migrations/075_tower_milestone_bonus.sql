-- ============================================
-- 075: 무한의 탑 10층 단위 마일스톤 보너스 (신규 콘텐츠)
-- 10/20/30...층을 "처음" 신기록으로 돌파할 때마다 층수에 비례한 보너스 골드를
-- 축하 우편으로 발송함(챕터 클리어 보너스/던전 완주 보너스와 동일한 설계 패턴).
-- 반환타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.claim_tower_floor(p_session_id uuid)
returns table(gold integer, new_highest_floor integer, is_new_record boolean) as $$
declare
  v_session public.tower_sessions;
  v_prev_highest integer;
  v_gold integer;
  v_is_new_record boolean;
  v_milestone_bonus integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.tower_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null then
    raise exception '유효하지 않은 도전 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 보상을 받은 도전입니다.';
  end if;
  if now() - v_session.created_at < interval '2 seconds' then
    raise exception '너무 빠릅니다. 실제로 전투를 진행해주세요.';
  end if;

  update public.tower_sessions set claimed = true where id = p_session_id;

  select highest_floor into v_prev_highest from public.tower_progress where user_id = auth.uid();
  v_is_new_record := v_session.floor > v_prev_highest;

  v_gold := public.calc_tower_gold(v_session.floor);
  perform public.add_gold(auth.uid(), v_gold);

  if v_is_new_record then
    update public.tower_progress set highest_floor = v_session.floor where user_id = auth.uid();
  end if;

  -- 10층 단위 마일스톤을 처음(신기록으로) 돌파했으면 보너스 우편 발송
  if v_is_new_record and v_session.floor % 10 = 0 then
    v_milestone_bonus := least(1000000, v_session.floor * 800);
    insert into public.mails (user_id, title, body, gold_amount, item_key, source_key)
    values (
      auth.uid(),
      '🗼 무한의 탑 ' || v_session.floor || '층 돌파!',
      '대단해요! 탑의 ' || v_session.floor || '층까지 올라왔어요. 축하 보너스를 받아가세요.',
      v_milestone_bonus,
      null,
      'tower_milestone_' || v_session.floor
    )
    on conflict (user_id, source_key) do nothing;
  end if;

  return query select v_gold, greatest(v_prev_highest, v_session.floor), v_is_new_record;
end;
$$ language plpgsql security definer;
