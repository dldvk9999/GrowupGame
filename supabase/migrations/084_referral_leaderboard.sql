-- ============================================
-- 084: 친구 추천 랭킹 (신규 콘텐츠)
-- 기존 achievement/tower 랭킹과 동일한 패턴 - security definer로 전체 집계,
-- 개인 식별정보 없이 닉네임/추천횟수/칭호만 반환.
-- ============================================

create or replace function public.fetch_referral_leaderboard()
returns table(rank integer, nickname text, referral_count integer, equipped_title text, is_me boolean) as $$
begin
  return query
  with counts as (
    select
      p.referred_by as referrer_id,
      count(*)::integer as cnt
    from public.profiles p
    where p.referred_by is not null
    group by p.referred_by
  )
  select
    row_number() over (order by c.cnt desc)::integer as rank,
    rp.nickname,
    c.cnt,
    rp.equipped_title,
    c.referrer_id = auth.uid() as is_me
  from counts c
  join public.profiles rp on rp.id = c.referrer_id
  order by c.cnt desc
  limit 20;
end;
$$ language plpgsql stable security definer;

create or replace function public.fetch_my_referral_rank()
returns integer as $$
declare
  v_my_count integer;
  v_rank integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select count(*) into v_my_count from public.profiles where referred_by = auth.uid();
  if coalesce(v_my_count, 0) = 0 then return null; end if;

  select count(*) + 1 into v_rank from (
    select referred_by, count(*) as cnt
    from public.profiles
    where referred_by is not null
    group by referred_by
    having count(*) > v_my_count
  ) higher;

  return v_rank;
end;
$$ language plpgsql stable security definer;
