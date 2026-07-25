-- ============================================
-- 143: 전직 스킬 강화 - 사용자 요청
-- 루비를 소모해서 전직(각성) 스킬의 위력을 강화할 수 있게 함. 등급(=전직 차수)이
-- 높을수록 강화 1회당 필요한 루비가 더 많음. 강화는 RNG 없이 항상 성공(레벨업만),
-- 유물처럼 확률 실패는 없음 - 스킬편성 화면의 "전직강화" 탭에서 사용.
-- ============================================

create table public.job_skill_enhancements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_id text not null,
  level integer not null default 0 check (level >= 0 and level <= 50),
  primary key (user_id, skill_id)
);
alter table public.job_skill_enhancements enable row level security;
create policy "job_skill_enhancements는 본인만 조회" on public.job_skill_enhancements for select using (auth.uid() = user_id);
revoke insert, update, delete on public.job_skill_enhancements from authenticated;

/** 전직스킬 id(예: fire_job6)에서 전직 차수(1~10)를 추출 - 클라이언트 jobAdvancement.js의
 * getJobSkillTier와 반드시 동일한 판정을 하도록 유지할 것 */
create or replace function public.extract_job_skill_tier(p_skill_id text)
returns integer as $$
declare
  v_match text[];
begin
  v_match := regexp_match(p_skill_id, '^(?:fire|water|grass)_job([1-9]|10)$');
  if v_match is null then
    return null;
  end if;
  return v_match[1]::integer;
end;
$$ language plpgsql immutable;

/** 이 강화 레벨에서 "다음 레벨"로 올리는 데 필요한 루비 - 등급(전직 차수)이 높을수록 비쌈.
 * 클라이언트 jobSkillEnhance.js의 calcEnhanceCost와 반드시 동일한 공식을 유지할 것. */
create or replace function public.calc_job_skill_enhance_cost(p_tier integer, p_current_level integer)
returns integer as $$
begin
  return round(p_tier * 10 + p_current_level * p_tier * 2);
end;
$$ language plpgsql immutable;

/** 전직스킬 강화 - 루비 소모, 성공률 없이 항상 1레벨 증가(최대 50) */
create or replace function public.enhance_job_skill(p_skill_id text)
returns table(new_level integer, rubies_spent integer, rubies_balance integer) as $$
declare
  v_tier integer;
  v_unlocked_tier integer;
  v_current_level integer;
  v_cost integer;
  v_rubies integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  v_tier := public.extract_job_skill_tier(p_skill_id);
  if v_tier is null then
    raise exception '전직 스킬만 강화할 수 있어요.';
  end if;

  select unlocked_job_tier into v_unlocked_tier from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if coalesce(v_unlocked_tier, 0) < v_tier then
    raise exception '아직 습득하지 않은 전직 스킬이에요.';
  end if;

  select level into v_current_level from public.job_skill_enhancements
    where user_id = auth.uid() and skill_id = p_skill_id
    for update;
  v_current_level := coalesce(v_current_level, 0);

  if v_current_level >= 50 then
    raise exception '이미 최대 강화 단계예요.';
  end if;

  v_cost := public.calc_job_skill_enhance_cost(v_tier, v_current_level);

  select rubies into v_rubies from public.profiles where id = auth.uid() for update;
  if coalesce(v_rubies, 0) < v_cost then
    raise exception '루비가 부족해요. (%개 필요, 보유 %개)', v_cost, coalesce(v_rubies, 0);
  end if;

  update public.profiles set rubies = rubies - v_cost where id = auth.uid();
  insert into public.job_skill_enhancements (user_id, skill_id, level)
  values (auth.uid(), p_skill_id, v_current_level + 1)
  on conflict (user_id, skill_id) do update set level = job_skill_enhancements.level + 1;

  return query select (v_current_level + 1), v_cost, (select rubies from public.profiles where id = auth.uid());
end;
$$ language plpgsql security definer;

/** 내 전직스킬 강화 현황 전부 조회 */
create or replace function public.fetch_my_job_skill_enhancements()
returns table(skill_id text, level integer) as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  return query select jse.skill_id, jse.level from public.job_skill_enhancements jse where jse.user_id = auth.uid();
end;
$$ language plpgsql stable security definer;
