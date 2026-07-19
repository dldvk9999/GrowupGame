# 로컬 개발 / 배포 참고

## 로컬 실행

- `.env` 필요(`.env.example` 참고): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `npm install && npm run dev`로 로컬 확인, `npm run build`로 빌드 검증 후 커밋
- GitHub push는 fine-grained PAT(레포 한정, Contents Read/write 권한) 사용 중

## Supabase 마이그레이션 적용

- `supabase/migrations/*.sql`을 **001부터 순서대로** 적용해야 함
- 과거엔 SQL Editor에 수동 실행했지만, 지금은 **GitHub Actions로 자동화**됨

### GitHub Actions

- `.github/workflows/supabase-migrate.yml`: `supabase/migrations/**` 변경 push 시 자동으로 `supabase link` → `supabase db push` 실행. Actions 탭에서 수동 실행도 가능
- `.github/workflows/supabase-repair.yml`: 과거 SQL Editor로 수동 적용한 마이그레이션이 CLI 이력 테이블엔 기록이 없어서 `supabase db push`가 재실행을 시도하며 "이미 존재함" 에러가 났던 걸 해결하는 **1회성 복구 도구**. `supabase migration repair --status applied <버전들>`로 "이미 적용됨"만 표시. workflow_dispatch로 수동 실행
- 필요한 Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` — GitHub 저장소 Settings에서 등록, 채팅에 노출 금지

### 과거 배포 이슈 노트

- `calc_combat_power`가 `language sql`인데 몸통을 `begin/return/end`(plpgsql 문법)로 써서 문법 오류가 난 적 있음 → `language sql` 함수는 몸통이 순수 SQL 표현식이어야 함
- "column reference X is ambiguous" 패턴은 [`security.md`](./security.md) 참고
- **함수 반환 컬럼을 추가/삭제/타입변경하는 재정의는 `CREATE OR REPLACE FUNCTION`만으로 안 됨** — PostgreSQL은 리턴 타입 구성이 다르면 `cannot change return type of existing function` 에러로 배포가 실패함(050에서 `fetch_leaderboard()`에 컬럼 추가 시 실제 발생). **반환 컬럼이 바뀌는 재정의는 `CREATE OR REPLACE` 앞에 `DROP FUNCTION IF EXISTS 함수명(인자타입...)`을 반드시 먼저 넣을 것.** 컬럼이 그대로고 로직만 바뀌면 `CREATE OR REPLACE`만으로 충분(절대다수 패턴). 새 마이그레이션 작성 시 `returns table(...)`을 이전 정의와 diff해서 확인할 것

### 재사용 가능한 자동 검증 스크립트 (배포 전 점검용)

046(출석체크)에서 harness에 이미 정리된 "column reference is ambiguous" 패턴이 재발했던 걸 계기로, Python으로 전체 마이그레이션을 훑는 스캐너를 만들어 검증함(파일로 저장은 안 해뒀지만 필요할 때마다 다시 짜서 돌리면 됨):

1. **ambiguous column 자기참조 탐지**: `returns table(...)` 컬럼명을 추출한 뒤, 함수 본문의 `UPDATE ... SET col = col`(별칭 없이 좌변=우변, 우변에 `.` 없음)을 정규식으로 탐색. 046이 정확히 이 패턴이었고, 재검증 결과 059까지 다른 곳엔 없었음
2. **DROP 누락 탐지**: 같은 함수명이 여러 마이그레이션에서 재정의될 때 `returns` 절을 이전 버전과 비교, 달라졌는데 앞에 `DROP FUNCTION`이 없으면 경고

새 마이그레이션을 여러 개 작성한 뒤 배포 전엔 이 두 스캐너를 다시 돌려보는 걸 권장 — "알고 있는 패턴인데도 급하게 짜다 보면 또 틀리는" 실수를 자동으로 잡아줌.

## PWA 업데이트 알림 배너

`registerType: 'autoUpdate'`(vite.config.js)는 새 서비스워커를 백그라운드에서 자동 활성화하지만 **페이지를 강제로 새로고침하진 않아서**, 자주 배포하는 이 프로젝트 특성상 사용자가 새 버전을 못 알아챌 수 있었음.

→ `PwaUpdatePrompt.jsx`(`virtual:pwa-register/react`의 `useRegisterSW`)를 `App.jsx` 최상단(로그인 여부 무관하게 항상 렌더링)에 추가해서, 새 버전 감지 시 "🔄 새 버전이 있어요! [새로고침] [나중에]" 배너를 하단에 띄움.

- `onRegisteredSW`에서 30분마다 `registration.update()`를 직접 호출해 자체 폴링도 함(탭을 오래 켜둔 유저도 놓치지 않게)
- `virtual:pwa-register/react`를 직접 import하면 vite-plugin-pwa가 `index.html`에 자동 주입하던 등록 스크립트가 생략됨(중복 등록 방지, `dist/registerSW.js` 미생성으로 확인) — `injectRegister` 옵션은 따로 안 건드려도 됨

## 프론트엔드 안전망 — 에러 바운더리

`main.jsx`에서 `<App />`을 `<ErrorBoundary>`로 감쌈(`components/ErrorBoundary.jsx`). React는 렌더링 중 처리 안 된 예외가 나면 앱 전체를 unmount시켜 화면이 완전히 하얗게 깨지는데, 이 컴포넌트가 예외를 붙잡아 "오류가 발생했어요 + 새로고침" 복구 화면을 대신 보여줌.

- 게임 로직/서버와 무관한 순수 방어적 UI 안전장치라 평소엔 아무 영향 없음
- 에러 바운더리는 클래스 컴포넌트 API로만 구현 가능(hooks 미지원, React 자체 제약) — 이 프로젝트에서 유일한 클래스 컴포넌트
- 이벤트 핸들러 안 에러(예: 버튼 클릭 콜백)는 에러 바운더리가 못 잡음(React 공식 제약, 렌더링 중 에러만 잡음) — 이벤트 핸들러는 각 컴포넌트가 개별 try/catch 하는 기존 패턴 유지

## 과거에 있었던 CSS 스크롤 버그

`html, body, #root`에 `height: 100%`(고정값)를 주면 콘텐츠가 뷰포트보다 길어질 때(예: 상점 화면) 하단이 스크롤 안 되고 잘리는 문제가 있었음. `min-height: 100%`로 바꿔서 해결 — 비슷한 "화면 하단 짤림" 재발 시 이 부분부터 의심할 것([`ui-and-ux.md`](./ui-and-ux.md)).

## 문서 관리 원칙

- 기능이 추가/수정될 때마다 **`harness/` 관련 파일도 같은 커밋에서 함께 업데이트**(관련 섹션만 갱신, 전체 재작성 아님)
- 새 기능 추가 시 최소한: 관련 카테고리 파일의 표/목록, `database-schema.md`에 migration 요약 한 줄, 필요 시 `todo.md` 정리, 보안 관련이면 `security.md`도 갱신
- 새 카테고리(완전히 새로운 시스템)가 추가되면 `harness/`에 새 `.md`를 만들고 `README.md` 목차에도 추가
- 이 폴더는 대화 히스토리 없이 프로젝트를 파악하기 위한 **단일 진실 공급원** 역할이 목적이므로, 실제 코드와 어긋나지 않게 유지하는 게 최우선
- (참고) 예전엔 루트의 `info.md` 하나에 다 있었으나 너무 커져서 `harness/`로 카테고리별 분리함. `info.md`는 삭제되어 더 이상 참조하지 않음
