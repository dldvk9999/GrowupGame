# 계정 & 설정

관련 파일: `AuthScreen.jsx`, `auth.js`, `supabaseClient.js`, `MyPage.jsx`

## 인증

- **자동 로그인 체크박스**: 체크하면 세션이 `localStorage`(브라우저를 껐다 켜도 유지)에, 해제하면 `sessionStorage`(탭/브라우저 닫으면 사라짐)에 저장됨. 기본값 체크됨(true)
- `supabaseClient.js`의 커스텀 storage 어댑터(`customStorage`)가 `growupgame-remember-me` 플래그(항상 localStorage)를 보고 세션 토큰 저장 위치를 결정
- `setRememberMe(true/false)`를 로그인 시도 **직전**에 호출해야 함(`signInWithPassword`가 세션을 저장할 때 올바른 storage로 가도록) — `auth.js`의 `signIn()`이 이 순서를 보장
- 새 계정 첫 방문(플래그 없음)은 기본 sessionStorage 취급(브라우저 재시작 시 로그아웃) — 명시적으로 체크해야 영구 유지되는 흔한 "로그인 유지" UX 패턴
- 닉네임 중복확인은 실시간(`is_nickname_taken` RPC), 회원가입 시 `options.data.nickname`으로 서버에 전달됨

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
