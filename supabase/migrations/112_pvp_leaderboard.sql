-- ============================================
-- 112: PvP 승수 랭킹 - 신규 콘텐츠
-- 랭킹 화면에 전투력/업적/무한의탑/친구추천/재산은 이미 있는데 PvP만 빠져있었음.
-- 오늘 PvP를 대폭 강화한 김에(107/108/109) 랭킹 탭도 추가해서 경쟁 요소를 완성함.
-- tower/referral 랭킹(071/084)과 완전히 동일한 패턴 - 신규 함수라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.fetch_pvp_leaderboard()
returns table(rank integer, nickname text, pvp_wins integer, equipped_title text, is_me boolean) as $$
begin
  return query
  select
    row_number() over (order by p.pvp_wins desc)::integer as rank,
    p.nickname,
    p.pvp_wins,
    p.equipped_title,
    p.id = auth.uid() as is_me
  from public.profiles p
  where p.pvp_wins > 0
  order by p.pvp_wins desc
  limit 20;
end;
$$ language plpgsql stable security definer;

create or replace function public.fetch_my_pvp_rank()
returns integer as $$
declare
  v_my_wins integer;
  v_rank integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select pvp_wins into v_my_wins from public.profiles where id = auth.uid();
  if coalesce(v_my_wins, 0) = 0 then return null; end if;

  select count(*) + 1 into v_rank from public.profiles
    where pvp_wins > v_my_wins;

  return v_rank;
end;
$$ language plpgsql stable security definer;
