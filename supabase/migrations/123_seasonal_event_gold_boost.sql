-- ============================================
-- 123: 시즌 한정 이벤트 프레임워크 + "유물 출시 기념 골드 부스트 위크" - 신규 콘텐츠(사용자 요청)
--
-- 짧은 기간(3~7일) 동안만 활성화되는 이벤트를 만들어달라는 요청 반영. 쿠폰 시스템처럼
-- 별도 테이블/상태 없이, grant_idle_reward 안에 "지금이 이벤트 기간인지"만 날짜로 판정하는
-- 가장 단순한 형태로 구현 - 105(주말)/118(클램프수정)/120(유물)과 동일한 골드 배율
-- 파이프라인에 자연스럽게 얹음(새로운 통합 지점을 안 만들어도 됨).
--
-- 이번에 실제로 켜두는 예시 이벤트: "유물 시스템 출시 기념 골드 부스트 위크"
-- 2026-07-25 00:00 ~ 2026-07-28 23:59(한국시간) 동안 자동사냥 골드 +50%.
--
-- 앞으로 새 이벤트를 켜고 싶으면 아래 두 함수의 `between '2026-07-25' and '2026-07-28'`
-- 날짜 리터럴과 배율(1.5)만 바꿔서 재정의하면 됨(반환타입 변경 없으면 DROP 불필요) - 이게 "프레임워크"의
-- 전부임. 굳이 이벤트마다 새 테이블/함수를 만들 필요가 없도록 의도적으로 단순하게 설계.
--
-- 반환타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.grant_idle_reward(p_chapter integer, p_player_level integer)
returns table(gold integer, is_golden boolean) as $$
declare
  v_last timestamptz;
  v_gold numeric;
  v_level integer;
  v_chapter integer;
  v_golden boolean;
  v_is_weekend boolean;
  v_relic record;
  v_event_active boolean;
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

  v_is_weekend := extract(dow from (now() at time zone 'Asia/Seoul')) in (0, 6);
  if v_is_weekend then
    v_gold := round(v_gold * 1.5);
  end if;

  -- 시즌 한정 이벤트: "유물 시스템 출시 기념 골드 부스트 위크" (2026-07-25~28, 한국시간) +50%
  v_event_active := (now() at time zone 'Asia/Seoul')::date between '2026-07-25' and '2026-07-28';
  if v_event_active then
    v_gold := round(v_gold * 1.5);
  end if;

  v_golden := random() < 0.05;
  if v_golden then
    v_gold := v_gold * 3;
  end if;

  -- 유물 골드획득% 보너스 (자동사냥 전용 범위, harness/relics.md 참고)
  select * into v_relic from public.calc_relic_bonus(auth.uid());
  if coalesce(v_relic.pct_gold, 0) > 0 then
    v_gold := round(v_gold * (1 + v_relic.pct_gold / 100));
  end if;

  v_gold := least(v_gold, 1000000);

  update public.profiles set last_idle_reward_at = now() where id = auth.uid();
  perform public.add_gold(auth.uid(), v_gold::integer);

  return query select v_gold::integer, v_golden;
end;
$$ language plpgsql security definer;

-- 이벤트 진행 여부/기간을 클라이언트가 안내 배너에 쓸 수 있도록 조회 전용 함수.
-- grant_idle_reward 안의 날짜 판정과 반드시 동일하게 유지할 것(하나 바꾸면 같이 바꿀 것).
create or replace function public.fetch_active_season_event()
returns table(event_key text, label text, starts_at date, ends_at date) as $$
begin
  if (now() at time zone 'Asia/Seoul')::date between '2026-07-25' and '2026-07-28' then
    return query select 'relic_launch_gold_boost'::text, '유물 출시 기념 골드 부스트 위크'::text, '2026-07-25'::date, '2026-07-28'::date;
  end if;
  return;
end;
$$ language plpgsql stable;
