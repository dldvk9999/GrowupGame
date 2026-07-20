-- ============================================
-- 129: 친구 시스템 - 신규 콘텐츠(사용자 요청)
-- UID로 친구 요청을 보내고, 상대가 수락해야 친구가 성립되는 구조. 최대 100명까지.
-- 헤더의 "친구" 탭에서 페이지네이션으로 목록/요청함을 볼 수 있음(클라이언트).
--
-- friend_requests(대기 중인 요청)와 friendships(성립된 친구, 양방향 2행)를 분리해서
-- "요청함"과 "친구목록"을 서로 다른 화면/쿼리로 깔끔하게 나눌 수 있게 함.
-- ============================================

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (requester_id, target_id),
  check (requester_id <> target_id)
);
create index friend_requests_target_idx on public.friend_requests(target_id);
create index friend_requests_requester_idx on public.friend_requests(requester_id);

alter table public.friend_requests enable row level security;
create policy "friend_requests는 당사자만 조회" on public.friend_requests
  for select using (auth.uid() = requester_id or auth.uid() = target_id);
revoke insert, update, delete on public.friend_requests from authenticated;

create table public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friendships enable row level security;
create policy "friendships는 본인 것만 조회" on public.friendships
  for select using (auth.uid() = user_id);
revoke insert, update, delete on public.friendships from authenticated;

-- ============================================
-- 친구 요청 보내기 - UID(auth 유저 id)로 지정. 이미 친구/이미 요청 대기중/자기 자신/
-- 존재하지 않는 유저/(나 또는 상대가) 100명 꽉 찬 경우 전부 명확한 에러로 거부.
-- ============================================
create or replace function public.send_friend_request(p_target_id uuid)
returns void as $$
declare
  v_my_count integer;
  v_target_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_target_id = auth.uid() then
    raise exception '자기 자신에게는 친구 요청을 보낼 수 없습니다.';
  end if;
  if not exists (select 1 from public.profiles where id = p_target_id) then
    raise exception '존재하지 않는 유저입니다. UID를 다시 확인해주세요.';
  end if;
  if exists (select 1 from public.friendships where user_id = auth.uid() and friend_id = p_target_id) then
    raise exception '이미 친구예요.';
  end if;
  if exists (select 1 from public.friend_requests where requester_id = auth.uid() and target_id = p_target_id) then
    raise exception '이미 요청을 보냈어요.';
  end if;
  if exists (select 1 from public.friend_requests where requester_id = p_target_id and target_id = auth.uid()) then
    raise exception '상대가 이미 나에게 친구 요청을 보냈어요. 요청함에서 수락해보세요.';
  end if;

  select count(*) into v_my_count from public.friendships where user_id = auth.uid();
  if v_my_count >= 100 then
    raise exception '내 친구가 이미 100명이라 더 추가할 수 없어요.';
  end if;

  select count(*) into v_target_count from public.friendships where user_id = p_target_id;
  if v_target_count >= 100 then
    raise exception '상대의 친구 목록이 가득 차서(100명) 요청을 보낼 수 없어요.';
  end if;

  insert into public.friend_requests (requester_id, target_id) values (auth.uid(), p_target_id);
end;
$$ language plpgsql security definer;

-- ============================================
-- 친구 요청 수락 - 요청 삭제 + 양방향 friendships 2행 삽입.
-- 수락 시점에도 100명 제한을 한 번 더 확인함(요청 보낸 뒤 그 사이 다른 요청들을
-- 왕창 수락해서 꽉 찼을 수 있으므로).
-- ============================================
create or replace function public.accept_friend_request(p_requester_id uuid)
returns void as $$
declare
  v_my_count integer;
  v_requester_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not exists (select 1 from public.friend_requests where requester_id = p_requester_id and target_id = auth.uid()) then
    raise exception '유효하지 않은 친구 요청입니다.';
  end if;

  select count(*) into v_my_count from public.friendships where user_id = auth.uid();
  select count(*) into v_requester_count from public.friendships where user_id = p_requester_id;
  if v_my_count >= 100 or v_requester_count >= 100 then
    raise exception '친구 목록이 가득 차서(100명) 수락할 수 없어요.';
  end if;

  delete from public.friend_requests where requester_id = p_requester_id and target_id = auth.uid();

  insert into public.friendships (user_id, friend_id) values (auth.uid(), p_requester_id)
    on conflict do nothing;
  insert into public.friendships (user_id, friend_id) values (p_requester_id, auth.uid())
    on conflict do nothing;
end;
$$ language plpgsql security definer;

/** 받은 요청 거절(요청만 삭제, 다시 보낼 수 있음) */
create or replace function public.reject_friend_request(p_requester_id uuid)
returns void as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  delete from public.friend_requests where requester_id = p_requester_id and target_id = auth.uid();
end;
$$ language plpgsql security definer;

/** 내가 보낸 요청 취소 */
create or replace function public.cancel_friend_request(p_target_id uuid)
returns void as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  delete from public.friend_requests where requester_id = auth.uid() and target_id = p_target_id;
end;
$$ language plpgsql security definer;

/** 친구 삭제(양방향 모두 제거) */
create or replace function public.remove_friend(p_friend_id uuid)
returns void as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  delete from public.friendships where user_id = auth.uid() and friend_id = p_friend_id;
  delete from public.friendships where user_id = p_friend_id and friend_id = auth.uid();
end;
$$ language plpgsql security definer;

-- ============================================
-- 페이지네이션된 친구 목록(닉네임/칭호 포함) - p_page는 0부터 시작, 페이지당 20명.
-- ============================================
create or replace function public.fetch_my_friends(p_page integer default 0)
returns table(friend_id uuid, nickname text, equipped_title text, total_count integer) as $$
declare
  v_total integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select count(*) into v_total from public.friendships where user_id = auth.uid();

  return query
  select f.friend_id, p.nickname, p.equipped_title, v_total
  from public.friendships f
  join public.profiles p on p.id = f.friend_id
  where f.user_id = auth.uid()
  order by p.nickname
  limit 20 offset greatest(0, p_page) * 20;
end;
$$ language plpgsql stable security definer;

/** 내가 받은(수락 대기 중인) 친구 요청 목록 */
create or replace function public.fetch_incoming_friend_requests()
returns table(requester_id uuid, nickname text, created_at timestamptz) as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  return query
  select fr.requester_id, p.nickname, fr.created_at
  from public.friend_requests fr
  join public.profiles p on p.id = fr.requester_id
  where fr.target_id = auth.uid()
  order by fr.created_at desc;
end;
$$ language plpgsql stable security definer;

/** 내가 보낸(상대 수락 대기 중인) 친구 요청 목록 - UI에서 "요청 보냄" 상태 표시용 */
create or replace function public.fetch_outgoing_friend_requests()
returns table(target_id uuid, nickname text, created_at timestamptz) as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  return query
  select fr.target_id, p.nickname, fr.created_at
  from public.friend_requests fr
  join public.profiles p on p.id = fr.target_id
  where fr.requester_id = auth.uid()
  order by fr.created_at desc;
end;
$$ language plpgsql stable security definer;
