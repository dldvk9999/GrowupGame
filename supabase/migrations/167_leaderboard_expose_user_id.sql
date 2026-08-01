-- ============================================
-- 167: 랭킹 함수 9종에 user_id 노출 추가 - 신규 콘텐츠(사용자 요청, 166 연동)
-- 랭킹에서 유저를 클릭해 fetch_public_profile(166)을 호출하려면 대상의 user_id가
-- 있어야 하는데, 지금까지 모든 랭킹 함수(is_me만 서버에서 비교해서 boolean으로
-- 반환)는 실제 uuid를 클라이언트로 내려준 적이 없었음. 9개 함수 전부 반환 컬럼에
-- user_id만 추가(계산 로직/정렬/limit은 전혀 안 건드림 - diff로 확인) - 전부 반환
-- 컬럼이 바뀌므로 DROP FUNCTION 필요.
--
-- 참고: world_boss_contributions는 애초에 클라이언트가 PostgREST로 테이블을 직접
-- 조회하는 구조(RLS가 "누구나 조회 가능")라 서버 함수 수정 없이 클라이언트
-- select 절에 user_id만 추가하면 됨(worldBoss.js에서 처리).
-- ============================================

drop function if exists public.fetch_leaderboard();
create or replace function public.fetch_leaderboard()
returns table(
  rank integer, nickname text, level integer, unlocked_job_tier integer,
  element text, combat_power integer, is_me boolean, equipped_title text, user_id uuid
) as $$
begin
  return query
  with ranked as (
    select
      p.nickname,
      om.level,
      om.unlocked_job_tier,
      ms.element,
      public.calc_combat_power(
        round((cs.atk + coalesce(eb.bonus_atk, 0) + coalesce(rb.bonus_atk, 0)) * (1 + coalesce(rb.pct_atk, 0) / 100))::integer,
        round((cs.def + coalesce(eb.bonus_def, 0) + coalesce(rb.bonus_def, 0)) * (1 + coalesce(rb.pct_def, 0) / 100))::integer,
        round((cs.max_hp + coalesce(eb.bonus_hp, 0) + coalesce(rb.bonus_hp, 0)) * (1 + coalesce(rb.pct_hp, 0) / 100))::integer
      ) as power,
      om.user_id,
      p.equipped_title
    from public.owned_monsters om
    join public.profiles p on p.id = om.user_id
    join public.monster_species ms on ms.id = om.species_id
    cross join lateral public.calc_monster_stats(om.species_id, om.level, om.unlocked_job_tier) cs
    cross join lateral public.calc_equipped_stat_bonus(om.user_id) eb
    cross join lateral public.calc_relic_bonus(om.user_id) rb
    where om.is_active = true
  )
  select
    row_number() over (order by r.power desc)::integer as rank,
    r.nickname,
    r.level,
    r.unlocked_job_tier,
    r.element,
    r.power,
    r.user_id = auth.uid() as is_me,
    r.equipped_title,
    r.user_id
  from ranked r
  order by r.power desc
  limit 50;
end;
$$ language plpgsql security definer;

drop function if exists public.fetch_achievement_leaderboard();
create or replace function public.fetch_achievement_leaderboard()
returns table(
  rank integer, nickname text, achievement_count integer, equipped_title text, is_me boolean, user_id uuid
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
    c.user_id = auth.uid() as is_me,
    c.user_id
  from counts c
  order by c.cnt desc
  limit 20;
end;
$$ language plpgsql stable security definer;

drop function if exists public.fetch_tower_leaderboard();
create or replace function public.fetch_tower_leaderboard()
returns table(rank integer, nickname text, highest_floor integer, equipped_title text, is_me boolean, user_id uuid) as $$
begin
  return query
  select
    row_number() over (order by tp.highest_floor desc)::integer as rank,
    p.nickname,
    tp.highest_floor,
    p.equipped_title,
    tp.user_id = auth.uid() as is_me,
    tp.user_id
  from public.tower_progress tp
  join public.profiles p on p.id = tp.user_id
  where tp.highest_floor > 0
  order by tp.highest_floor desc
  limit 20;
end;
$$ language plpgsql stable security definer;

drop function if exists public.fetch_referral_leaderboard();
create or replace function public.fetch_referral_leaderboard()
returns table(rank integer, nickname text, referral_count integer, equipped_title text, is_me boolean, user_id uuid) as $$
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
    c.referrer_id = auth.uid() as is_me,
    c.referrer_id as user_id
  from counts c
  join public.profiles rp on rp.id = c.referrer_id
  order by c.cnt desc
  limit 20;
end;
$$ language plpgsql stable security definer;

drop function if exists public.fetch_gold_leaderboard();
create or replace function public.fetch_gold_leaderboard()
returns table(rank integer, nickname text, gold integer, equipped_title text, is_me boolean, user_id uuid) as $$
begin
  return query
  select
    row_number() over (order by p.gold desc)::integer as rank,
    p.nickname,
    p.gold,
    p.equipped_title,
    p.id = auth.uid() as is_me,
    p.id as user_id
  from public.profiles p
  where p.gold > 0
  order by p.gold desc
  limit 20;
end;
$$ language plpgsql stable security definer;

drop function if exists public.fetch_pvp_leaderboard();
create or replace function public.fetch_pvp_leaderboard()
returns table(rank integer, nickname text, pvp_wins integer, equipped_title text, is_me boolean, user_id uuid) as $$
begin
  return query
  select
    row_number() over (order by p.pvp_wins desc)::integer as rank,
    p.nickname,
    p.pvp_wins,
    p.equipped_title,
    p.id = auth.uid() as is_me,
    p.id as user_id
  from public.profiles p
  where p.pvp_wins > 0
  order by p.pvp_wins desc
  limit 20;
end;
$$ language plpgsql stable security definer;

drop function if exists public.fetch_streak_dungeon_leaderboard();
create or replace function public.fetch_streak_dungeon_leaderboard()
returns table(rank integer, nickname text, best_streak integer, equipped_title text, is_me boolean, user_id uuid) as $$
begin
  return query
  select
    row_number() over (order by sdb.best_streak desc)::integer as rank,
    p.nickname,
    sdb.best_streak,
    p.equipped_title,
    sdb.user_id = auth.uid() as is_me,
    sdb.user_id
  from public.streak_dungeon_best sdb
  join public.profiles p on p.id = sdb.user_id
  where sdb.best_streak > 0
  order by sdb.best_streak desc
  limit 20;
end;
$$ language plpgsql stable security definer;

drop function if exists public.fetch_seal_leaderboard();
create or replace function public.fetch_seal_leaderboard()
returns table(rank integer, nickname text, equipped_title text, seal_fragments bigint, is_me boolean, user_id uuid) as $$
begin
  return query
  select
    row_number() over (order by p.seal_fragments desc)::integer as rank,
    p.nickname,
    p.equipped_title,
    p.seal_fragments,
    p.id = auth.uid() as is_me,
    p.id as user_id
  from public.profiles p
  where p.seal_fragments > 0
  order by p.seal_fragments desc
  limit 20;
end;
$$ language plpgsql stable security definer;

drop function if exists public.fetch_guild_raid_contributors();
create or replace function public.fetch_guild_raid_contributors()
returns table(nickname text, equipped_title text, total_damage bigint, is_me boolean, user_id uuid) as $$
declare
  v_guild_id uuid;
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  v_guild_id := public.my_guild_id();
  if v_guild_id is null then
    return;
  end if;

  return query
    select p.nickname, p.equipped_title, grc.total_damage, grc.user_id = auth.uid() as is_me, grc.user_id
    from public.guild_raid_contributions grc
    join public.profiles p on p.id = grc.user_id
    where grc.guild_id = v_guild_id and grc.week_key = v_week and grc.total_damage > 0
    order by grc.total_damage desc
    limit 30;
end;
$$ language plpgsql stable security definer;
