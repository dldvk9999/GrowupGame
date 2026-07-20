-- ============================================
-- 122: 파견(원정) 시스템 - 신규 콘텐츠(사용자 요청)
-- 무한원정대류 방치형 게임에 흔한 "몬스터를 잠깐 보내두고 나중에 받으러 온다" 패턴.
-- 오프라인 골드 보상(103/106, 최대 2시간 캡+50% 효율)과는 별개 레인으로 설계함:
-- 오프라인 보상은 "앱을 닫고 있던 짧은~중간 시간"을 커버하고, 파견은 "몇 시간 뒤에
-- 다시 켤 생각으로 미리 걸어두는" 장시간(최대 12시간) 용도로 역할을 나눔. 둘 다 동시에
-- 받을 수 있음(파견은 앱을 켜놓고 있어도 그냥 타이머만 도는 별개 시스템이라 전투/자동사냥과도
-- 전혀 충돌 안 함 - 몬스터를 "떼어가는" 게 아니라 그냥 병행되는 타이머일 뿐).
--
-- 골드 계산은 calc_idle_gold(자동사냥, 2.5초 틱 기준 설계)를 그대로 재사용하지 않음 -
-- 12시간을 틱 단위로 환산하면 add_gold 100만 상한을 쉽게 넘어 크래시하는 걸 확인했음
-- (117/118에서 겪은 것과 동일한 클래스의 실수를 미리 피하려고 처음부터 시간당 요율
-- 기반의 완전히 별도 공식으로 설계함). 시간당 요율은 자동사냥 연속 플레이보다 훨씬
-- 낮게 잡아서(방치 대비 저효율) 능동 플레이를 대체하지 않게 함.
-- ============================================

create table public.expeditions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier text not null check (tier in ('short', 'medium', 'long')),
  started_at timestamptz not null default now(),
  duration_seconds integer not null,
  claimed boolean not null default true
);

alter table public.expeditions enable row level security;
create policy "expeditions는 본인만 조회" on public.expeditions for select using (auth.uid() = user_id);
revoke insert, update, delete on public.expeditions from authenticated;

-- 시간당 골드 요율 - calc_idle_gold와 같은 v_hp 베이스를 쓰되(다른 골드 시스템과 스케일
-- 감각을 맞추기 위함), 훨씬 작은 배율(15)만 곱함(calc_idle_gold는 5*8=40배를 씀,
-- 그건 2.5초당이고 이건 "시간당"이라 실질 효율은 훨씬 낮음).
create or replace function public.calc_expedition_gold_per_hour(p_chapter integer, p_player_level integer)
returns integer as $$
declare
  v_hp integer;
begin
  v_hp := greatest(10, round(8 + p_chapter * 2.0 + p_player_level * 3.0));
  return greatest(20, round(v_hp * 0.15) * 15);
end;
$$ language plpgsql stable;

create or replace function public.start_expedition(p_tier text)
returns table(started_at timestamptz, duration_seconds integer) as $$
declare
  v_duration integer;
  v_existing public.expeditions;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_tier not in ('short', 'medium', 'long') then
    raise exception '유효하지 않은 파견 종류입니다.';
  end if;
  if not exists (select 1 from public.owned_monsters where user_id = auth.uid() and is_active = true) then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  select * into v_existing from public.expeditions where user_id = auth.uid();
  if v_existing.user_id is not null and v_existing.claimed = false then
    raise exception '이미 진행 중인 파견이 있어요. 먼저 수령해주세요.';
  end if;

  v_duration := case p_tier when 'short' then 1800 when 'medium' then 14400 else 43200 end;

  insert into public.expeditions (user_id, tier, started_at, duration_seconds, claimed)
  values (auth.uid(), p_tier, now(), v_duration, false)
  on conflict (user_id) do update
    set tier = p_tier, started_at = now(), duration_seconds = v_duration, claimed = false;

  return query select now(), v_duration;
end;
$$ language plpgsql security definer;

create or replace function public.claim_expedition()
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

  select * into v_exp from public.expeditions where user_id = auth.uid() for update;
  if v_exp.user_id is null or v_exp.claimed = true then
    raise exception '진행 중인 파견이 없어요.';
  end if;
  if now() - v_exp.started_at < (v_exp.duration_seconds || ' seconds')::interval then
    raise exception '아직 파견이 끝나지 않았어요.';
  end if;

  select level into v_level from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_level is null then
    -- 파견 도중 스타터를 다시 고르는 등 활성 몬스터가 사라진 극단적 경우 - 보상 없이 종료 처리만
    update public.expeditions set claimed = true where user_id = auth.uid();
    return query select 0, v_exp.tier;
    return;
  end if;

  select coalesce(max(ceil(stage_id / 10.0)), 1) into v_chapter
    from public.stage_progress
    where user_id = auth.uid() and cleared = true;

  v_hours := v_exp.duration_seconds / 3600.0;
  v_gold := round(public.calc_expedition_gold_per_hour(v_chapter, v_level) * v_hours);
  v_gold := least(v_gold, 1000000);

  update public.expeditions set claimed = true where user_id = auth.uid();
  perform public.add_gold(auth.uid(), v_gold);

  return query select v_gold, v_exp.tier;
end;
$$ language plpgsql security definer;
