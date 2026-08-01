-- ============================================
-- 170: 길드 전용 채팅 신설 - 신규 콘텐츠(todo.md 후속과제 이행, 사용자 요청)
-- 기존 로비 채팅(001/004/025/027)과 완전히 동일한 패턴을 그대로 복제하되, guild_id로
-- 스코프를 좁힘: RLS로 "같은 길드원만 보고 쓸 수 있음"을 강제하고, 클라이언트는
-- 로비채팅처럼 테이블에 직접 INSERT + Realtime 구독하는 구조를 그대로 재사용함.
--
-- 닉네임 사칭 방지 트리거(set_chat_nickname, 004)는 테이블 무관 로직이라 함수는
-- 그대로 재사용하고 트리거만 이 테이블에 새로 붙임. 도배 방지 레이트리밋(027)은
-- 함수 본문이 chat_messages 테이블명을 하드코딩하고 있어서 재사용 불가 - guild_chat_messages
-- 전용으로 새로 작성함(같은 2초 제한).
-- ============================================

create table public.guild_chat_messages (
  id bigint generated always as identity primary key,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  nickname text not null,
  content text not null check (char_length(content) between 1 and 200),
  created_at timestamptz not null default now()
);
create index guild_chat_messages_guild_created_idx on public.guild_chat_messages(guild_id, created_at desc);

alter table public.guild_chat_messages enable row level security;

create policy "guild_chat_messages는 같은 길드원만 조회" on public.guild_chat_messages
  for select using (
    exists (
      select 1 from public.guild_members gm
      where gm.guild_id = guild_chat_messages.guild_id and gm.user_id = auth.uid()
    )
  );

create policy "guild_chat_messages는 같은 길드원 본인 이름으로만 작성" on public.guild_chat_messages
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.guild_members gm
      where gm.guild_id = guild_chat_messages.guild_id and gm.user_id = auth.uid()
    )
  );

revoke update, delete on public.guild_chat_messages from authenticated;

-- 닉네임 위조 방지 - 로비채팅과 동일 함수(set_chat_nickname, 004) 재사용, 트리거만 신규 부착
drop trigger if exists guild_chat_nickname_guard on public.guild_chat_messages;
create trigger guild_chat_nickname_guard
  before insert on public.guild_chat_messages
  for each row execute function public.set_chat_nickname();

-- 도배 방지 (로비채팅 027과 동일 취지, 테이블만 다름 - 함수 재사용 불가해 새로 작성)
create or replace function public.enforce_guild_chat_rate_limit()
returns trigger as $$
declare
  v_last timestamptz;
begin
  select created_at into v_last from public.guild_chat_messages
    where user_id = new.user_id
    order by created_at desc
    limit 1;

  if v_last is not null and now() - v_last < interval '2 seconds' then
    raise exception '메시지를 너무 빠르게 보내고 있어요. 잠시 후 다시 시도해주세요.';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists guild_chat_rate_limit_guard on public.guild_chat_messages;
create trigger guild_chat_rate_limit_guard
  before insert on public.guild_chat_messages
  for each row execute function public.enforce_guild_chat_rate_limit();

-- realtime publication 등록(025에서 로비채팅이 이걸 빠뜨렸다가 겪었던 "메시지가 아무한테도
-- 실시간으로 안 뜨는" 문제를 처음부터 예방)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'guild_chat_messages'
  ) then
    alter publication supabase_realtime add table public.guild_chat_messages;
  end if;
end $$;
