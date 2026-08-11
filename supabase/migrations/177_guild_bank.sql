-- ============================================
-- 177: 길드 창고(Guild Bank) 신설 - 신규 콘텐츠(todo.md 후속과제 이행)
--
-- guild.md/todo.md에 이미 남겨뒀던 "길드 창고(어뷰징 방지 설계가 까다로움 - 기부만
-- 되고 인출은 길드장 승인제로)" 아이디어를 구현함.
--
-- 경제 안전성: 기부/인출 둘 다 "이미 존재하는 골드를 옮기는 것"뿐이라 새 골드를
-- 만들어내지 않음(순수 재분배) - 인플레이션 위험 자체가 없음. 인출은 길드장만
-- 가능하게 해서(승인제) 창고를 개인 지갑처럼 자유 인출하는 걸 막음 - 이미 길드장이
-- 공지 작성/길드장 위임 등 다른 특권 행동도 전담하고 있어서 기존 신뢰 모델과 일치함.
-- 인출은 반드시 대상 길드원에게 우편으로 지급(기존 add_gold 3자지급 버그 클래스를
-- 피하기 위해 처음부터 우편 단일경로로 설계 - 108/110/158 교훈 재적용).
-- ============================================

alter table public.guilds add column if not exists bank_gold bigint not null default 0;

create table public.guild_bank_log (
  id bigint generated always as identity primary key,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  nickname text not null, -- 탈퇴/추방 이후에도 로그에서 누가 했는지 알아볼 수 있도록 스냅샷 보관
  amount bigint not null, -- 양수=기부, 음수=인출(길드장이 누군가에게 지급)
  target_user_id uuid references public.profiles(id) on delete set null, -- 인출인 경우 받는 사람
  target_nickname text,
  created_at timestamptz not null default now()
);
create index guild_bank_log_guild_idx on public.guild_bank_log(guild_id, created_at desc);

alter table public.guild_bank_log enable row level security;
create policy "guild_bank_log는 같은 길드원만 조회" on public.guild_bank_log
  for select using (
    exists (select 1 from public.guild_members gm where gm.guild_id = guild_bank_log.guild_id and gm.user_id = auth.uid())
  );
revoke insert, update, delete on public.guild_bank_log from authenticated;

/** 길드 창고에 골드 기부 - 길드원 누구나 가능, 본인 골드에서 차감 */
create or replace function public.donate_to_guild_bank(p_amount integer)
returns table(new_gold integer, new_bank_gold bigint) as $$
declare
  v_guild_id uuid;
  v_nickname text;
  v_remaining_gold integer;
  v_bank_gold bigint;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception '기부할 골드를 1 이상 입력해주세요.';
  end if;

  select gm.guild_id, p.nickname into v_guild_id, v_nickname
    from public.guild_members gm join public.profiles p on p.id = gm.user_id
    where gm.user_id = auth.uid();
  if v_guild_id is null then
    raise exception '길드에 가입되어 있지 않습니다.';
  end if;

  update public.profiles set gold = gold - p_amount
    where id = auth.uid() and gold >= p_amount
    returning gold into v_remaining_gold;
  if v_remaining_gold is null then
    raise exception '보유 골드가 부족해요.';
  end if;

  update public.guilds set bank_gold = bank_gold + p_amount where id = v_guild_id
    returning bank_gold into v_bank_gold;

  insert into public.guild_bank_log (guild_id, user_id, nickname, amount)
  values (v_guild_id, auth.uid(), v_nickname, p_amount);

  new_gold := v_remaining_gold;
  new_bank_gold := v_bank_gold;
  return next;
end;
$$ language plpgsql security definer;

/** 길드 창고에서 인출해 특정 길드원에게 우편으로 지급 - 길드장만 가능 */
create or replace function public.withdraw_from_guild_bank(p_amount integer, p_target_user_id uuid)
returns table(new_bank_gold bigint) as $$
declare
  v_guild public.guilds;
  v_target_nickname text;
  v_bank_gold bigint;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception '지급할 골드를 1 이상 입력해주세요.';
  end if;

  select g.* into v_guild from public.guilds g
    join public.guild_members gm on gm.guild_id = g.id
    where gm.user_id = auth.uid() and g.leader_id = auth.uid()
    for update;
  if v_guild.id is null then
    raise exception '길드장만 창고에서 지급할 수 있어요.';
  end if;

  select nickname into v_target_nickname from public.profiles where id = p_target_user_id;
  if not exists (select 1 from public.guild_members where user_id = p_target_user_id and guild_id = v_guild.id) then
    raise exception '같은 길드원에게만 지급할 수 있어요.';
  end if;

  update public.guilds set bank_gold = bank_gold - p_amount
    where id = v_guild.id and bank_gold >= p_amount
    returning bank_gold into v_bank_gold;
  if v_bank_gold is null then
    raise exception '창고 골드가 부족해요.';
  end if;

  insert into public.mails (user_id, title, body, gold_amount, source_key)
  values (
    p_target_user_id,
    '🏦 길드 창고 지급',
    '길드장이 길드 창고에서 골드를 보내드렸어요!',
    p_amount,
    'guild_bank_withdraw_' || gen_random_uuid()::text
  );

  insert into public.guild_bank_log (guild_id, user_id, nickname, amount, target_user_id, target_nickname)
  values (v_guild.id, auth.uid(), (select nickname from public.profiles where id = auth.uid()), -p_amount, p_target_user_id, v_target_nickname);

  new_bank_gold := v_bank_gold;
  return next;
end;
$$ language plpgsql security definer;

/** 길드 창고 잔액 + 최근 로그 20건 */
create or replace function public.fetch_guild_bank_log()
returns table(id bigint, nickname text, amount bigint, target_nickname text, created_at timestamptz) as $$
declare
  v_guild_id uuid;
begin
  if auth.uid() is null then
    return;
  end if;
  select guild_id into v_guild_id from public.guild_members where user_id = auth.uid();
  if v_guild_id is null then
    return;
  end if;
  return query
    select l.id, l.nickname, l.amount, l.target_nickname, l.created_at
    from public.guild_bank_log l
    where l.guild_id = v_guild_id
    order by l.created_at desc
    limit 20;
end;
$$ language plpgsql stable security definer;

-- fetch_my_guild(169) 재정의 - bank_gold 노출. 반환 컬럼이 늘어나므로 DROP FUNCTION 필요.
drop function if exists public.fetch_my_guild();
create or replace function public.fetch_my_guild()
returns table(
  guild_id uuid, name text, tag text, announcement text, leader_id uuid, member_count integer,
  is_leader boolean, level integer, exp bigint, exp_to_next bigint, bank_gold bigint
) as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  return query
    select g.id, g.name, g.tag, g.announcement, g.leader_id,
      (select count(*)::integer from public.guild_members where guild_id = g.id),
      (g.leader_id = auth.uid()),
      g.level, g.exp,
      case when g.level >= 20 then 0::bigint else public.calc_guild_exp_to_next(g.level) end,
      g.bank_gold
    from public.guild_members gm
    join public.guilds g on g.id = gm.guild_id
    where gm.user_id = auth.uid();
end;
$$ language plpgsql stable security definer;
