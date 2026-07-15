-- ============================================
-- 008: 일일 던전 + 우편함 + 쿠폰 시스템
-- Supabase SQL Editor에 순서대로 실행
-- 시간 기준은 전부 서울(Asia/Seoul) 기준
-- ============================================

-- ============================================
-- 1. 일일 던전 입장 횟수 (하루 3회, 던전 타입별 별도 카운트)
-- ============================================
create table public.dungeon_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  dungeon_type text not null check (dungeon_type in ('exp', 'gold')),
  attempt_date date not null,
  count integer not null default 0,
  primary key (user_id, dungeon_type, attempt_date)
);

alter table public.dungeon_attempts enable row level security;
create policy "dungeon_attempts는 본인만 조회" on public.dungeon_attempts for select using (auth.uid() = user_id);

create or replace function public.use_dungeon_attempt(p_dungeon_type text)
returns integer as $$
declare
  v_today date;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_dungeon_type not in ('exp', 'gold') then
    raise exception '유효하지 않은 던전입니다.';
  end if;

  v_today := (now() at time zone 'Asia/Seoul')::date;

  select count into v_count from public.dungeon_attempts
    where user_id = auth.uid() and dungeon_type = p_dungeon_type and attempt_date = v_today;
  v_count := coalesce(v_count, 0);

  if v_count >= 3 then
    raise exception '오늘 입장 횟수를 모두 사용했습니다. (하루 3회)';
  end if;

  insert into public.dungeon_attempts (user_id, dungeon_type, attempt_date, count)
  values (auth.uid(), p_dungeon_type, v_today, 1)
  on conflict (user_id, dungeon_type, attempt_date)
    do update set count = public.dungeon_attempts.count + 1;

  return 3 - (v_count + 1);
end;
$$ language plpgsql security definer;

-- ============================================
-- 2. 우편함
-- ============================================
create table public.mails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  gold_amount integer not null default 0,
  item_key text references public.item_catalog(item_key),
  claimed boolean not null default false,
  source_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);

create index mails_user_idx on public.mails(user_id, claimed);

alter table public.mails enable row level security;
create policy "mails는 본인만 조회" on public.mails for select using (auth.uid() = user_id);

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
    if v_hour >= v_slot.h then
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

create or replace function public.claim_mail(p_mail_id uuid)
returns void as $$
declare
  v_mail public.mails;
  v_item record;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_mail from public.mails where id = p_mail_id and user_id = auth.uid();
  if v_mail is null then
    raise exception '우편을 찾을 수 없습니다.';
  end if;
  if v_mail.claimed then
    raise exception '이미 수령한 우편입니다.';
  end if;

  update public.mails set claimed = true where id = p_mail_id;

  if v_mail.gold_amount > 0 then
    update public.profiles set gold = gold + v_mail.gold_amount where id = auth.uid();
  end if;

  if v_mail.item_key is not null then
    select * into v_item from public.item_catalog where item_key = v_mail.item_key;
    if v_item is not null then
      insert into public.user_inventory (user_id, item_key, slot, equipped)
      values (auth.uid(), v_item.item_key, v_item.slot, false);
    end if;
  end if;
end;
$$ language plpgsql security definer;

-- ============================================
-- 3. 쿠폰
-- ============================================
create table public.coupons (
  code text primary key,
  gold_amount integer not null default 0,
  item_key text references public.item_catalog(item_key),
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.coupons enable row level security;

create table public.coupon_redemptions (
  coupon_code text not null references public.coupons(code),
  user_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (coupon_code, user_id)
);

alter table public.coupon_redemptions enable row level security;
create policy "coupon_redemptions는 본인만 조회" on public.coupon_redemptions for select using (auth.uid() = user_id);

create or replace function public.redeem_coupon(p_code text)
returns void as $$
declare
  v_coupon record;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_coupon from public.coupons where code = upper(trim(p_code));
  if v_coupon is null then
    raise exception '존재하지 않는 쿠폰입니다.';
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    raise exception '기간이 만료된 쿠폰입니다.';
  end if;
  if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then
    raise exception '사용 횟수가 모두 소진된 쿠폰입니다.';
  end if;

  begin
    insert into public.coupon_redemptions (coupon_code, user_id) values (v_coupon.code, auth.uid());
  exception when unique_violation then
    raise exception '이미 사용한 쿠폰입니다.';
  end;

  update public.coupons set used_count = used_count + 1 where code = v_coupon.code;

  insert into public.mails (user_id, title, body, gold_amount, item_key, source_key)
  values (
    auth.uid(),
    '쿠폰 보상',
    '쿠폰 "' || v_coupon.code || '" 사용 보상입니다.',
    v_coupon.gold_amount,
    v_coupon.item_key,
    'coupon_' || v_coupon.code || '_' || auth.uid()::text
  );
end;
$$ language plpgsql security definer;

-- 테스트용 예시 쿠폰 (원하는 만큼 직접 insert해서 발행하면 됨)
insert into public.coupons (code, gold_amount, item_key, max_uses)
values ('WELCOME2026', 5000, 'weapon_rare', null);
