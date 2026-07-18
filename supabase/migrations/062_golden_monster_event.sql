-- ============================================
-- 062: "황금 몬스터" 이벤트 - 신규 콘텐츠
-- 자동사냥(idle) 중 5% 확률로 이번 처치가 "황금 몬스터"였던 것으로 판정되어 골드 3배 지급.
-- 서버(grant_idle_reward)가 자체적으로 random() 판정하므로 클라이언트가 조작할 수 없음.
-- 반환값이 integer(골드) -> table(gold, is_golden)로 바뀌므로 DROP FUNCTION 먼저 실행.
-- ============================================

drop function if exists public.grant_idle_reward(integer, integer);

create or replace function public.grant_idle_reward(p_chapter integer, p_player_level integer)
returns table(gold integer, is_golden boolean) as $$
declare
  v_last timestamptz;
  v_gold integer;
  v_level integer;
  v_chapter integer;
  v_golden boolean;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select last_idle_reward_at into v_last from public.profiles where id = auth.uid() for update;
  if v_last is not null and now() - v_last < interval '2.5 seconds' then
    raise exception '너무 빠른 요청입니다.';
  end if;

  select level into v_level from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_level is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  select coalesce(max(ceil(stage_id / 10.0)), 1) into v_chapter
    from public.stage_progress
    where user_id = auth.uid() and cleared = true;

  v_gold := public.calc_idle_gold(v_chapter, v_level);

  -- 5% 확률로 "황금 몬스터" 이벤트 - 골드 3배 지급 (서버가 직접 판정, 클라이언트 조작 불가)
  v_golden := random() < 0.05;
  if v_golden then
    v_gold := v_gold * 3;
  end if;

  update public.profiles set last_idle_reward_at = now() where id = auth.uid();
  perform public.add_gold(auth.uid(), v_gold);

  return query select v_gold, v_golden;
end;
$$ language plpgsql security definer;
