-- ============================================
-- 119: 유물(Relic) 시스템 - 신규 콘텐츠(사용자 요청)
-- 스킬 뽑기와 동일한 구조(단일 풀, 전역 뽑기레벨)로 50종 유물을 뽑고, 중복 시
-- "강화 시도"가 발생함(장비와 달리 100% 성공이 아니라 실패 확률이 있음, 최대 +200).
-- 유물은 최대 3개까지 "장착"해야 효과가 적용됨(미장착 보유는 효과 없음) - 이유는
-- harness/relics.md에 상세 기록: 4슬롯 장비처럼 "장착 개수"로 총 파워를 제한하지
-- 않으면 50종을 다 모았을 때 보유효과가 무한히 누적되는 밸런스 붕괴가 생기기 때문.
--
-- 효과 카테고리 7종(체력/공격력/방어력/스킬쿨타임/골드획득/경험치획득/버프효과) ×
-- 수치(flat)/비율(percent) 두 방식을 섞어 10개 원형(archetype)을 만들고, 5개 등급에
-- 각각 10개씩 배치해 정확히 50종. 등급별 배율은 기존 장비 등급 배율(1/1.8/2.8/4.2/6.5,
-- itemCatalog.js RARITIES)과 동일하게 맞춰 다른 시스템과 감각적으로 통일함.
-- ============================================

create table public.relic_catalog (
  relic_key text primary key,
  name text not null,
  icon text not null,
  rarity text not null check (rarity in ('normal', 'rare', 'epic', 'legendary', 'mythic')),
  rarity_order integer not null,
  effect_category text not null check (effect_category in ('hp', 'atk', 'def', 'cooldown', 'gold', 'exp', 'buff')),
  effect_mode text not null check (effect_mode in ('flat', 'percent')),
  base_value numeric not null,
  rarity_mult numeric not null,
  description text not null
);

-- 정적 카탈로그라 RLS 없이 전체 공개(다른 catalog 테이블들과 동일 패턴)

create table public.user_relics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  relic_key text not null references public.relic_catalog(relic_key),
  level integer not null default 0 check (level >= 0 and level <= 200),
  equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  unique (user_id, relic_key)
);

alter table public.user_relics enable row level security;
create policy "user_relics는 본인만 조회" on public.user_relics for select using (auth.uid() = user_id);
revoke insert, update, delete on public.user_relics from authenticated;

alter table public.profiles add column total_relic_draws integer not null default 0;

-- ============================================
-- 유물 뽑기 (스킬 뽑기와 동일한 비용/확률 곡선 재사용)
-- 중복이면 "강화 시도": 성공 확률 = greatest(0.30, 1 - 현재레벨*0.0035)
--   레벨0→1(첫 중복): 100% / 레벨50: 82.5% / 레벨100: 65% / 레벨150: 47.5% / 레벨199: 최저 30%
-- 실패해도 레벨이 깎이지 않음(이 게임의 전반적인 "덜 가혹한" 톤 유지, ui-and-ux.md 참고) -
-- 그냥 이번 중복 하나가 허공으로 사라질 뿐, 다음에 또 뽑으면 됨.
-- ============================================

create or replace function public.draw_relic()
returns table(
  relic_key text, rarity text, was_duplicate boolean, enhance_attempted boolean,
  enhance_success boolean, new_level integer, cost integer, draw_level integer
) as $$
declare
  v_draws integer;
  v_draw_level integer;
  v_cost integer;
  v_gold integer;
  v_roll numeric;
  v_rarity_order integer;
  v_rarity_name text;
  v_picked_key text;
  v_existing_level integer;
  v_final_level integer;
  v_was_dup boolean;
  v_attempted boolean := false;
  v_success boolean := false;
  v_success_chance numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select p.total_relic_draws into v_draws from public.profiles p where p.id = auth.uid();
  v_draw_level := least(50, 1 + v_draws / 1000);
  v_cost := 300 + (v_draw_level - 1) * 90;

  select p.gold into v_gold from public.profiles p where p.id = auth.uid() for update;
  if v_gold is null or v_gold < v_cost then
    raise exception '골드가 부족합니다.';
  end if;

  v_roll := random();
  if v_draw_level <= 8 then
    if v_roll < 0.70 then v_rarity_order := 1; elsif v_roll < 0.95 then v_rarity_order := 2; else v_rarity_order := 3; end if;
  elsif v_draw_level <= 18 then
    if v_roll < 0.50 then v_rarity_order := 1; elsif v_roll < 0.82 then v_rarity_order := 2; elsif v_roll < 0.97 then v_rarity_order := 3; else v_rarity_order := 4; end if;
  elsif v_draw_level <= 28 then
    if v_roll < 0.32 then v_rarity_order := 1; elsif v_roll < 0.65 then v_rarity_order := 2; elsif v_roll < 0.90 then v_rarity_order := 3; elsif v_roll < 0.99 then v_rarity_order := 4; else v_rarity_order := 5; end if;
  elsif v_draw_level <= 38 then
    if v_roll < 0.18 then v_rarity_order := 1; elsif v_roll < 0.45 then v_rarity_order := 2; elsif v_roll < 0.75 then v_rarity_order := 3; elsif v_roll < 0.95 then v_rarity_order := 4; else v_rarity_order := 5; end if;
  elsif v_draw_level <= 48 then
    if v_roll < 0.08 then v_rarity_order := 1; elsif v_roll < 0.25 then v_rarity_order := 2; elsif v_roll < 0.55 then v_rarity_order := 3; elsif v_roll < 0.87 then v_rarity_order := 4; else v_rarity_order := 5; end if;
  else
    if v_roll < 0.03 then v_rarity_order := 1; elsif v_roll < 0.13 then v_rarity_order := 2; elsif v_roll < 0.38 then v_rarity_order := 3; elsif v_roll < 0.75 then v_rarity_order := 4; else v_rarity_order := 5; end if;
  end if;

  v_rarity_name := case v_rarity_order
    when 1 then 'normal' when 2 then 'rare' when 3 then 'epic' when 4 then 'legendary' else 'mythic'
  end;

  select rc.relic_key into v_picked_key from public.relic_catalog rc
    where rc.rarity_order = v_rarity_order
    order by random() limit 1;

  update public.profiles set gold = gold - v_cost, total_relic_draws = total_relic_draws + 1
    where id = auth.uid();

  select ur.level into v_existing_level from public.user_relics ur
    where ur.user_id = auth.uid() and ur.relic_key = v_picked_key;

  if v_existing_level is null then
    insert into public.user_relics (user_id, relic_key, level) values (auth.uid(), v_picked_key, 0);
    v_final_level := 0;
    v_was_dup := false;
  else
    v_was_dup := true;
    if v_existing_level >= 200 then
      -- 이미 최대강화(200) - 강화 시도 자체가 발생하지 않음(허탕 아님, 그냥 만렙 표시)
      v_final_level := v_existing_level;
    else
      v_attempted := true;
      v_success_chance := greatest(0.30, 1 - v_existing_level * 0.0035);
      if random() < v_success_chance then
        v_success := true;
        v_final_level := least(200, v_existing_level + 1);
        update public.user_relics ur set level = v_final_level
          where ur.user_id = auth.uid() and ur.relic_key = v_picked_key;
      else
        v_final_level := v_existing_level;
      end if;
    end if;
  end if;

  return query select v_picked_key, v_rarity_name, v_was_dup, v_attempted, v_success, v_final_level, v_cost,
    least(50, 1 + (v_draws + 1) / 1000);
end;
$$ language plpgsql security definer;

-- ============================================
-- 50종 유물 시드 데이터
-- ============================================

insert into public.relic_catalog (relic_key, name, icon, rarity, rarity_order, effect_category, effect_mode, base_value, rarity_mult, description) values
  ('relic_hp_flat_normal', '낡은 생명의 유물', '💗', 'normal', 1, 'hp', 'flat', 15, 1.0, '체력 +15 증가'),
  ('relic_hp_percent_normal', '낡은 심장의 유물', '❤️', 'normal', 1, 'hp', 'percent', 0.8, 1.0, '체력 +0.8% 증가'),
  ('relic_atk_flat_normal', '낡은 칼날의 유물', '🗡️', 'normal', 1, 'atk', 'flat', 2, 1.0, '공격력 +2 증가'),
  ('relic_atk_percent_normal', '낡은 맹공의 유물', '⚔️', 'normal', 1, 'atk', 'percent', 0.8, 1.0, '공격력 +0.8% 증가'),
  ('relic_def_flat_normal', '낡은 방패의 유물', '🛡️', 'normal', 1, 'def', 'flat', 2, 1.0, '방어력 +2 증가'),
  ('relic_def_percent_normal', '낡은 철벽의 유물', '🔰', 'normal', 1, 'def', 'percent', 0.8, 1.0, '방어력 +0.8% 증가'),
  ('relic_cooldown_percent_normal', '낡은 신속의 유물', '⏱️', 'normal', 1, 'cooldown', 'percent', 0.6, 1.0, '스킬 쿨타임 -0.6% 감소'),
  ('relic_gold_percent_normal', '낡은 재물의 유물', '💰', 'normal', 1, 'gold', 'percent', 0.8, 1.0, '골드 획득 +0.8% 증가'),
  ('relic_exp_percent_normal', '낡은 지혜의 유물', '📖', 'normal', 1, 'exp', 'percent', 0.8, 1.0, '경험치 획득 +0.8% 증가'),
  ('relic_buff_percent_normal', '낡은 축복의 유물', '✨', 'normal', 1, 'buff', 'percent', 0.8, 1.0, '버프 효과 +0.8% 증가'),
  ('relic_hp_flat_rare', '빛나는 생명의 유물', '💗', 'rare', 2, 'hp', 'flat', 15, 1.8, '체력 +15 증가'),
  ('relic_hp_percent_rare', '빛나는 심장의 유물', '❤️', 'rare', 2, 'hp', 'percent', 0.8, 1.8, '체력 +0.8% 증가'),
  ('relic_atk_flat_rare', '빛나는 칼날의 유물', '🗡️', 'rare', 2, 'atk', 'flat', 2, 1.8, '공격력 +2 증가'),
  ('relic_atk_percent_rare', '빛나는 맹공의 유물', '⚔️', 'rare', 2, 'atk', 'percent', 0.8, 1.8, '공격력 +0.8% 증가'),
  ('relic_def_flat_rare', '빛나는 방패의 유물', '🛡️', 'rare', 2, 'def', 'flat', 2, 1.8, '방어력 +2 증가'),
  ('relic_def_percent_rare', '빛나는 철벽의 유물', '🔰', 'rare', 2, 'def', 'percent', 0.8, 1.8, '방어력 +0.8% 증가'),
  ('relic_cooldown_percent_rare', '빛나는 신속의 유물', '⏱️', 'rare', 2, 'cooldown', 'percent', 0.6, 1.8, '스킬 쿨타임 -0.6% 감소'),
  ('relic_gold_percent_rare', '빛나는 재물의 유물', '💰', 'rare', 2, 'gold', 'percent', 0.8, 1.8, '골드 획득 +0.8% 증가'),
  ('relic_exp_percent_rare', '빛나는 지혜의 유물', '📖', 'rare', 2, 'exp', 'percent', 0.8, 1.8, '경험치 획득 +0.8% 증가'),
  ('relic_buff_percent_rare', '빛나는 축복의 유물', '✨', 'rare', 2, 'buff', 'percent', 0.8, 1.8, '버프 효과 +0.8% 증가'),
  ('relic_hp_flat_epic', '찬란한 생명의 유물', '💗', 'epic', 3, 'hp', 'flat', 15, 2.8, '체력 +15 증가'),
  ('relic_hp_percent_epic', '찬란한 심장의 유물', '❤️', 'epic', 3, 'hp', 'percent', 0.8, 2.8, '체력 +0.8% 증가'),
  ('relic_atk_flat_epic', '찬란한 칼날의 유물', '🗡️', 'epic', 3, 'atk', 'flat', 2, 2.8, '공격력 +2 증가'),
  ('relic_atk_percent_epic', '찬란한 맹공의 유물', '⚔️', 'epic', 3, 'atk', 'percent', 0.8, 2.8, '공격력 +0.8% 증가'),
  ('relic_def_flat_epic', '찬란한 방패의 유물', '🛡️', 'epic', 3, 'def', 'flat', 2, 2.8, '방어력 +2 증가'),
  ('relic_def_percent_epic', '찬란한 철벽의 유물', '🔰', 'epic', 3, 'def', 'percent', 0.8, 2.8, '방어력 +0.8% 증가'),
  ('relic_cooldown_percent_epic', '찬란한 신속의 유물', '⏱️', 'epic', 3, 'cooldown', 'percent', 0.6, 2.8, '스킬 쿨타임 -0.6% 감소'),
  ('relic_gold_percent_epic', '찬란한 재물의 유물', '💰', 'epic', 3, 'gold', 'percent', 0.8, 2.8, '골드 획득 +0.8% 증가'),
  ('relic_exp_percent_epic', '찬란한 지혜의 유물', '📖', 'epic', 3, 'exp', 'percent', 0.8, 2.8, '경험치 획득 +0.8% 증가'),
  ('relic_buff_percent_epic', '찬란한 축복의 유물', '✨', 'epic', 3, 'buff', 'percent', 0.8, 2.8, '버프 효과 +0.8% 증가'),
  ('relic_hp_flat_legendary', '전설의 생명의 유물', '💗', 'legendary', 4, 'hp', 'flat', 15, 4.2, '체력 +15 증가'),
  ('relic_hp_percent_legendary', '전설의 심장의 유물', '❤️', 'legendary', 4, 'hp', 'percent', 0.8, 4.2, '체력 +0.8% 증가'),
  ('relic_atk_flat_legendary', '전설의 칼날의 유물', '🗡️', 'legendary', 4, 'atk', 'flat', 2, 4.2, '공격력 +2 증가'),
  ('relic_atk_percent_legendary', '전설의 맹공의 유물', '⚔️', 'legendary', 4, 'atk', 'percent', 0.8, 4.2, '공격력 +0.8% 증가'),
  ('relic_def_flat_legendary', '전설의 방패의 유물', '🛡️', 'legendary', 4, 'def', 'flat', 2, 4.2, '방어력 +2 증가'),
  ('relic_def_percent_legendary', '전설의 철벽의 유물', '🔰', 'legendary', 4, 'def', 'percent', 0.8, 4.2, '방어력 +0.8% 증가'),
  ('relic_cooldown_percent_legendary', '전설의 신속의 유물', '⏱️', 'legendary', 4, 'cooldown', 'percent', 0.6, 4.2, '스킬 쿨타임 -0.6% 감소'),
  ('relic_gold_percent_legendary', '전설의 재물의 유물', '💰', 'legendary', 4, 'gold', 'percent', 0.8, 4.2, '골드 획득 +0.8% 증가'),
  ('relic_exp_percent_legendary', '전설의 지혜의 유물', '📖', 'legendary', 4, 'exp', 'percent', 0.8, 4.2, '경험치 획득 +0.8% 증가'),
  ('relic_buff_percent_legendary', '전설의 축복의 유물', '✨', 'legendary', 4, 'buff', 'percent', 0.8, 4.2, '버프 효과 +0.8% 증가'),
  ('relic_hp_flat_mythic', '신화의 생명의 유물', '💗', 'mythic', 5, 'hp', 'flat', 15, 6.5, '체력 +15 증가'),
  ('relic_hp_percent_mythic', '신화의 심장의 유물', '❤️', 'mythic', 5, 'hp', 'percent', 0.8, 6.5, '체력 +0.8% 증가'),
  ('relic_atk_flat_mythic', '신화의 칼날의 유물', '🗡️', 'mythic', 5, 'atk', 'flat', 2, 6.5, '공격력 +2 증가'),
  ('relic_atk_percent_mythic', '신화의 맹공의 유물', '⚔️', 'mythic', 5, 'atk', 'percent', 0.8, 6.5, '공격력 +0.8% 증가'),
  ('relic_def_flat_mythic', '신화의 방패의 유물', '🛡️', 'mythic', 5, 'def', 'flat', 2, 6.5, '방어력 +2 증가'),
  ('relic_def_percent_mythic', '신화의 철벽의 유물', '🔰', 'mythic', 5, 'def', 'percent', 0.8, 6.5, '방어력 +0.8% 증가'),
  ('relic_cooldown_percent_mythic', '신화의 신속의 유물', '⏱️', 'mythic', 5, 'cooldown', 'percent', 0.6, 6.5, '스킬 쿨타임 -0.6% 감소'),
  ('relic_gold_percent_mythic', '신화의 재물의 유물', '💰', 'mythic', 5, 'gold', 'percent', 0.8, 6.5, '골드 획득 +0.8% 증가'),
  ('relic_exp_percent_mythic', '신화의 지혜의 유물', '📖', 'mythic', 5, 'exp', 'percent', 0.8, 6.5, '경험치 획득 +0.8% 증가'),
  ('relic_buff_percent_mythic', '신화의 축복의 유물', '✨', 'mythic', 5, 'buff', 'percent', 0.8, 6.5, '버프 효과 +0.8% 증가');

-- ============================================
-- 유물 장착(최대 3개) - itemCatalog의 "장착"과 유사하지만 슬롯 구분 없이 자유 선택.
-- 3개로 제한하는 이유: 50종을 다 모아도 보유효과가 무한 누적되지 않도록 "장착한 것만"
-- 효과가 적용되게 해서 총 파워를 구조적으로 제한함(harness/relics.md 참고).
-- ============================================

create or replace function public.set_relic_loadout(p_relic_keys text[])
returns void as $$
declare
  v_count integer;
  v_owned_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  v_count := coalesce(array_length(p_relic_keys, 1), 0);
  if v_count > 3 then
    raise exception '유물은 최대 3개까지만 장착할 수 있어요.';
  end if;
  if v_count <> (select count(distinct k) from unnest(p_relic_keys) as k) then
    raise exception '같은 유물을 두 번 넣을 수 없어요.';
  end if;

  if v_count > 0 then
    select count(*) into v_owned_count from public.user_relics ur
      where ur.user_id = auth.uid() and ur.relic_key = any(p_relic_keys);
    if v_owned_count <> v_count then
      raise exception '보유하지 않은 유물은 장착할 수 없어요.';
    end if;
  end if;

  update public.user_relics ur set equipped = (ur.relic_key = any(p_relic_keys))
    where ur.user_id = auth.uid() and (ur.equipped = true or ur.relic_key = any(p_relic_keys));
end;
$$ language plpgsql security definer;

-- ============================================
-- 장착된 유물 3개의 효과를 합산 - calc_equipped_stat_bonus(051)와 나란히 쓰이는 자매 함수.
-- ATK/DEF/HP(flat+percent)만 서버 반영 대상 - 쿨타임/골드/경험치/버프 효과는
-- 전투가 클라이언트에서 계산되는 이 게임 구조상 클라이언트에서만 반영함
-- (골드는 예외로 grant_idle_reward에서 gold percent만 별도 반영, stages-and-dungeons.md 참고).
-- ============================================

create or replace function public.calc_relic_bonus(p_user_id uuid)
returns table(bonus_atk integer, bonus_def integer, bonus_hp integer, pct_atk numeric, pct_def numeric, pct_hp numeric, pct_gold numeric) as $$
declare
  v_atk integer := 0;
  v_def integer := 0;
  v_hp integer := 0;
  v_pct_atk numeric := 0;
  v_pct_def numeric := 0;
  v_pct_hp numeric := 0;
  v_pct_gold numeric := 0;
  v_row record;
begin
  for v_row in
    select rc.effect_category, rc.effect_mode, rc.base_value, rc.rarity_mult, ur.level
    from public.user_relics ur
    join public.relic_catalog rc on rc.relic_key = ur.relic_key
    where ur.user_id = p_user_id and ur.equipped = true
  loop
    declare
      v_effective numeric := v_row.base_value * v_row.rarity_mult * (1 + v_row.level * 0.03);
    begin
      if v_row.effect_category = 'atk' and v_row.effect_mode = 'flat' then
        v_atk := v_atk + round(v_effective);
      elsif v_row.effect_category = 'atk' and v_row.effect_mode = 'percent' then
        v_pct_atk := v_pct_atk + v_effective;
      elsif v_row.effect_category = 'def' and v_row.effect_mode = 'flat' then
        v_def := v_def + round(v_effective);
      elsif v_row.effect_category = 'def' and v_row.effect_mode = 'percent' then
        v_pct_def := v_pct_def + v_effective;
      elsif v_row.effect_category = 'hp' and v_row.effect_mode = 'flat' then
        v_hp := v_hp + round(v_effective);
      elsif v_row.effect_category = 'hp' and v_row.effect_mode = 'percent' then
        v_pct_hp := v_pct_hp + v_effective;
      elsif v_row.effect_category = 'gold' and v_row.effect_mode = 'percent' then
        v_pct_gold := v_pct_gold + v_effective;
      end if;
      -- cooldown/exp/buff는 서버 계산 대상이 아니므로 여기서 집계 안 함(클라이언트 전용)
    end;
  end loop;

  return query select v_atk, v_def, v_hp, v_pct_atk, v_pct_def, v_pct_hp, v_pct_gold;
end;
$$ language plpgsql stable security definer;
