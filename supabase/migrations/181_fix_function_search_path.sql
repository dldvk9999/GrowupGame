-- ============================================
-- 181: [Supabase 린터 지적] "Function Search Path Mutable" 대량 경고(415개) 일괄 수정
-- (사용자 제보)
--
-- 문제: search_path를 명시적으로 고정하지 않은 함수는, 이론상 악의적인 유저가 검색
-- 경로상 먼저 조회되는 스키마에 동일한 이름의 함수/객체를 만들어서 함수 안의 "스키마
-- 없이 쓴 이름"의 해석을 가로챌 수 있는 위험이 있음(search path hijacking). 이
-- 프로젝트의 모든 함수는 이미 내부에서 테이블/함수를 `public.xxx` 형태로 전부
-- 스키마 명시해서 호출하는 관례를 지켜왔기 때문에 실질 위험은 낮았지만(180의
-- relic_catalog 건과 마찬가지로 "이미 안전하게 짜여있었지만 방어 계층이 없었던" 케이스),
-- Supabase 플랫폼 차원의 모범사례 체크리스트를 충족시키기 위해 명시적으로 고정함.
--
-- 함수가 180개 가까이 있어서 하나하나 ALTER FUNCTION을 나열하는 대신, 시스템
-- 카탈로그(pg_proc)를 순회하며 public 스키마의 모든 함수에 일괄 적용하는 DO 블록을
-- 사용함 - 여기서 도는 EXECUTE는 사용자 입력이 아니라 신뢰할 수 있는 시스템
-- 카탈로그(pg_proc)에서 나온 함수 시그니처만 조립하므로 SQL 인젝션 경로가 아님
-- (앱 코드에서 절대 금지하는 "사용자 입력을 SQL로 조립"과는 다른 성격의 관리용 스크립트).
--
-- search_path는 'public, extensions'로 고정함(public 하나만 넣지 않은 이유: 이
-- 프로젝트가 pgcrypto의 gen_random_uuid()를 29개 파일에서 광범위하게 쓰는데, 그
-- 확장이 실제로 어느 스키마에 설치돼있는지 이 환경에서 직접 확인할 방법이 없어서,
-- Supabase 최신 프로젝트의 관례적 위치인 extensions 스키마까지 같이 넣어 안전하게
-- 처리함 - public만 넣었다가 만약 pgcrypto가 extensions에 있었다면 우편함 발송 등
-- gen_random_uuid()를 쓰는 모든 기능이 한 번에 깨지는 심각한 사고로 이어질 수 있었음).
-- pg_catalog(now(), random() 등 내장함수)는 search_path 설정과 무관하게 항상
-- 암묵적으로 우선 조회되므로 별도로 넣지 않아도 안전함.
-- ============================================

do $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select p.oid::regprocedure as func_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p') -- 일반 함수/프로시저만(집계함수 등은 대상 아님, 이 프로젝트엔 없음)
  loop
    execute format('alter function %s set search_path = public, extensions', r.func_signature);
    v_count := v_count + 1;
  end loop;
  raise notice '% 개 함수에 search_path 고정 완료', v_count;
end $$;
