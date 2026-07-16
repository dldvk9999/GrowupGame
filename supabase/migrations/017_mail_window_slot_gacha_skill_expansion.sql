-- ============================================
-- 017: 우편 접속시간창, 슬롯별 뽑기레벨 분리, 스킬 카탈로그 대폭 확장
-- Supabase SQL Editor에 순서대로 실행 (001~016 먼저 적용되어 있어야 함)
-- ============================================

-- ============================================
-- 1. 정기우편: 정해진 시각(8/12/19시)의 "그 1시간 안"에 접속했을 때만 지급
-- ============================================
create or replace function public.sync_daily_mails()
returns void as $$
declare
  v_now timestamptz;
  v_today date;
  v_hour integer;
  v_slot record;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  v_now := now() at time zone 'Asia/Seoul';
  v_today := v_now::date;
  v_hour := extract(hour from v_now);

  for v_slot in
    select * from (values (8, '아침 우편'), (12, '점심 우편'), (19, '저녁 우편')) as s(h, label)
  loop
    if v_hour = v_slot.h then
      insert into public.mails (user_id, title, body, gold_amount, source_key)
      values (
        auth.uid(),
        v_slot.label,
        '오늘의 출석 골드가 도착했습니다.',
        100000,
        'daily_gold_' || v_today::text || '_' || v_slot.h::text
      )
      on conflict (user_id, source_key) do nothing;
    end if;
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================
-- 2. 장비 뽑기레벨을 슬롯별로 독립 분리
-- ============================================
create table public.equipment_gacha_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot text not null check (slot in ('weapon', 'armor', 'gloves', 'shoes')),
  total_draws integer not null default 0,
  primary key (user_id, slot)
);

alter table public.equipment_gacha_progress enable row level security;
create policy "equipment_gacha_progress는 본인만 조회" on public.equipment_gacha_progress for select using (auth.uid() = user_id);
revoke insert, update, delete on public.equipment_gacha_progress from authenticated;

create or replace function public.draw_equipment(p_slot text)
returns table(item_key text, slot text, rarity text, was_duplicate boolean, new_enhance_level integer, cost integer, draw_level integer) as $$
declare
  v_draws integer;
  v_draw_level integer;
  v_cost integer;
  v_gold integer;
  v_roll numeric;
  v_rarity_order integer;
  v_rarity_name text;
  v_item_key text;
  v_existing_level integer;
  v_final_level integer;
  v_was_dup boolean;
  w_normal numeric; w_rare numeric; w_epic numeric; w_legendary numeric; w_mythic numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_slot not in ('weapon', 'armor', 'gloves', 'shoes') then
    raise exception '유효하지 않은 슬롯입니다.';
  end if;

  insert into public.equipment_gacha_progress (user_id, slot, total_draws)
  values (auth.uid(), p_slot, 0)
  on conflict (user_id, slot) do nothing;

  select p.total_draws into v_draws from public.equipment_gacha_progress p
    where p.user_id = auth.uid() and p.slot = p_slot;
  v_draw_level := least(20, 1 + v_draws / 1000);
  v_cost := 100 + (v_draw_level - 1) * 30;

  select p.gold into v_gold from public.profiles p where p.id = auth.uid() for update;
  if v_gold is null or v_gold < v_cost then
    raise exception '골드가 부족합니다.';
  end if;

  if v_draw_level <= 3 then
    w_normal := 0.70; w_rare := 0.25; w_epic := 0.05; w_legendary := 0.00; w_mythic := 0.00;
  elsif v_draw_level <= 7 then
    w_normal := 0.50; w_rare := 0.32; w_epic := 0.15; w_legendary := 0.03; w_mythic := 0.00;
  elsif v_draw_level <= 11 then
    w_normal := 0.32; w_rare := 0.33; w_epic := 0.25; w_legendary := 0.09; w_mythic := 0.01;
  elsif v_draw_level <= 15 then
    w_normal := 0.18; w_rare := 0.27; w_epic := 0.30; w_legendary := 0.20; w_mythic := 0.05;
  elsif v_draw_level <= 19 then
    w_normal := 0.08; w_rare := 0.17; w_epic := 0.30; w_legendary := 0.32; w_mythic := 0.13;
  else
    w_normal := 0.03; w_rare := 0.10; w_epic := 0.25; w_legendary := 0.37; w_mythic := 0.25;
  end if;

  v_roll := random();
  if v_roll < w_normal then v_rarity_order := 1;
  elsif v_roll < w_normal + w_rare then v_rarity_order := 2;
  elsif v_roll < w_normal + w_rare + w_epic then v_rarity_order := 3;
  elsif v_roll < w_normal + w_rare + w_epic + w_legendary then v_rarity_order := 4;
  else v_rarity_order := 5;
  end if;

  v_rarity_name := case v_rarity_order
    when 1 then 'normal' when 2 then 'rare' when 3 then 'epic' when 4 then 'legendary' else 'mythic'
  end;
  v_item_key := p_slot || '_' || v_rarity_name;

  update public.profiles set gold = gold - v_cost where id = auth.uid();
  update public.equipment_gacha_progress set total_draws = total_draws + 1
    where user_id = auth.uid() and slot = p_slot;

  select ui.enhance_level into v_existing_level from public.user_inventory ui
    where ui.user_id = auth.uid() and ui.item_key = v_item_key;

  if v_existing_level is null then
    insert into public.user_inventory (user_id, item_key, slot, equipped, enhance_level)
    values (auth.uid(), v_item_key, p_slot, false, 0);
    v_final_level := 0;
    v_was_dup := false;
  else
    v_final_level := least(15, v_existing_level + 1);
    update public.user_inventory ui set enhance_level = v_final_level
      where ui.user_id = auth.uid() and ui.item_key = v_item_key;
    v_was_dup := true;
  end if;

  return query select v_item_key, p_slot, v_rarity_name, v_was_dup, v_final_level, v_cost,
    least(20, 1 + (v_draws + 1) / 1000);
end;
$$ language plpgsql security definer;

create or replace function public.draw_equipment_batch(p_slot text, p_count integer)
returns table(item_key text, slot text, rarity text, was_duplicate boolean, new_enhance_level integer, cost integer, draw_level integer) as $$
declare
  v_i integer;
  v_draws integer;
  v_draw_level integer;
  v_cost integer;
  v_gold integer;
  v_roll numeric;
  v_rarity_order integer;
  v_rarity_name text;
  v_item_key text;
  v_existing_level integer;
  v_final_level integer;
  v_was_dup boolean;
  w_normal numeric; w_rare numeric; w_epic numeric; w_legendary numeric; w_mythic numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_slot not in ('weapon', 'armor', 'gloves', 'shoes') then
    raise exception '유효하지 않은 슬롯입니다.';
  end if;
  if p_count < 1 or p_count > 100 then
    raise exception '유효하지 않은 횟수입니다.';
  end if;

  insert into public.equipment_gacha_progress (user_id, slot, total_draws)
  values (auth.uid(), p_slot, 0)
  on conflict (user_id, slot) do nothing;

  for v_i in 1..p_count loop
    select p.total_draws into v_draws from public.equipment_gacha_progress p
      where p.user_id = auth.uid() and p.slot = p_slot;
    v_draw_level := least(20, 1 + v_draws / 1000);
    v_cost := 100 + (v_draw_level - 1) * 30;

    select p.gold into v_gold from public.profiles p where p.id = auth.uid() for update;
    if v_gold is null or v_gold < v_cost then
      exit;
    end if;

    if v_draw_level <= 3 then
      w_normal := 0.70; w_rare := 0.25; w_epic := 0.05; w_legendary := 0.00; w_mythic := 0.00;
    elsif v_draw_level <= 7 then
      w_normal := 0.50; w_rare := 0.32; w_epic := 0.15; w_legendary := 0.03; w_mythic := 0.00;
    elsif v_draw_level <= 11 then
      w_normal := 0.32; w_rare := 0.33; w_epic := 0.25; w_legendary := 0.09; w_mythic := 0.01;
    elsif v_draw_level <= 15 then
      w_normal := 0.18; w_rare := 0.27; w_epic := 0.30; w_legendary := 0.20; w_mythic := 0.05;
    elsif v_draw_level <= 19 then
      w_normal := 0.08; w_rare := 0.17; w_epic := 0.30; w_legendary := 0.32; w_mythic := 0.13;
    else
      w_normal := 0.03; w_rare := 0.10; w_epic := 0.25; w_legendary := 0.37; w_mythic := 0.25;
    end if;

    v_roll := random();
    if v_roll < w_normal then v_rarity_order := 1;
    elsif v_roll < w_normal + w_rare then v_rarity_order := 2;
    elsif v_roll < w_normal + w_rare + w_epic then v_rarity_order := 3;
    elsif v_roll < w_normal + w_rare + w_epic + w_legendary then v_rarity_order := 4;
    else v_rarity_order := 5;
    end if;

    v_rarity_name := case v_rarity_order
      when 1 then 'normal' when 2 then 'rare' when 3 then 'epic' when 4 then 'legendary' else 'mythic'
    end;
    v_item_key := p_slot || '_' || v_rarity_name;

    update public.profiles set gold = gold - v_cost where id = auth.uid();
    update public.equipment_gacha_progress set total_draws = total_draws + 1
      where user_id = auth.uid() and slot = p_slot;

    select ui.enhance_level into v_existing_level from public.user_inventory ui
      where ui.user_id = auth.uid() and ui.item_key = v_item_key;

    if v_existing_level is null then
      insert into public.user_inventory (user_id, item_key, slot, equipped, enhance_level)
      values (auth.uid(), v_item_key, p_slot, false, 0);
      v_final_level := 0;
      v_was_dup := false;
    else
      v_final_level := least(15, v_existing_level + 1);
      update public.user_inventory ui set enhance_level = v_final_level
        where ui.user_id = auth.uid() and ui.item_key = v_item_key;
      v_was_dup := true;
    end if;

    item_key := v_item_key;
    slot := p_slot;
    rarity := v_rarity_name;
    was_duplicate := v_was_dup;
    new_enhance_level := v_final_level;
    cost := v_cost;
    draw_level := least(20, 1 + (v_draws + 1) / 1000);
    return next;
  end loop;

  return;
end;
$$ language plpgsql security definer;

-- ============================================
-- 3. 스킬 카탈로그 확장: 등급당 3종 → 10종 (총 50종) + 신규 타입 컬럼
-- ============================================
alter table public.skill_catalog add column duration_ms integer;
alter table public.skill_catalog add column ticks integer;
alter table public.skill_catalog add column tick_interval_ms integer;
alter table public.skill_catalog drop constraint if exists skill_catalog_type_check;
alter table public.skill_catalog add constraint skill_catalog_type_check
  check (type in ('damage', 'heal', 'stun', 'dot', 'buff_atk', 'buff_def', 'haste'));

insert into public.skill_catalog (skill_key, name, icon, rarity, rarity_order, type, base_value, cooldown_ms, duration_ms, ticks, tick_interval_ms, description) values
  ('stone_throw', '돌팔매', '🪨', 'normal', 1, 'damage', 1.02, 850, null, null, null, '돌을 던져 공격'),
  ('double_jab', '연속 잽', '👊', 'normal', 1, 'damage', 1.08, 950, null, null, null, '빠르게 두 번 타격'),
  ('light_bandage', '가벼운 붕대', '🩹', 'normal', 1, 'heal', 0.12, 5200, null, null, null, '상처를 간단히 감쌈'),
  ('dazing_blow', '현기증 강타', '💫', 'normal', 1, 'stun', 1.0, 9000, null, null, null, '적을 잠시 멍하게 만듦'),
  ('rust_thorn', '녹슨 가시', '🥀', 'normal', 1, 'dot', 0.30, 7000, null, 4, 1500, '가시가 박혀 지속 피해'),
  ('battle_cry', '기합', '📣', 'normal', 1, 'buff_atk', 0.15, 15000, 10000, null, null, '기합을 넣어 공격력 상승'),
  ('quick_step', '재빠른 발놀림', '🌀', 'normal', 1, 'haste', 0.15, 20000, 8000, null, null, '재사용 대기시간 감소'),

  ('ice_shard', '얼음 파편', '🧊', 'rare', 2, 'damage', 1.42, 1750, null, null, null, '날카로운 얼음 조각 발사'),
  ('wind_cut', '바람가르기', '🍃', 'rare', 2, 'damage', 1.48, 1850, null, null, null, '바람의 칼날로 베어냄'),
  ('soothing_rain', '진정의 비', '🌧️', 'rare', 2, 'heal', 0.17, 5600, null, null, null, '비가 상처를 씻어내며 회복'),
  ('concussive_wave', '뇌진탕 파동', '💢', 'rare', 2, 'stun', 1.3, 10000, null, null, null, '충격파로 적을 기절시킴'),
  ('venom_spike', '맹독 가시', '☠️', 'rare', 2, 'dot', 0.42, 7500, null, 4, 1500, '맹독이 퍼져 지속 피해'),
  ('iron_skin', '강철 피부', '🛡️', 'rare', 2, 'buff_def', 0.22, 16000, 10000, null, null, '피부가 강철처럼 단단해짐'),
  ('adrenaline', '아드레날린', '💉', 'rare', 2, 'haste', 0.20, 20000, 8000, null, null, '더 빠르게 움직임'),

  ('plasma_burst', '플라즈마 폭발', '🔆', 'epic', 3, 'damage', 1.98, 2750, null, null, null, '고에너지 폭발'),
  ('blade_dance', '칼춤', '🗡️', 'epic', 3, 'damage', 2.02, 2850, null, null, null, '연속 베기 콤보'),
  ('phoenix_feather', '불사조 깃털', '🪶', 'epic', 3, 'heal', 0.22, 6100, null, null, null, '불사조의 깃털이 생명력을 불어넣음'),
  ('gravity_crush', '중력 압박', '🌌', 'epic', 3, 'stun', 1.6, 11000, null, null, null, '중력으로 짓눌러 움직임을 봉인'),
  ('corrosive_mist', '부식 안개', '☁️', 'epic', 3, 'dot', 0.60, 8000, null, 4, 1500, '부식성 안개가 서서히 갉아먹음'),
  ('berserk', '광폭화', '😤', 'epic', 3, 'buff_atk', 0.30, 17000, 10000, null, null, '이성을 놓고 힘을 폭발시킴'),
  ('time_warp', '시간 왜곡', '⏳', 'epic', 3, 'haste', 0.28, 21000, 8000, null, null, '시간의 흐름을 왜곡시켜 가속함'),

  ('meteor_fall', '운석 낙하', '☄️', 'legendary', 4, 'damage', 2.76, 4250, null, null, null, '하늘에서 운석을 떨어뜨림'),
  ('soul_reap', '영혼 수확', '👻', 'legendary', 4, 'damage', 2.82, 4350, null, null, null, '영혼을 베어내는 일격'),
  ('divine_light', '신성한 빛', '✴️', 'legendary', 4, 'heal', 0.32, 7100, null, null, null, '신성한 빛이 상처를 치유함'),
  ('chrono_lock', '시간 결박', '⏱️', 'legendary', 4, 'stun', 2.0, 12000, null, null, null, '시간을 멈춰 적을 결박함'),
  ('plague_curse', '역병의 저주', '🦠', 'legendary', 4, 'dot', 0.85, 8500, null, 4, 1500, '역병이 온몸에 퍼짐'),
  ('aegis_wall', '이지스 방벽', '🏰', 'legendary', 4, 'buff_def', 0.42, 18000, 10000, null, null, '전설의 방패가 몸을 감쌈'),
  ('quicksilver', '수은의 가속', '🌠', 'legendary', 4, 'haste', 0.38, 22000, 8000, null, null, '수은처럼 유동적으로 가속함'),

  ('apocalypse', '종말의 격류', '🌊', 'mythic', 5, 'damage', 3.86, 6600, null, null, null, '모든 것을 휩쓰는 격류'),
  ('starfall', '별의 추락', '🌟', 'mythic', 5, 'damage', 3.92, 6700, null, null, null, '별이 떨어져 대지를 강타'),
  ('genesis_rebirth', '창세의 재생', '🌈', 'mythic', 5, 'heal', 0.46, 9100, null, null, null, '창세의 힘으로 완전히 재생함'),
  ('absolute_zero', '절대영도', '❄️', 'mythic', 5, 'stun', 2.5, 13000, null, null, null, '모든 움직임을 얼려버림'),
  ('entropy_decay', '엔트로피 붕괴', '🕳️', 'mythic', 5, 'dot', 1.20, 9000, null, 4, 1500, '존재 자체가 서서히 붕괴함'),
  ('godspeed', '신속', '⚡', 'mythic', 5, 'buff_atk', 0.60, 19000, 10000, null, null, '신의 속도로 공격력이 폭증함'),
  ('singularity', '특이점', '🕳️', 'mythic', 5, 'haste', 0.50, 23000, 8000, null, null, '특이점이 시간을 압축시킴');
