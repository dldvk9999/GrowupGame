-- ============================================
-- 180: [Supabase 린터 지적] relic_catalog에 RLS 활성화 (사용자 제보)
--
-- 119 작성 당시 "정적 카탈로그라 RLS 없이 전체 공개(다른 catalog 테이블들과 동일
-- 패턴)"라고 판단했었는데, 실제로 확인해보니 이 게임의 다른 카탈로그 테이블
-- (item_catalog 등, 004)은 전부 RLS를 켜고 "누구나 조회 가능" 정책을 명시하는
-- 방식이었음 - relic_catalog만 유일하게 RLS 자체를 꺼둔 예외였음(56개 테이블 전수
-- 스캔으로 확인, RLS 없는 테이블은 이거 하나뿐이었음).
--
-- 데이터 자체는 원래도 민감하지 않은 정적 밸런스 수치(유물 이름/등급/효과 배율)라
-- 실질적인 정보 유출 위험은 없었지만, "RLS를 끈 채로 공개"와 "RLS를 켜고 명시적으로
-- 전체공개 정책을 건" 것 사이엔 안전장치 계층 하나의 차이가 있음(예: 나중에 실수로
-- authenticated에 쓰기 권한을 잘못 부여해도 RLS가 있으면 정책이 막아주지만, RLS
-- 자체가 꺼져있으면 그 방어선이 아예 없음) - 다른 카탈로그 테이블들과 동일한 수준으로
-- 맞춰서 방어 계층을 하나 더 갖춤.
-- ============================================

alter table public.relic_catalog enable row level security;
create policy "relic_catalog는 누구나 조회 가능" on public.relic_catalog for select using (true);
revoke insert, update, delete on public.relic_catalog from authenticated;
