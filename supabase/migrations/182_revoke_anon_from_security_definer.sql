-- ============================================
-- 182: [Supabase 린터 지적] "Public Can Execute SECURITY DEFINER Function" 대량
-- 경고 일괄 수정(사용자 제보) - 로그인 안 한 anon 롤이 SECURITY DEFINER 함수를
-- 호출할 수 있는 상태를 전부 잠금.
--
-- 문제: PostgreSQL은 함수를 만들면 기본적으로 PUBLIC(= anon+authenticated 전부
-- 포함)에게 EXECUTE 권한을 자동으로 줌. 이 프로젝트의 거의 모든 함수는 몸통 맨 앞에
-- `if auth.uid() is null then raise exception ...`를 넣어서 실질적으로는 이미
-- anon 호출을 막고 있었지만(로그인 안 하면 즉시 예외로 막힘), "함수를 아예 시도할
-- 권한 자체"는 계속 열려있었음 - 180/181과 같은 계열의 "이미 안전하게 짜여있었지만
-- 방어 계층이 없었던" 케이스.
--
-- 수정: public 스키마의 SECURITY DEFINER 함수 전부에서 anon(및 PUBLIC 전체)의
-- 실행권한을 회수하고, 로그인 유저(authenticated)에게만 다시 부여함. 트리거 함수
-- (반환타입 trigger)는 애초에 REST API로 직접 호출되는 대상이 아니라서 제외.
-- 이미 authenticated한테도 실행을 막아둔 내부전용 함수 6개(add_gold/spend_gold/
-- buy_item/enhance_item/grant_guild_exp/grant_season_points)는 건드리면 오히려
-- 다시 열어버리는 역효과가 나므로 명시적으로 제외함.
--
-- ⚠️ 반대로 로그인 화면(AuthScreen.jsx, 아직 세션이 없는 상태)에서 실제로 호출되는
-- 3개 함수(is_nickname_taken - 회원가입 시 닉네임 중복확인, find_masked_email_by_nickname
-- - 이메일 찾기, fetch_total_achievement_claims - 로그인 화면의 누적 통계 표시)는
-- anon 접근이 반드시 필요해서 일괄 회수 대상에서 제외함. 이걸 놓치고 무작정
-- 전부 잠갔으면 회원가입 자체가 막히는 심각한 장애로 이어졌을 것.
-- ============================================

do $$
declare
  r record;
  v_count integer := 0;
  v_internal_only text[] := array[
    'add_gold', 'spend_gold', 'buy_item', 'enhance_item', 'grant_guild_exp', 'grant_season_points'
  ];
  v_needs_anon text[] := array[
    'is_nickname_taken', 'find_masked_email_by_nickname', 'fetch_total_achievement_claims'
  ];
begin
  for r in
    select p.oid::regprocedure as func_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true -- security definer 함수만
      and p.prorettype <> 'trigger'::regtype -- 트리거 함수는 REST RPC 대상이 아니므로 제외
      and p.proname <> all(v_internal_only) -- 이미 완전 잠긴 내부전용 함수는 그대로 둠
      and p.proname <> all(v_needs_anon) -- 로그인 전 화면에서 필요한 함수는 그대로 둠
  loop
    execute format('revoke execute on function %s from public', r.func_signature);
    execute format('grant execute on function %s to authenticated', r.func_signature);
    v_count := v_count + 1;
  end loop;
  raise notice '% 개 함수에서 anon 실행권한 회수, authenticated에만 재부여 완료', v_count;
end $$;
