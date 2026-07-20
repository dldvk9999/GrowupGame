-- ============================================
-- 105: 주말(토·일) 자동사냥 골드 1.5배 이벤트 - 신규 콘텐츠
-- 모바일 게임에서 흔한 "주말 접속 유도" 장치. 자동사냥 골드에만 적용(다른 골드
-- 소스는 건드리지 않음, 범위를 좁게 유지).
--
-- 반환 컬럼 구성(gold, is_golden)이 그대로라 DROP FUNCTION 불필요.
-- 황금 몬스터(3배)와 중첩 가능 - 100(던전 행운/정예 중첩)에서 배운 대로 최종값을
-- 한 번 더 sanity 클램프해서 혹시 모를 폭주를 방지함.
-- ============================================

create or replace function public.grant_idle_reward(p_chapter integer, p_player_level integer)
returns table(gold integer, is_golden boolean) as $$
declare
  v_last timestamptz;
  v_gold integer;
  v_level integer;
  v_chapter integer;
  v_golden boolean;
  v_is_weekend boolean;
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

  -- 주말(한국시간 토=6, 일=0) 골드 1.5배
  v_is_weekend := extract(dow from (now() at time zone 'Asia/Seoul')) in (0, 6);
  if v_is_weekend then
    v_gold := round(v_gold * 1.5);
  end if;

  -- 5% 확률로 "황금 몬스터" 이벤트 - 골드 3배 지급 (서버가 직접 판정, 클라이언트 조작 불가)
  v_golden := random() < 0.05;
  if v_golden then
    v_gold := v_gold * 3;
  end if;

  v_gold := least(v_gold, 5000000); -- 배율 중첩 대비 sanity 클램프(100에서 배운 패턴)

  update public.profiles set last_idle_reward_at = now() where id = auth.uid();
  perform public.add_gold(auth.uid(), v_gold);

  return query select v_gold, v_golden;
end;
$$ language plpgsql security definer;
