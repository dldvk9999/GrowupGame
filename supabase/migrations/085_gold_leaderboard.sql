-- ============================================
-- 085: 골드 재산 랭킹 (신규 콘텐츠) - 기존 업적/탑/친구추천 랭킹과 동일한 패턴.
-- profiles의 gold 컬럼은 이미 공개 RLS(select using (true))라 클라이언트가 직접
-- 조회할 수도 있지만, 닉네임/칭호까지 한 번에 묶어서 반환하는 일관된 인터페이스를
-- 위해 다른 랭킹들과 동일하게 RPC로 통일함.
-- ============================================

create or replace function public.fetch_gold_leaderboard()
returns table(rank integer, nickname text, gold integer, equipped_title text, is_me boolean) as $$
begin
  return query
  select
    row_number() over (order by p.gold desc)::integer as rank,
    p.nickname,
    p.gold,
    p.equipped_title,
    p.id = auth.uid() as is_me
  from public.profiles p
  where p.gold > 0
  order by p.gold desc
  limit 20;
end;
$$ language plpgsql stable security definer;

create or replace function public.fetch_my_gold_rank()
returns integer as $$
declare
  v_my_gold integer;
  v_rank integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select gold into v_my_gold from public.profiles where id = auth.uid();
  if coalesce(v_my_gold, 0) = 0 then return null; end if;

  select count(*) + 1 into v_rank from public.profiles
    where gold > v_my_gold;

  return v_rank;
end;
$$ language plpgsql stable security definer;
