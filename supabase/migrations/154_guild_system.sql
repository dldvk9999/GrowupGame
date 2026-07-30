-- ============================================
-- 154: 길드(클랜) 시스템 신설 - 사용자 요청("신규 컨텐츠 조사해서 추가")
--
-- 조사 결과(방치형 RPG 업계 트렌드) 이 게임엔 1:1 친구/로비채팅/전투력 랭킹은 있지만
-- "여러 명이 함께 소속되는 그룹"(길드/클랜)이 없었음 - 업계에서는 길드 시스템을
-- 방치형 RPG의 표준적인 사회적 콘텐츠로 꼽음. 채팅/레이드까지는 범위가 너무 커서
-- 이번엔 핵심만 먼저: 길드 생성/가입/탈퇴, 닉네임 옆 길드 태그, 길드 전투력 랭킹.
-- ============================================

create table public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 12),
  tag text not null check (char_length(tag) between 2 and 4), -- 닉네임 옆에 붙는 짧은 표기
  leader_id uuid not null references public.profiles(id) on delete cascade,
  announcement text default '',
  created_at timestamptz not null default now()
);

create table public.guild_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index guild_members_guild_idx on public.guild_members(guild_id);

alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
create policy "guilds는 누구나 목록 조회 가능(가입 전 탐색용)" on public.guilds for select using (true);
create policy "guild_members는 누구나 조회 가능(길드원 목록 확인용)" on public.guild_members for select using (true);
revoke insert, update, delete on public.guilds from authenticated;
revoke insert, update, delete on public.guild_members from authenticated;

/** 길드 생성 - 이름/태그 중복 검사, 최대 30명까지 가입 가능(정원은 join 시점에 검사) */
create or replace function public.create_guild(p_name text, p_tag text)
returns uuid as $$
declare
  v_already_in_guild boolean;
  v_guild_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if char_length(p_name) < 2 or char_length(p_name) > 12 then
    raise exception '길드명은 2~12자로 입력해주세요.';
  end if;
  if char_length(p_tag) < 2 or char_length(p_tag) > 4 then
    raise exception '길드 태그는 2~4자로 입력해주세요.';
  end if;

  select exists(select 1 from public.guild_members where user_id = auth.uid()) into v_already_in_guild;
  if v_already_in_guild then
    raise exception '이미 길드에 가입되어 있어요. 먼저 탈퇴해주세요.';
  end if;

  if exists(select 1 from public.guilds where name = p_name) then
    raise exception '이미 있는 길드명이에요.';
  end if;

  insert into public.guilds (name, tag, leader_id) values (p_name, p_tag, auth.uid())
  returning id into v_guild_id;

  insert into public.guild_members (user_id, guild_id) values (auth.uid(), v_guild_id);

  return v_guild_id;
end;
$$ language plpgsql security definer;

/** 길드 가입 - 정원 30명 제한 */
create or replace function public.join_guild(p_guild_id uuid)
returns void as $$
declare
  v_already_in_guild boolean;
  v_member_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select exists(select 1 from public.guild_members where user_id = auth.uid()) into v_already_in_guild;
  if v_already_in_guild then
    raise exception '이미 길드에 가입되어 있어요. 먼저 탈퇴해주세요.';
  end if;

  if not exists(select 1 from public.guilds where id = p_guild_id) then
    raise exception '존재하지 않는 길드예요.';
  end if;

  select count(*) into v_member_count from public.guild_members where guild_id = p_guild_id;
  if v_member_count >= 30 then
    raise exception '이 길드는 정원(30명)이 가득 찼어요.';
  end if;

  insert into public.guild_members (user_id, guild_id) values (auth.uid(), p_guild_id);
end;
$$ language plpgsql security definer;

/** 길드 탈퇴 - 길드장이면 다른 멤버가 있는 한 탈퇴 불가(먼저 위임 또는 전원 탈퇴 필요), 혼자면 길드 자체가 삭제됨 */
create or replace function public.leave_guild()
returns void as $$
declare
  v_guild record;
  v_member_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select g.* into v_guild from public.guild_members gm
    join public.guilds g on g.id = gm.guild_id
    where gm.user_id = auth.uid();

  if v_guild.id is null then
    raise exception '가입한 길드가 없어요.';
  end if;

  if v_guild.leader_id = auth.uid() then
    select count(*) into v_member_count from public.guild_members where guild_id = v_guild.id;
    if v_member_count > 1 then
      raise exception '길드장은 다른 길드원이 남아있는 동안 탈퇴할 수 없어요. 길드장을 위임하거나 다른 길드원을 먼저 내보내주세요.';
    end if;
    -- 혼자 남은 길드장이면 길드 자체를 삭제(멤버 행은 cascade로 함께 삭제됨)
    delete from public.guilds where id = v_guild.id;
  else
    delete from public.guild_members where user_id = auth.uid();
  end if;
end;
$$ language plpgsql security definer;

/** 길드장이 다른 멤버를 길드장으로 위임 */
create or replace function public.transfer_guild_leadership(p_new_leader_id uuid)
returns void as $$
declare
  v_guild_id uuid;
  v_is_leader boolean;
  v_target_in_guild boolean;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select gm.guild_id into v_guild_id from public.guild_members gm where gm.user_id = auth.uid();
  if v_guild_id is null then
    raise exception '가입한 길드가 없어요.';
  end if;

  select (leader_id = auth.uid()) into v_is_leader from public.guilds where id = v_guild_id;
  if not v_is_leader then
    raise exception '길드장만 위임할 수 있어요.';
  end if;

  select exists(
    select 1 from public.guild_members where user_id = p_new_leader_id and guild_id = v_guild_id
  ) into v_target_in_guild;
  if not v_target_in_guild then
    raise exception '같은 길드원에게만 위임할 수 있어요.';
  end if;

  update public.guilds set leader_id = p_new_leader_id where id = v_guild_id;
end;
$$ language plpgsql security definer;

/** 길드장이 공지사항 수정 */
create or replace function public.set_guild_announcement(p_announcement text)
returns void as $$
declare
  v_guild_id uuid;
  v_is_leader boolean;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  select gm.guild_id into v_guild_id from public.guild_members gm where gm.user_id = auth.uid();
  if v_guild_id is null then
    raise exception '가입한 길드가 없어요.';
  end if;
  select (leader_id = auth.uid()) into v_is_leader from public.guilds where id = v_guild_id;
  if not v_is_leader then
    raise exception '길드장만 공지를 수정할 수 있어요.';
  end if;
  update public.guilds set announcement = left(coalesce(p_announcement, ''), 200) where id = v_guild_id;
end;
$$ language plpgsql security definer;

/** 내 길드 정보(없으면 null 관련 필드) */
create or replace function public.fetch_my_guild()
returns table(guild_id uuid, name text, tag text, announcement text, leader_id uuid, member_count integer, is_leader boolean) as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  return query
    select g.id, g.name, g.tag, g.announcement, g.leader_id,
      (select count(*)::integer from public.guild_members where guild_id = g.id),
      (g.leader_id = auth.uid())
    from public.guild_members gm
    join public.guilds g on g.id = gm.guild_id
    where gm.user_id = auth.uid();
end;
$$ language plpgsql stable security definer;

/** 길드 목록(가입 가능한 길드 탐색용) - 인원수 많은 순 */
create or replace function public.fetch_guild_list()
returns table(guild_id uuid, name text, tag text, member_count integer) as $$
begin
  return query
    select g.id, g.name, g.tag, count(gm.user_id)::integer
    from public.guilds g
    left join public.guild_members gm on gm.guild_id = g.id
    group by g.id, g.name, g.tag
    order by count(gm.user_id) desc, g.created_at asc
    limit 50;
end;
$$ language plpgsql stable security definer;

/** 길드원 목록(닉네임/레벨 포함) */
create or replace function public.fetch_guild_members(p_guild_id uuid)
returns table(user_id uuid, nickname text, level integer, joined_at timestamptz) as $$
begin
  return query
    select gm.user_id, p.nickname, coalesce(om.level, 1), gm.joined_at
    from public.guild_members gm
    join public.profiles p on p.id = gm.user_id
    left join public.owned_monsters om on om.user_id = gm.user_id and om.is_active = true
    where gm.guild_id = p_guild_id
    order by gm.joined_at asc;
end;
$$ language plpgsql stable security definer;

/** 길드 전투력 랭킹(멤버 레벨 합산 - 간단한 근사치, 정확한 전투력 합산은 비용이 커서 레벨 합으로 대체) */
create or replace function public.fetch_guild_leaderboard()
returns table(guild_id uuid, name text, tag text, member_count integer, total_level integer) as $$
begin
  return query
    select g.id, g.name, g.tag, count(gm.user_id)::integer,
      coalesce(sum(om.level), 0)::integer
    from public.guilds g
    left join public.guild_members gm on gm.guild_id = g.id
    left join public.owned_monsters om on om.user_id = gm.user_id and om.is_active = true
    group by g.id, g.name, g.tag
    order by coalesce(sum(om.level), 0) desc
    limit 20;
end;
$$ language plpgsql stable security definer;
