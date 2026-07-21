# 계정 & 설정

관련 파일: `AuthScreen.jsx`, `auth.js`, `supabaseClient.js`, `MyPage.jsx`

## 인증

- ⚠️ **가입/이메일변경 확인메일 리다이렉트 URL(사용자 요청/제보)**: `signUp`/`changeEmail` 둘 다 `emailRedirectTo: window.location.origin`을 명시 — Supabase 프로젝트의 기본 Site URL이 개발 중 localhost로 설정된 채 남아있으면 확인 메일 링크가 localhost를 가리키는 문제가 생길 수 있어서, 코드에서 "지금 접속한 주소"로 항상 덮어쓰게 함(배포 환경, `https://growup-game.vercel.app`에서는 자동으로 이 값이 됨). ⚠️ **Supabase 대시보드의 Site URL/Redirect URLs 설정 자체는 이 세션에서 직접 못 고침(코드 바깥 영역)** — 혹시 이 코드 수정 후에도 여전히 localhost가 보이면 Supabase 프로젝트 설정에서 Site URL을 직접 운영 주소로 바꿔야 함

- **자동 로그인 체크박스**: 체크하면 세션이 `localStorage`(브라우저를 껐다 켜도 유지)에, 해제하면 `sessionStorage`(탭/브라우저 닫으면 사라짐)에 저장됨. 기본값 체크됨(true)
- `supabaseClient.js`의 커스텀 storage 어댑터(`customStorage`)가 `growupgame-remember-me` 플래그(항상 localStorage)를 보고 세션 토큰 저장 위치를 결정
- `setRememberMe(true/false)`를 로그인 시도 **직전**에 호출해야 함(`signInWithPassword`가 세션을 저장할 때 올바른 storage로 가도록) — `auth.js`의 `signIn()`이 이 순서를 보장
- 새 계정 첫 방문(플래그 없음)은 기본 sessionStorage 취급(브라우저 재시작 시 로그아웃) — 명시적으로 체크해야 영구 유지되는 흔한 "로그인 유지" UX 패턴
- 닉네임 중복확인은 실시간(`is_nickname_taken` RPC), 회원가입 시 `options.data.nickname`으로 서버에 전달됨

## 이메일 찾기 / 비밀번호 초기화 (신규, 사용자 요청)

로그인 화면 하단에 "이메일 찾기" / "비밀번호 찾기" 링크 — `AuthScreen.jsx`가 `mode` 상태를 `'find-email'`/`'reset-password'`로 바꿔서 같은 화면 안에서 전용 미니 폼으로 전환(라우팅 없이 화면 자체가 3갈래).

- **이메일 찾기**: 닉네임을 입력하면 서버가 `find_masked_email_by_nickname(p_nickname)`(migration 135)로 이메일을 조회 — `auth.users`는 클라이언트가 직접 못 읽는 스키마라 security definer 함수 내부에서만 접근(001의 트리거가 이미 `auth.users`를 참조하는 전례가 있어 같은 패턴 재사용). **원문 이메일을 그대로 주지 않고 로컬파트 앞 2글자만 남기고 마스킹**(`ab***@gmail.com`)해서 반환 — 대량 이메일 수집에 악용되는 걸 막기 위함. 일치하는 계정이 없어도 `null` 반환(있는 닉네임인지 없는 닉네임인지로 계정 존재 여부를 유추하기 어렵게)
- **비밀번호 찾기**: Supabase 표준 흐름 그대로 — `sendPasswordResetEmail(email)`이 `supabase.auth.resetPasswordForEmail()`을 호출해서 재설정 링크 이메일을 보냄. 새 서버 함수 불필요(클라이언트 SDK 기능만 사용)
- ⚠️ **알려진 한계**: `find_masked_email_by_nickname`에 별도 요청 제한(rate limit)이 없음 — 같은 닉네임을 계속 조회해도 서버가 막지 않음(마스킹된 결과만 주므로 이메일 원문 유출 위험은 없지만, 존재 여부 확인용 무차별 대입에는 이론적으로 취약). 심각도가 낮다고 판단해 우선 문서화만 하고 별도 조치는 안 함

## 마이페이지 계정 관리 (신규, 사용자 요청)

마이페이지 하단 "계정 관리" — `AccountSecurityModal.jsx`가 2단계로 동작:

1. **본인 확인**: 현재 비밀번호를 입력하면 `verifyCurrentPassword(email, password)`가 `supabase.auth.signInWithPassword()`를 다시 호출해서 검증(이미 세션이 있어도, "지금 이 사람이 진짜 비밀번호를 아는지"를 한 번 더 확인하는 게이트 — 통과 못하면 예외로 막힘)
2. **변경**: 확인되면 이메일 변경/비밀번호 변경 폼이 열림
   - **이메일 변경**: `changeEmail(newEmail)` → `supabase.auth.updateUser({ email })` — Supabase가 새 이메일로 확인 메일을 보내고, **그 메일의 링크를 눌러야 실제로 반영됨**(즉시 바뀌는 게 아님, UI에 안내 문구로 명시)
   - **비밀번호 변경**: `changePassword(newPassword)` → `supabase.auth.updateUser({ password })` — 즉시 반영, 클라이언트에서 6자 이상 + 확인란 일치 검증 후 요청
- 서버 마이그레이션 없음(전부 Supabase Auth SDK 표준 기능 조합, 커스텀 RPC 불필요)

## 로그인 화면 전체 가입자 수 표시 (신규 콘텐츠)

로그인/회원가입 화면 상단에 "👥 N명의 조련사가 함께하고 있어요" 표시 — 커뮤니티가 활발하다는 첫인상. `profiles`의 SELECT RLS(`using (true)`)가 로그인 전(anon)에도 적용되어, `fetchTotalUserCount()`가 별도 RPC 없이 `count(*)` 쿼리로 조회. 조회 실패/0명이면 문구 자체를 숨김.

### 커뮤니티 현황판 확장 — 전체 업적 달성 횟수 (migration 082, 신규 콘텐츠)

가입자 수 아래에 "🏆 지금까지 N개의 업적이 달성됐어요" 추가. `achievement_claims`는 "본인만 조회" RLS라 직접 count 못하므로, `fetch_total_achievement_claims()`(security definer, 개인정보 없이 총 개수만 반환)로 집계 — `auth.uid()` 체크 없어 로그인 전 호출 가능(068 `fetch_element_popularity`와 동일 패턴). 두 줄이 연속 표시될 때 CSS 음수 마진이 겹치던 걸 실측 확인 후 수정(`.auth-user-count + .auth-user-count`로 두 번째 줄부터 마진 분리).

## 로그아웃 시 상태 초기화

`App.jsx`의 `handleSession(null)` 분기가 로그아웃을 감지해서 게임 데이터 state 전체를 초기값으로 리셋함 — 공유 기기에서 A 로그아웃 → B 로그인 시 A의 잔여 데이터가 잠깐 보이는 걸 방지. 처음엔 일부만 초기화하다가 046/049에서 몇 개를 빠뜨렸던 걸 계기로 전체 리셋으로 정리함. 순수 UI 트랜지언트 플래그(로딩중, 에러메시지 등)는 다음 액션에서 자연히 덮어써지므로 제외.

## 마이페이지

- 헤더의 "👤 마이페이지" 버튼(로그아웃 왼쪽)으로 진입. 하단 게임 탭에는 없음
- 내 정보: 닉네임, 이메일, 가입일(**D+N일째** 배지 동반 표시, 신규 콘텐츠 — 가입일부터 지금까지 며칠째인지 순수 클라이언트 계산, 흔한 앱 관습으로 소소한 애착/성취감 유도), 보유 골드, 대표 몬스터 요약, 클리어 스테이지 수
- **닉네임 변경은 평생 1회만** — `profiles.nickname_edited` 플래그로 서버(`update_nickname`)가 강제. 중복확인은 `is_nickname_taken` 재사용
- 회원가입 시 선택한 닉네임은 `signUp()`이 `options.data.nickname`으로 넘기고 `handle_new_user` 트리거가 반영(최초 설정이라 "1회 수정"에 미포함)
- `Esc` 키로 마이페이지/설정 닫고 전투 탭 복귀 가능([`ui-and-ux.md`](./ui-and-ux.md))

## 설정 화면

헤더의 "⚙️ 설정" 버튼으로 진입. 서브탭:
- **우편함**([`mailbox-and-coupons.md`](./mailbox-and-coupons.md)) — 읽지 않은 우편이 있으면 탭 버튼 자체에도 빨간 점(사용자 피드백, 기존엔 설정 버튼에만 통합 표시라 어느 탭인지 알기 어려웠음). `hasUnreadMail`을 그대로 내려받아 표시, 별도 서버 호출 없음
- 업적 — [`attendance-and-achievements.md`](./attendance-and-achievements.md)
- **게임가이드**(`GameGuide.jsx`, `lib/gameGuide.js`) — 전투/뽑기/전직/던전/PvP/일일루틴 6개 섹션의 순수 정적 온보딩 콘텐츠. 서버 데이터 아님, 마이그레이션 없이 텍스트만 수정 가능
- 쿠폰 입력 — [`mailbox-and-coupons.md`](./mailbox-and-coupons.md)
- **패치노트**(`PatchNotes.jsx`, `lib/patchNotes.js`) — 최근 업데이트를 보여주는 순수 정적 콘텐츠(클라이언트 하드코딩 배열). **하루 단위로 묶어서 관리**(사용자 요청, 2026-07-19 — 같은 날 여러 번 배포할 때마다 `(2)`, `(3)`...으로 계속 쪼개다 22개까지 늘어나서 통합함). 오늘 날짜 그룹이 있으면 `items` 배열 맨 앞에 새 줄만 추가, 날짜가 바뀌면 새 그룹 추가(규칙을 파일 상단 주석에도 명시). "계속 업데이트되고 있다"는 인상으로 재방문 동기를 높이는 목적. 안 본 최신 패치노트가 있으면 설정 버튼과 패치노트 탭 둘 다 빨간 점(`hasSeenLatestPatchNote`/`markLatestPatchNoteSeen`, localStorage에 마지막으로 본 날짜만 저장 — 계정과 무관하게 브라우저 기준). 탭을 한 번 열면 두 뱃지 즉시 사라짐
