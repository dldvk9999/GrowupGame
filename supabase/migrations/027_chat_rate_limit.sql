-- ============================================
-- 027: 보안 점검 - 로비채팅 도배(스팸) 방지
-- 채팅은 RPC가 아니라 client가 테이블에 직접 INSERT하는 구조라(001),
-- 닉네임 사칭은 트리거로 막혀있었지만(004) 전송 속도 제한은 없었음 -
-- 봇으로 초당 수십~수백 개씩 도배가 가능한 상태였음.
-- Supabase SQL Editor에 순서대로 실행 (001~026 먼저 적용되어 있어야 함)
-- ============================================

create or replace function public.enforce_chat_rate_limit()
returns trigger as $$
declare
  v_last timestamptz;
begin
  select created_at into v_last from public.chat_messages
    where user_id = new.user_id
    order by created_at desc
    limit 1;

  if v_last is not null and now() - v_last < interval '2 seconds' then
    raise exception '메시지를 너무 빠르게 보내고 있어요. 잠시 후 다시 시도해주세요.';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists chat_rate_limit_guard on public.chat_messages;
create trigger chat_rate_limit_guard
  before insert on public.chat_messages
  for each row execute function public.enforce_chat_rate_limit();
