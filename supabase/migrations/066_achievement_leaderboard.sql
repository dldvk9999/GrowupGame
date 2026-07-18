-- ============================================
-- 066: 업적 달성 개수 랭킹 (신규 콘텐츠) - 전투력과 무관한 별도의 경쟁 축.
-- achievement_claims가 "본인만 조회" RLS라 클라이언트가 직접 집계할 수 없어서
-- security definer RPC로 전체 유저 집계를 대신 해줌(fetch_leaderboard와 동일한 패턴).
-- ============================================

create or replace function public.fetch_achievement_leaderboard()
returns table(
  rank integer, nickname text, achievement_count integer, equipped_title text, is_me boolean
) as $$
begin
  return query
  with counts as (
    select
      p.id as user_id,
      p.nickname,
      p.equipped_title,
      count(ac.achievement_key)::integer as cnt
    from public.profiles p
    join public.achievement_claims ac on ac.user_id = p.id
    group by p.id, p.nickname, p.equipped_title
    having count(ac.achievement_key) > 0
  )
  select
    row_number() over (order by c.cnt desc)::integer as rank,
    c.nickname,
    c.cnt,
    c.equipped_title,
    c.user_id = auth.uid() as is_me
  from counts c
  order by c.cnt desc
  limit 20;
end;
$$ language plpgsql stable security definer;

-- 내 순위(20위 밖일 때 표시용) - fetch_my_rank/fetch_my_world_boss_rank와 동일한 아이디어
create or replace function public.fetch_my_achievement_rank()
returns integer as $$
declare
  v_my_count integer;
  v_rank integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select count(*) into v_my_count from public.achievement_claims where user_id = auth.uid();
  if v_my_count = 0 then return null; end if;

  select count(*) + 1 into v_rank
  from (
    select user_id, count(*) as cnt
    from public.achievement_claims
    group by user_id
    having count(*) > v_my_count
  ) higher;

  return v_rank;
end;
$$ language plpgsql stable security definer;
