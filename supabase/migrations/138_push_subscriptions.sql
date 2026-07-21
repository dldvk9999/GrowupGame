-- ============================================
-- 138: 푸시 알림 구독 - 사용자 요청 ("아침/점심/저녁 보상 시 push 알림")
--
-- PWA는 Web Push API + Service Worker로 네이티브 앱처럼 푸시 알림을 받을 수 있음(기능
-- 자체는 표준 브라우저 API라 가능함을 확인). 이 마이그레이션은 "누구에게 보낼지"를
-- 저장하는 구독 테이블만 만듦 - 실제 발송은 Edge Function(supabase/functions/send-push)이
-- 하고, 그걸 정해진 시각에 트리거하는 건 pg_cron(수동 설정 필요, 아래 138_README 참고).
-- ============================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions는 본인 것만 조회" on public.push_subscriptions
  for select using (auth.uid() = user_id);
revoke insert, update, delete on public.push_subscriptions from authenticated;

/** 이 브라우저의 구독 정보를 저장(이미 있으면 갱신) - 알림 설정 켤 때 호출 */
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth_key text)
returns void as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth_key)
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = p_p256dh, auth_key = p_auth_key;
end;
$$ language plpgsql security definer;

/** 이 브라우저의 구독 해제 - 알림 설정 끌 때 호출 */
create or replace function public.remove_push_subscription(p_endpoint text)
returns void as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end;
$$ language plpgsql security definer;

/** 내가 지금 알림을 켜둔 상태인지(이 함수 하나로 여러 기기 중 하나라도 구독돼있으면 true) */
create or replace function public.has_push_subscription()
returns boolean as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return exists(select 1 from public.push_subscriptions where user_id = auth.uid());
end;
$$ language plpgsql security definer stable;
