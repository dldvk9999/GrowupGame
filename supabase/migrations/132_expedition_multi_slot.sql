-- ============================================
-- 132: 파견 슬롯을 레벨 100마다 +1개로 확장 - 사용자 요청
-- 기존엔 유저당 파견을 1개만(테이블 PK가 user_id 단독) 동시에 보낼 수 있었음.
-- 이제 슬롯 개수 = 1 + floor(레벨/100) — 레벨100=2개, 200=3개, 300=4개, 400=5개, 500(만렙)=6개.
--
-- 테이블 구조를 user_id 단독 PK에서 별도 id(uuid) PK로 변경해서 유저당 여러 행을
-- 동시에 가질 수 있게 함. 기존 claim_expedition()은 어떤 파견인지 구분할 방법이
-- 없어졌으므로 p_expedition_id 파라미터를 받도록 반환/인자 모두 바뀜 -> DROP FUNCTION 필요.
-- start_expedition은 반환타입 그대로지만 슬롯 계산 로직이 추가됨.
-- ============================================

alter table public.expeditions drop constraint expeditions_pkey;
alter table public.expeditions add column id uuid not null default gen_random_uuid();
alter table public.expeditions add primary key (id);
create index expeditions_user_idx on public.expeditions(user_id);

-- 레벨에 따른 파견 슬롯 개수 - 클라이언트(expedition.js)와 동일 공식 유지할 것
create or replace function public.calc_expedition_slots(p_level integer)
returns integer as $$
begin
  return 1 + floor(greatest(1, p_level) / 100.0)::integer;
end;
$$ language plpgsql immutable;

drop function if exists public.start_expedition(text);

create or replace function public.start_expedition(p_tier text)
returns table(id uuid, started_at timestamptz, duration_seconds integer) as $$
declare
  v_duration integer;
  v_level integer;
  v_slots integer;
  v_active_count integer;
  v_new_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_tier not in ('short', 'medium', 'long') then
    raise exception '유효하지 않은 파견 종류입니다.';
  end if;

  select level into v_level from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_level is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  v_slots := public.calc_expedition_slots(v_level);
  select count(*) into v_active_count from public.expeditions where user_id = auth.uid() and claimed = false;
  if v_active_count >= v_slots then
    raise exception '파견 슬롯이 가득 찼어요. (레벨 %, 최대 %개) 먼저 수령하거나 레벨을 올려 슬롯을 늘려보세요.', v_level, v_slots;
  end if;

  v_duration := case p_tier when 'short' then 1800 when 'medium' then 14400 else 43200 end;

  insert into public.expeditions (user_id, tier, started_at, duration_seconds, claimed)
  values (auth.uid(), p_tier, now(), v_duration, false)
  returning expeditions.id into v_new_id;

  return query select v_new_id, now(), v_duration;
end;
$$ language plpgsql security definer;

drop function if exists public.claim_expedition();

create or replace function public.claim_expedition(p_expedition_id uuid)
returns table(gold integer, tier text) as $$
declare
  v_exp public.expeditions;
  v_level integer;
  v_chapter integer;
  v_hours numeric;
  v_gold integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_exp from public.expeditions where id = p_expedition_id and user_id = auth.uid() for update;
  if v_exp.id is null or v_exp.claimed = true then
    raise exception '진행 중인 파견이 없어요.';
  end if;
  if now() - v_exp.started_at < (v_exp.duration_seconds || ' seconds')::interval then
    raise exception '아직 파견이 끝나지 않았어요.';
  end if;

  select level into v_level from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_level is null then
    update public.expeditions set claimed = true where id = p_expedition_id;
    return query select 0, v_exp.tier;
    return;
  end if;

  select coalesce(max(ceil(stage_id / 10.0)), 1) into v_chapter
    from public.stage_progress
    where user_id = auth.uid() and cleared = true;

  v_hours := v_exp.duration_seconds / 3600.0;
  v_gold := round(public.calc_expedition_gold_per_hour(v_chapter, v_level) * v_hours);
  v_gold := least(v_gold, 1000000);

  update public.expeditions set claimed = true where id = p_expedition_id;
  perform public.add_gold(auth.uid(), v_gold);

  return query select v_gold, v_exp.tier;
end;
$$ language plpgsql security definer;

-- 진행 중인(claimed=false) 파견 전부 + 사용 가능한 슬롯 수를 함께 반환
create or replace function public.fetch_my_expeditions()
returns table(id uuid, tier text, started_at timestamptz, duration_seconds integer, total_slots integer) as $$
declare
  v_level integer;
  v_slots integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select level into v_level from public.owned_monsters where user_id = auth.uid() and is_active = true;
  v_slots := public.calc_expedition_slots(coalesce(v_level, 1));

  return query
  select e.id, e.tier, e.started_at, e.duration_seconds, v_slots
  from public.expeditions e
  where e.user_id = auth.uid() and e.claimed = false
  order by e.started_at asc;
end;
$$ language plpgsql stable security definer;
