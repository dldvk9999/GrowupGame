-- ============================================
-- 135: 닉네임으로 마스킹된 이메일 조회 - 사용자 요청("이메일 찾기")
--
-- 이메일 원문을 그대로 돌려주면 대량 이메일 수집/스팸에 악용될 수 있어서, 로컬파트
-- 앞 2글자만 남기고 나머지는 마스킹해서 반환함(도메인은 그대로 노출 - 어차피
-- gmail.com/naver.com 등 소수 도메인이라 마스킹 실익이 적음). 일치하는 계정이
-- 없으면 null 반환(클라이언트는 이때도 "찾을 수 없음"과 동일하게 안내해서, 있는
-- 닉네임인지 없는 닉네임인지로 계정 존재 여부를 유추하기 어렵게 함).
--
-- auth.users는 일반 클라이언트가 직접 조회 불가능한 스키마라, security definer
-- 함수 안에서만 접근(001의 트리거도 이미 auth.users를 참조하는 전례가 있음).
-- ============================================

create or replace function public.find_masked_email_by_nickname(p_nickname text)
returns text as $$
declare
  v_user_id uuid;
  v_email text;
  v_local text;
  v_domain text;
  v_at_pos integer;
begin
  select id into v_user_id from public.profiles where nickname = p_nickname;
  if v_user_id is null then
    return null;
  end if;

  select email into v_email from auth.users where id = v_user_id;
  if v_email is null then
    return null;
  end if;

  v_at_pos := position('@' in v_email);
  if v_at_pos <= 1 then
    return null; -- 형식이 이상하면 그냥 못 찾은 것처럼 처리
  end if;

  v_local := substring(v_email from 1 for v_at_pos - 1);
  v_domain := substring(v_email from v_at_pos);

  if length(v_local) <= 2 then
    return repeat('*', length(v_local)) || v_domain;
  end if;

  return substring(v_local from 1 for 2) || repeat('*', length(v_local) - 2) || v_domain;
end;
$$ language plpgsql security definer;

revoke all on function public.find_masked_email_by_nickname(text) from public;
grant execute on function public.find_masked_email_by_nickname(text) to authenticated, anon;
