# 로컬 개발 / 배포 참고

## 로컬 실행

- `.env` 필요(`.env.example` 참고): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `npm install && npm run dev`로 로컬 확인, `npm run build`로 빌드 검증 후 커밋하는 것이 원칙
- GitHub push는 fine-grained PAT(레포 한정, Contents Read/write 권한) 사용 중

## Supabase 마이그레이션 적용

- Supabase 프로젝트에 `supabase/migrations/*.sql`을 **001부터 순서대로** 적용해야 함
- 과거엔 SQL Editor에 수동으로 붙여넣어서 실행했지만, 지금은 **GitHub Actions로 자동화**되어 있음

### GitHub Actions

- `.github/workflows/supabase-migrate.yml`: `supabase/migrations/**` 경로에 변경이 push되면 자동으로 `supabase link` → `supabase db push` 실행. Actions 탭에서 "Run workflow"로 수동 실행도 가능
- `.github/workflows/supabase-repair.yml`: 과거에 SQL Editor로 수동 적용했던 마이그레이션들이 CLI의 이력 테이블에는 기록이 없어서 `supabase db push`가 처음부터 재실행을 시도하며 "이미 존재함" 에러가 났던 문제를 해결하기 위한 **1회성 복구 도구**. `supabase migration repair --status applied <버전들>`로 기존 마이그레이션을 "이미 적용됨"으로 표시만 해줌. workflow_dispatch로 수동 실행.
- 필요한 GitHub 저장소 Secrets: `SUPABASE_ACCESS_TOKEN`(개인 액세스 토큰), `SUPABASE_PROJECT_REF`(프로젝트 참조 ID), `SUPABASE_DB_PASSWORD`(DB 비밀번호) — 전부 GitHub 저장소 Settings → Secrets에서 등록, 채팅에 노출 금지

### 과거 배포 이슈 노트

- `calc_combat_power`가 `language sql`인데 몸통을 `begin/return/end`(plpgsql 문법)로 써서 문법 오류가 난 적 있음 → `language sql` 함수는 몸통이 순수 SQL 표현식(`select ...`)이어야 하고 `begin/end` 블록을 쓰면 안 됨(그건 `language plpgsql` 전용 문법)
- "column reference X is ambiguous" 버그 패턴은 [`security.md`](./security.md) 참고
- **함수 반환 컬럼을 추가/삭제/타입변경하는 재정의는 `CREATE OR REPLACE FUNCTION`만으로 안 됨** — PostgreSQL은 기존 함수의 리턴 타입(TABLE의 OUT 파라미터 구성)이 다르면 `cannot change return type of existing function` 에러를 내고 배포가 그 자리에서 실패함(050에서 `fetch_leaderboard()`에 `equipped_title` 컬럼을 추가하다가 실제로 발생, GitHub Actions 로그로 확인 후 수정). **반환 컬럼 목록이 바뀌는 재정의를 할 때는 `CREATE OR REPLACE` 앞에 `DROP FUNCTION IF EXISTS 함수명(인자타입...)`을 반드시 먼저 넣을 것.** 반대로 반환 컬럼이 그대로고 함수 몸통(로직)만 바뀌는 경우는 `CREATE OR REPLACE`만으로 충분하고 DROP이 불필요함(이 프로젝트의 절대다수 재정의 패턴). 새 마이그레이션을 작성할 때 함수의 `returns table(...)` 목록을 이전 정의와 diff해서, 컬럼이 하나라도 늘거나 줄거나 이름/타입이 바뀌면 DROP을 추가해야 함을 항상 체크할 것.

## 프론트엔드 안전망 — 에러 바운더리

`main.jsx`에서 `<App />`을 `<ErrorBoundary>`로 감싸둠(`components/ErrorBoundary.jsx`). React는 렌더링 중 처리 안 된 예외가 나면 기본적으로 앱 전체를 unmount시켜서 화면이 완전히 하얗게 깨지는데(사용자는 원인도 모르고 새로고침 외엔 방법이 없음), 이 컴포넌트가 그 예외를 붙잡아서 "오류가 발생했어요 + 새로고침" 복구 화면을 대신 보여줌.

- 게임 로직/서버와는 전혀 관여하지 않는 순수 방어적 UI 안전장치라, 평소(에러가 없을 때)엔 아무 영향도 없음
- React의 에러 바운더리는 클래스 컴포넌트 API(`componentDidCatch`/`getDerivedStateFromError`)로만 구현 가능(hooks로는 아직 안 됨) — React 프레임워크 자체의 제약이라 이 파일만 예외적으로 클래스 컴포넌트로 작성됨(나머지 전부 함수형 컴포넌트인 이 프로젝트에서 유일한 클래스 컴포넌트)
- 이벤트 핸들러 안에서 발생하는 에러(예: 버튼 클릭 콜백 안의 예외)는 에러 바운더리가 못 잡음(React의 공식 제약) — 렌더링 중 발생하는 에러만 잡을 수 있음. 이벤트 핸들러 쪽은 각 컴포넌트가 개별적으로 try/catch 하는 기존 패턴을 그대로 유지해야 함

## 과거에 있었던 CSS 스크롤 버그

`html, body, #root`에 `height: 100%`(고정값)를 주면 콘텐츠가 뷰포트보다 길어질 때(예: 상점 화면) 하단이 스크롤되지 않고 잘리는 문제가 있었음. `min-height: 100%`로 바꿔서 해결함 — 비슷한 "화면 하단 짤림" 이슈 재발 시 이 부분부터 의심할 것(자세한 내용은 [`ui-and-ux.md`](./ui-and-ux.md)).

## 문서 관리 원칙

- 이후 기능이 추가/수정될 때마다 **`harness/` 폴더의 관련 파일도 같은 커밋에서 함께 업데이트**함(해당 파일의 관련 섹션만 갱신, 전체 재작성 아님)
- 새 기능 추가 시 최소한 다음을 갱신: 관련 카테고리 파일의 표/목록, `database-schema.md`에 새 migration 요약 한 줄, 필요 시 `todo.md` 항목 정리, 보안 관련 변경이면 `security.md`도 갱신
- 새 카테고리(예: 완전히 새로운 시스템)가 추가되면 `harness/`에 새 `.md` 파일을 만들고 `README.md`의 목차 표에도 추가할 것
- 이 폴더는 대화 히스토리가 없는 상태에서 프로젝트를 새로 파악하기 위한 **단일 진실 공급원(single source of truth)** 역할을 하는 것이 목적이므로, 실제 코드와 어긋나지 않도록 유지하는 것을 최우선으로 함
- (참고) 예전에는 이 모든 내용이 루트의 `info.md` 파일 하나에 들어있었으나, 파일이 너무 커져서 카테고리별로 `harness/` 폴더에 분리함. `info.md`는 삭제되었고 더 이상 참조하지 않음.
