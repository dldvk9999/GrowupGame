-- ============================================
-- 050: 칭호(타이틀) 시스템
-- 특정 업적을 달성하면 칭호가 해금되고, 그 중 하나를 골라 닉네임 옆에 표시할 수 있음.
-- 다른 유저에게 자랑할 수 있는 "플렉스" 요소로 업적 시스템의 재방문 유인을 강화함.
-- ============================================

alter table public.profiles add column equipped_title text;

-- 칭호를 주는 업적 키 -> 칭호 텍스트 매핑 (서버가 유일한 기준, 클라이언트 TITLE_CATALOG와 반드시 동기화)
create or replace function public.set_equipped_title(p_achievement_key text)
returns void as $$
declare
  v_title text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_achievement_key is null then
    update public.profiles set equipped_title = null where id = auth.uid();
    return;
  end if;

  if not exists (select 1 from public.achievement_claims where user_id = auth.uid() and achievement_key = p_achievement_key) then
    raise exception '아직 달성하지 않은 업적이에요.';
  end if;

  v_title := case p_achievement_key
    when 'level_180' then '정점의 지배자'
    when 'job_tier_5' then '전설의 전사'
    when 'stage_clear_1000' then '차원의 정복자'
    when 'gacha_5000' then '행운의 화신'
    when 'pvp_win_50' then '투기장의 지배자'
    when 'attendance_month' then '성실한 조련사'
    else null
  end;

  if v_title is null then
    raise exception '칭호가 없는 업적이에요.';
  end if;

  update public.profiles set equipped_title = v_title where id = auth.uid();
end;
$$ language plpgsql security definer;

-- 랭킹에도 칭호를 같이 보여주기 위해 fetch_leaderboard 재정의
create or replace function public.fetch_leaderboard()
returns table(
  rank integer, nickname text, level integer, unlocked_job_tier integer,
  element text, combat_power integer, is_me boolean, equipped_title text
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
      om.user_id,
      p.equipped_title
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
    r.user_id = auth.uid() as is_me,
    r.equipped_title
  from ranked r
  order by r.power desc
  limit 50;
end;
$$ language plpgsql stable security definer;
