-- ============================================
-- 048: 랭킹(명예의 전당) 시스템
-- 다른 유저와의 경쟁/비교는 리텐션에 강한 요소. 전투력 기준 상위 50명을 보여주는
-- 읽기 전용 랭킹을 추가함. owned_monsters/profiles는 RLS로 본인 것만 조회 가능하므로,
-- security definer RPC로 필요한 필드(닉네임/레벨/전직단계/속성/전투력)만 안전하게 노출.
-- ============================================

create or replace function public.fetch_leaderboard()
returns table(
  rank integer, nickname text, level integer, unlocked_job_tier integer,
  element text, combat_power integer, is_me boolean
) as $$
begin
  return query
  with ranked as (
    select
      p.nickname,
      om.level,
      om.unlocked_job_tier,
      ms.element,
      public.calc_combat_power(cs.atk, cs.def, cs.max_hp) as power,
      om.user_id
    from public.owned_monsters om
    join public.profiles p on p.id = om.user_id
    join public.monster_species ms on ms.id = om.species_id
    cross join lateral public.calc_monster_stats(om.species_id, om.level, om.unlocked_job_tier) cs
    where om.is_active = true
  )
  select
    row_number() over (order by r.power desc)::integer as rank,
    r.nickname,
    r.level,
    r.unlocked_job_tier,
    r.element,
    r.power,
    r.user_id = auth.uid() as is_me
  from ranked r
  order by r.power desc
  limit 50;
end;
$$ language plpgsql stable security definer;

-- 내 순위(50위 밖이어도 알 수 있게 별도 조회)
create or replace function public.fetch_my_rank()
returns integer as $$
declare
  v_my_power integer;
  v_rank integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select public.calc_combat_power(cs.atk, cs.def, cs.max_hp) into v_my_power
  from public.owned_monsters om
  cross join lateral public.calc_monster_stats(om.species_id, om.level, om.unlocked_job_tier) cs
  where om.user_id = auth.uid() and om.is_active = true;

  if v_my_power is null then return null; end if;

  select count(*) + 1 into v_rank
  from public.owned_monsters om
  cross join lateral public.calc_monster_stats(om.species_id, om.level, om.unlocked_job_tier) cs
  where om.is_active = true
    and public.calc_combat_power(cs.atk, cs.def, cs.max_hp) > v_my_power;

  return v_rank;
end;
$$ language plpgsql stable security definer;
