# 계정 & 설정

관련 파일: `AuthScreen.jsx`, `auth.js`, `supabaseClient.js`, `MyPage.jsx`

## 인증

- **자동 로그인 체크박스**: 로그인 화면에서 체크하면 세션이 `localStorage`(브라우저를 껐다 켜도 유지)에, 체크 해제하면 `sessionStorage`(탭/브라우저를 닫으면 사라짐)에 저장됨. 기본값은 체크됨(true)
- 구현은 `supabaseClient.js`에 커스텀 storage 어댑터(`customStorage`)를 넣어서, `growupgame-remember-me`라는 플래그(항상 localStorage에 기록)를 보고 실제 세션 토큰을 어디에 쓸지 그때그때 결정하는 방식
- `setRememberMe(true/false)`를 로그인 시도 **직전**에 호출해야 함(그래야 `signInWithPassword`가 세션을 저장할 때 올바른 storage로 감) — `auth.js`의 `signIn()`이 이 순서를 보장함
- 새 계정 첫 방문(플래그 없음)은 기본적으로 sessionStorage 취급(브라우저 재시작 시 로그아웃) — 명시적으로 체크해야 영구 유지되는, 흔한 "로그인 유지" UX 패턴
- 닉네임 중복확인은 실시간(`is_nickname_taken` RPC), 회원가입 시 `options.data.nickname`으로 서버에 전달됨

## 로그아웃 시 상태 초기화

`App.jsx`의 `handleSession(null)` 분기가 로그아웃을 감지해서 게임 데이터 state 전체(`profile`/`activeMonster`/`clearedStageIds`/`inventory`/`equipmentDrawProgress`/`userSkills`/`dungeonAttempts`/`dungeonProgress`/`dungeonBattle`/`jobDungeonBattle`/`worldBoss`/`worldBossProgress`/`worldBossSession`/`mission`/`hasUnreadMail`/`attendanceState`/`loginAt`/`currentStageIndex`/`activeTab` 등)를 초기값으로 리셋함 — 공유 기기에서 A 로그아웃 → B 로그인 시 새 세션 데이터가 로드되기 전까지 A의 잔여 데이터가 화면에 잠깐 보이는 걸 방지. 처음엔 `profile`/`activeMonster`/`loginAt` 몇 개만 초기화하다가 046/049 작업 때 `hasUnreadMail`/`attendanceState`를 빠뜨렸던 걸 계기로, 아예 게임 데이터 state 전체를 리셋하도록 정리함. 순수 UI 트랜지언트 플래그(로딩중 표시, 에러 메시지, 모바일 메뉴 열림 등)는 다음 액션에서 자연히 덮어써지므로 리셋 대상에서 제외함.

## 마이페이지

- 헤더의 "👤 마이페이지" 버튼(로그아웃 왼쪽)으로 진입. 하단 게임 탭에는 없음.
- 내 정보 확인: 닉네임, 이메일, 가입일, 보유 골드, 대표 몬스터 요약, 클리어 스테이지 수
- **닉네임 변경은 평생 1회만** 허용 — `profiles.nickname_edited` 플래그로 서버(RPC `update_nickname`)가 강제. 중복확인은 기존 `is_nickname_taken` RPC 재사용
- 회원가입 시 선택한 닉네임은 `signUp()`이 `options.data.nickname`으로 넘기고, `handle_new_user` 트리거가 그 값을 그대로 반영(이건 "1회 수정"에 포함되지 않는 최초 설정)
- `Esc` 키보드 단축키로 마이페이지/설정 화면 닫고 전투 탭으로 복귀 가능(자세한 내용은 [`ui-and-ux.md`](./ui-and-ux.md))

## 설정 화면

헤더의 "⚙️ 설정" 버튼으로 진입. 서브탭:
- 우편함 — [`mailbox-and-coupons.md`](./mailbox-and-coupons.md)
- 쿠폰 입력 — [`mailbox-and-coupons.md`](./mailbox-and-coupons.md)
