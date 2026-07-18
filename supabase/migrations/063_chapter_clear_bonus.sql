-- ============================================
-- 063: 챕터 첫 클리어 축하 보너스 (신규 콘텐츠)
-- 각 챕터의 마지막 스테이지(보스, 10번째)를 "처음" 클리어하면 챕터 번호에 비례한
-- 축하 골드를 우편함으로 보내줌. 재도전(이미 클리어한 보스를 또 이김)은 보너스 없음.
-- 반환타입(integer, 기존 스테이지 골드)은 그대로라 DROP FUNCTION 불필요 - 챕터 보너스는
-- 별도 우편으로 지급되고 함수의 반환값 자체엔 영향 없음.
-- ============================================

create or replace function public.clear_stage(p_stage_id integer)
returns integer as $$
declare
  v_prev_cleared boolean;
  v_self_cleared boolean;
  v_chapter integer;
  v_stage integer;
  v_gold integer;
  v_first_clear boolean;
  v_chapter_bonus integer;
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

  -- insert 하기 전에 "이번이 처음 클리어인지" 먼저 확인해둠(재도전이면 false)
  select coalesce(cleared, false) into v_self_cleared from public.stage_progress
    where user_id = auth.uid() and stage_id = p_stage_id;
  v_first_clear := coalesce(v_self_cleared, false) = false;

  insert into public.stage_progress (user_id, stage_id, cleared, cleared_at)
  values (auth.uid(), p_stage_id, true, now())
  on conflict (user_id, stage_id) do update set cleared = true, cleared_at = now();

  v_chapter := ((p_stage_id - 1) / 10) + 1;
  v_stage := ((p_stage_id - 1) % 10) + 1;
  v_gold := public.calc_stage_gold(v_chapter, v_stage);

  perform public.add_gold(auth.uid(), v_gold);

  -- 챕터 보스(10번째 스테이지)를 처음 클리어했으면 축하 보너스 우편 발송
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

  return v_gold;
end;
$$ language plpgsql security definer;
