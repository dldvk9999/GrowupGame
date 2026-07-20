-- ============================================
-- 118: [버그 수정] 105(주말 자동사냥 보너스)의 sanity 클램프가 add_gold 실제 상한(100만)보다
-- 큰 500만으로 잘못 설정돼있던 문제 (117 작업 직후 자체 재검토로 발견)
--
-- add_gold(target_user, amount)는 amount > 1,000,000이면 무조건 예외를 던짐(030).
-- 그런데 105가 넣은 "배율 중첩 대비 sanity 클램프"는 500만으로 설정돼있어서 사실상
-- 클램프 역할을 전혀 못 하고 있었음 - calc_idle_gold(chapter, level)은 level이 커질수록
-- 무제한으로 커지는데(레벨 상한 없음), 주말(1.5배)+황금몬스터(3배)가 동시에 겹치면
-- (약 4.5배) 대략 레벨 12,000대 이상에서 골드가 100만을 넘어 add_gold가 크래시함.
--
-- 전체 마이그레이션을 grep해보면 다른 곳(071/072/075/080/087/096/098/100)은 전부
-- 정확히 1,000,000으로 클램프돼있고, 105만 유일하게 5,000,000으로 잘못 들어가 있었음
-- (117에서 PvP 보상 오버플로우를 예방 수정하다가 "다른 곳도 확인해보자"며 재검토 중 발견).
--
-- 수정: 클램프 값을 1,000,000으로 정정. 반환타입 그대로라 DROP FUNCTION 불필요.
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

  v_gold := least(v_gold, 1000000); -- (수정) add_gold 실제 상한(030)에 맞춰 클램프 정정

  update public.profiles set last_idle_reward_at = now() where id = auth.uid();
  perform public.add_gold(auth.uid(), v_gold);

  return query select v_gold, v_golden;
end;
$$ language plpgsql security definer;
