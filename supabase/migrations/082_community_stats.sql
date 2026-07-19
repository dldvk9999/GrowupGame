-- ============================================
-- 082: 커뮤니티 현황판 (신규 콘텐츠) - 로그인 화면에 "전체 유저가 지금까지 달성한
-- 업적 총 횟수"를 보여주기 위한 집계 RPC.
-- achievement_claims가 "본인만 조회" RLS라 클라이언트가 직접 count 불가능해서
-- security definer로 대신 집계함(개인 식별정보 없이 총 개수 하나만 반환).
-- 로그인 여부와 무관하게(로그인 화면에서도) 호출 가능하도록 auth.uid() 체크 없음.
-- ============================================

create or replace function public.fetch_total_achievement_claims()
returns integer as $$
declare
  v_total integer;
begin
  select count(*) into v_total from public.achievement_claims;
  return coalesce(v_total, 0);
end;
$$ language plpgsql stable security definer;
