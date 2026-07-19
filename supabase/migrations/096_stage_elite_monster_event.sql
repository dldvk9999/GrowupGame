-- ============================================
-- 096: 스테이지 도전 정예 몬스터 이벤트 (신규 콘텐츠) - 자동사냥(062)/던전(087)에
-- 이미 있는 랜덤 보너스 이벤트를 스테이지 도전(clear_stage)에도 동일하게 적용해서
-- 일관성을 맞춤. 스테이지 클리어마다 서버가 자체적으로 8% 확률을 판정해서,
-- 당첨되면 골드 보상이 2배로 지급됨(챕터 클리어 축하 우편 보너스는 영향 없음,
-- 별도 지급 경로이므로 그대로 유지).
-- 반환 타입이 integer -> table(gold, is_elite)로 바뀌어서 DROP FUNCTION 선행 필요.
-- ============================================

drop function if exists public.clear_stage(integer);

create or replace function public.clear_stage(p_stage_id integer)
returns table(gold integer, is_elite boolean) as $$
declare
  v_prev_cleared boolean;
  v_self_cleared boolean;
  v_chapter integer;
  v_stage integer;
  v_gold integer;
  v_first_clear boolean;
  v_chapter_bonus integer;
  v_is_elite boolean;
begin
  if p_stage_id < 1 or p_stage_id > 1000 then
    raise exception '유효하지 않은 스테이지입니다.';
  end if;

  if p_stage_id > 1 then
    select cleared into v_prev_cleared from public.stage_progress
      where user_id = auth.uid() and stage_id = p_stage_id - 1;
    select cleared into v_self_cleared from public.stage_progress
      where user_id = auth.uid() and stage_id = p_stage_id;
    if coalesce(v_prev_cleared, false) = false and coalesce(v_self_cleared, false) = false then
      raise exception '아직 열리지 않은 스테이지입니다.';
    end if;
  end if;

  select coalesce(cleared, false) into v_self_cleared from public.stage_progress
    where user_id = auth.uid() and stage_id = p_stage_id;
  v_first_clear := coalesce(v_self_cleared, false) = false;

  insert into public.stage_progress (user_id, stage_id, cleared, cleared_at)
  values (auth.uid(), p_stage_id, true, now())
  on conflict (user_id, stage_id) do update set cleared = true, cleared_at = now();

  v_chapter := ((p_stage_id - 1) / 10) + 1;
  v_stage := ((p_stage_id - 1) % 10) + 1;

  v_is_elite := random() < 0.08;
  v_gold := public.calc_stage_gold(v_chapter, v_stage);
  if v_is_elite then
    v_gold := least(1000000, v_gold * 2);
  end if;

  perform public.add_gold(auth.uid(), v_gold);

  if v_stage = 10 and v_first_clear then
    v_chapter_bonus := v_chapter * 5000;
    insert into public.mails (user_id, title, body, gold_amount, item_key, source_key)
    values (
      auth.uid(),
      '🎉 챕터 ' || v_chapter || ' 클리어 축하!',
      '수호자를 처치하고 챕터를 클리어했어요! 다음 챕터도 화이팅!',
      v_chapter_bonus,
      null,
      'chapter_clear_' || v_chapter
    )
    on conflict (user_id, source_key) do nothing;
  end if;

  return query select v_gold, v_is_elite;
end;
$$ language plpgsql security definer;
