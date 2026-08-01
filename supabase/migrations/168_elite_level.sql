-- ============================================
-- 168: 정예레벨(Elite Level) 시스템 신설 - 밸런스 조정(사용자 요청)
-- "만렙까지 너무 쉽다" - 던전 클리어 경험치를 대폭 낮추고(dungeonStages.js 등, 클라이언트
-- 전용 값이라 이 마이그레이션엔 없음), 레벨 500(현재 만렙) 이후엔 별도의 훨씬 가파른
-- "정예레벨"(최대 100) 축으로 성장이 계속 이어지도록 함. 지금은 순수 카운터(스탯 보너스
-- 없음) - 추후 이 레벨 기준으로 던전 입장 제한을 만들 예정(harness/todo.md 참고).
-- ============================================

alter table public.owned_monsters add column if not exists elite_level integer not null default 0;
alter table public.owned_monsters add column if not exists elite_exp bigint not null default 0;
alter table public.owned_monsters add constraint owned_monsters_elite_level_check check (elite_level >= 0 and elite_level <= 100);

-- save_monster_growth(127) 재정의 - 정예레벨/경험치 파라미터 추가 및 검증. 파라미터
-- 시그니처가 바뀌므로 DROP FUNCTION 선행 필요.
drop function if exists public.save_monster_growth(uuid, integer, integer, integer, integer, integer, integer);

create or replace function public.save_monster_growth(
  p_owned_monster_id uuid, p_level integer, p_exp integer,
  p_hp integer, p_atk integer, p_def integer, p_species_id integer,
  p_elite_level integer default 0, p_elite_exp bigint default 0
) returns void as $$
declare
  v_owner uuid;
  v_old_level integer;
  v_old_species integer;
  v_old_elite_level integer;
  v_species record;
  v_growth numeric;
  v_ceiling_hp integer;
  v_ceiling_atk integer;
  v_ceiling_def integer;
begin
  select user_id, level, species_id, elite_level into v_owner, v_old_level, v_old_species, v_old_elite_level
    from public.owned_monsters where id = p_owned_monster_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception '권한이 없습니다.';
  end if;

  -- 최대 레벨 500 (10차 전직 확장, 사용자 요청)
  if p_level > 500 then
    raise exception '최대 레벨(500)을 초과할 수 없습니다.';
  end if;
  if p_level < v_old_level or p_level > v_old_level + 50 then
    raise exception '레벨 변화량이 비정상적입니다.';
  end if;

  -- (신규) 정예레벨은 레벨 500(만렙)일 때만 의미가 있고, 최대 100, 급격한 변화량도 차단
  if p_elite_level < 0 or p_elite_level > 100 then
    raise exception '정예레벨 범위가 비정상적입니다.';
  end if;
  if p_elite_level > 0 and p_level < 500 then
    raise exception '만렙 전에는 정예레벨을 가질 수 없습니다.';
  end if;
  if p_elite_level < v_old_elite_level or p_elite_level > coalesce(v_old_elite_level, 0) + 20 then
    raise exception '정예레벨 변화량이 비정상적입니다.';
  end if;

  if p_species_id <> v_old_species then
    perform 1 from public.monster_species
      where id = v_old_species and evolves_to = p_species_id and evolve_level <= p_level;
    if not found then
      raise exception '유효하지 않은 진화입니다.';
    end if;
  end if;

  select * into v_species from public.monster_species where id = p_species_id;
  v_growth := 1 + (p_level - 1) * 0.12;
  -- 상한 배율을 10차 전직 최대치(90.0)에 맞춰 상향(기존 16.0)
  v_ceiling_hp := ceil(v_species.base_hp * v_growth * 90.0 * 1.05);
  v_ceiling_atk := ceil(v_species.base_atk * v_growth * 90.0 * 1.05);
  v_ceiling_def := ceil(v_species.base_def * v_growth * 90.0 * 1.05);

  if p_hp < 0 or p_atk < 0 or p_def < 0
     or p_hp > v_ceiling_hp or p_atk > v_ceiling_atk or p_def > v_ceiling_def then
    raise exception '스탯 값이 비정상적입니다.';
  end if;

  update public.owned_monsters set
    level = p_level, exp = p_exp, hp = p_hp, atk = p_atk, def = p_def, species_id = p_species_id,
    elite_level = p_elite_level, elite_exp = p_elite_exp
  where id = p_owned_monster_id;
end;
$$ language plpgsql security definer;
