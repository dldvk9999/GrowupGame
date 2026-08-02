# 로비 (채팅 + 랭킹)

관련 파일: `LobbyChat.jsx`, `useLobbyChat.js`, `Leaderboard.jsx`, `lib/leaderboard.js`, migration 025/027/048

## 개요

- Supabase Realtime으로 `chat_messages` 구독, **로그인 시점(sinceIso) 이후 메시지만 로드** + 신규 메시지 실시간 반영
- **실시간 접속자 수**(Presence) — `useLobbyChat`이 `lobby-chat` 채널에 자기 자신을 `track()`하고, `presenceState()` 키 개수를 헤더에 표시. Supabase Realtime Presence 기반이라 **가짜/시뮬레이션 값이 아니라 실제 연결 수**임(사용자가 "진짜 접속자 수가 맞는지" 재확인 요청 — 검증 결과 정상 작동, 삭제할 필요 없었음). 다만 "게임 전체 접속자 수"가 아니라 **지금 이 로비/채팅 화면을 보고 있는 사람 수**로 스코프가 좁다는 점이 라벨만 봐서는 헷갈릴 수 있어서, 문구를 "🟢 N명 접속 중" → **"🟢 지금 로비를 보는 중 N명"**으로 바꾸고 `title` 툴팁("게임 전체 접속자 수가 아니에요")도 추가함(사회적 실재감을 주는 장치, 같은 유저가 탭을 여러 개 열면 각각 카운트됨 — 순유저 수가 아닌 연결 수 근사치)
- **로그아웃하면(=`LobbyChat` 언마운트) 로컬 화면에서 대화 내역이 사라짐** — "내가 로그인한 동안만 보이는 범위"를 좁힌 것뿐, `chat_messages` 테이블에서 실제 삭제되진 않음(다른 유저는 계속 볼 수 있음). `App.jsx`가 세션 확립 시마다 `loginAt`을 기록해 `useLobbyChat(profile, sinceIso)`에 넘기고, 로그아웃 시 `null`로 되돌림
- 닉네임은 서버 트리거가 `chat_messages.nickname`을 강제로 덮어씀(004) — 사칭 불가능
- 하단 탭 "💬 로비"에서 접근, 최대 200자, 전체 유저 공용(방 구분 없음)
- 048부터 로비 안에 "💬 채팅" / "🏆 랭킹" 서브탭
- **빠른 채팅 버튼 (신규 콘텐츠)**: 입력창 위에 "안녕하세요 👋" 등 6개 프리셋 버튼(순수 클라이언트 상수, 서버 로직 없음). 탭하면 바로 `sendMessage()`로 전송 — 직접 타이핑하는 진입장벽을 낮춰서 로비가 더 활기차 보이게 하는 목적. 일반 전송과 동일한 경로를 타므로 027의 2초 rate limit도 동일하게 적용됨(연속 탭하면 에러 메시지 그대로 노출)

## 랭킹(명예의 전당) — migration 048

전투력 기준 전체 유저 상위 50명을 보여주는 읽기 전용 랭킹. 경쟁/비교로 재방문을 유도하는 장치.

- `owned_monsters`/`profiles`는 본인만 조회 가능한 RLS라, **`fetch_leaderboard()` security definer RPC**가 필요한 필드(닉네임/레벨/전직단계/속성/전투력)만 안전하게 반환. 골드/이메일 등 민감정보는 노출 안 됨
- 전투력은 PvP 시스템의 `calc_monster_stats` + `calc_combat_power`(023/029)를 재사용해 PvP와 항상 같은 기준. **051부터 장착 장비 4슬롯 보너스도 포함**([`pvp.md`](./pvp.md))
- 화면 진입 시 1회 자동 조회 + **"🔄 새로고침" 버튼**으로 수동 갱신(실시간 구독 없이 스냅샷). 새로고침 실패 시 기존 목록은 유지하고 토스트로만 알림
- `fetch_my_rank()`는 50위 밖이어도 실제 순위 계산(나보다 전투력 높은 인원 수 + 1)
- 활성 몬스터가 없는 유저(신규 가입 직후 등)는 join이 안 되어 랭킹에서 자동 제외
- 모바일 좁은 화면에서는 전직단계 컬럼 숨김
- **50위 밖일 때 내 정보 하단 표시**: 상위 50명에 내가 없으면 목록 아래에 점선 구분자와 함께 내 행을 별도 표시. 전투력은 PvP와 동일한 `fetchMyCombatPower()`(051) 재사용, 닉네임/레벨 등은 이미 있는 `profile`/`activeMonster`를 그대로 씀(추가 API 호출 없음)

## 길드 전용 채팅 (migration 170, 신규 콘텐츠, todo.md 후속과제 이행)

로비 채팅(001/004/025/027)과 **완전히 동일한 설계**를 `guild_id`로 스코프만 좁혀서 복제 — `guild_chat_messages` 테이블, `useGuildChat.js`(`useLobbyChat.js`와 동일 구조), `GuildLobby.jsx`에 채팅 UI 통합.

- **RLS로 "같은 길드원만 보고 쓸 수 있음"을 서버에서 강제** — `guild_members`에 같은 `guild_id`로 존재하는지 매번 서브쿼리로 확인. 로비 채팅과 달리 별도의 "게이트 함수" 없이 순수 RLS 정책만으로 충분(길드는 이미 멤버십 테이블이 있어서 자연스럽게 확인 가능)
- **닉네임 위조 방지 트리거는 로비 채팅과 같은 함수(`set_chat_nickname`, 004)를 재사용** — 테이블 무관 로직이라 함수를 새로 안 만들고 트리거만 이 테이블에 추가로 부착
- **도배 방지(2초 rate limit)는 함수를 새로 작성** — 027의 `enforce_chat_rate_limit`이 `chat_messages` 테이블명을 함수 본문에 하드코딩하고 있어서 재사용이 안 됨. `enforce_guild_chat_rate_limit`을 별도로 작성(로직은 동일, 대상 테이블만 다름)
- **realtime publication 등록을 처음부터 포함** — 로비 채팅이 025에서야 뒤늦게 "메시지가 아무한테도 실시간으로 안 뜨는" 문제를 겪었던 걸 알고 있어서, 이번엔 마이그레이션에 바로 `alter publication supabase_realtime add table guild_chat_messages`를 포함시킴
- **`GuildLobby.jsx`에 통합** — 별도 화면이 아니라 로비 화면 안에 채팅 UI를 그대로 넣음(로비 채팅과 동일한 `.lobby-chat-list`/`.lobby-chat-row`/`.lobby-chat-form` CSS 클래스 재사용, 시각적 일관성). `sinceIso`는 App.jsx의 `loginAt`을 `Friends`→`GuildPanel`→`GuildLobby`로 그대로 내려받아 로비 채팅과 동일하게 "로그인 시점 이후" 범위로 제한
- 온라인 접속자 수(Presence)는 이번엔 안 붙임 — 로비처럼 사람이 몰리는 공간이 아니라서 우선순위 낮음(필요해지면 후속 추가 가능)
- ⚠️ **[경미] `created_at` 위조로 도배방지 우회 가능하던 문제 수정(migration 173, 80차 심층점검에서 발견)**: 두 채팅 테이블은 이 프로젝트에서 클라이언트가 테이블에 직접 INSERT하는 유일한 경로라, `created_at`이 테이블 `DEFAULT(now())`일 뿐 강제 규칙이 아니었음 — 클라이언트가 과거 시각으로 위조한 `created_at`을 실어 보내면 도배방지 rate limit(027/170)의 "가장 최근 메시지가 몇 초 전인지" 확인을 항상 우회할 수 있었음. `set_chat_nickname`(로비/길드 채팅이 공유)에 `new.created_at := now();`를 추가해서 닉네임 위조 방지와 같은 지점에서 함께 차단



`useLobbyChat.js` 훅은 001/004 단계에서 이미 완성돼 있었음(최근 50개 로드 + Realtime INSERT 구독) — UI만 없어서 이후 `LobbyChat.jsx`로 연결함.

## 버그 수정 이력

⚠️ `chat_messages`가 `supabase_realtime` publication에 미등록이라, 메시지가 저장은 되는데 **아무한테도(본인 포함) 실시간으로 안 뜨는** 문제가 있었음(025에서 `alter publication supabase_realtime add table chat_messages`로 수정).

클라이언트도 realtime 수신 여부와 무관하게 동작하도록, `sendMessage`가 INSERT 결과를 받아 **보낸 즉시 내 화면에 반영**하게 바꿈(realtime으로 같은 메시지가 나중에 와도 `id` 기준 dedupe).

**앞으로 realtime 구독이 필요한 새 테이블은 publication 등록을 빠뜨리지 않도록 유의.**

## 보안 패치

⚠️ 채팅은 client가 테이블에 직접 INSERT하는 구조라 닉네임 사칭은 트리거로 막혀있었지만(004) **전송 속도 제한이 없어 봇 도배가 가능**했음. `chat_rate_limit_guard` 트리거로 **본인 기준 최소 2초 간격**을 강제(027).

## 랭킹 통합 허브 (신규 콘텐츠)

기존엔 전투력 랭킹(로비)/업적 랭킹(설정>업적 토글)/무한의 탑 랭킹(던전>탑)이 서로 다른 화면에 흩어져 있었음. `Leaderboard.jsx`(로비 "🏆 랭킹" 서브탭) 상단에 종류 선택 탭을 추가해서 한 화면에서 스위칭하며 볼 수 있게 함.

- 기존 위치는 **그대로 유지**(중복 접근 경로로 남겨둠) — 로비 통합 허브는 "한 곳에서 다 보고 싶을 때"용 추가 경로
- 업적/탑 랭킹은 `SimpleLeaderboard` 공용 컴포넌트로 렌더링 — 둘 다 "순위·닉네임·값 하나" 구조가 동일해서 props로 처리(코드 중복 방지)
- 전투력 랭킹은 컬럼 구성이 달라(속성/전직/레벨/전투력) 기존 로직을 `PowerLeaderboard`로 그대로 옮김

## 친구 추천 랭킹 추가 (migration 084, 신규 콘텐츠)

4번째 종류 "🤝 친구추천" — 누가 가장 많은 친구를 데려왔는지(`profiles.referred_by`) 집계한 TOP20. `fetch_referral_leaderboard()`/`fetch_my_referral_rank()`는 업적/탑 랭킹과 동일 패턴(security definer 집계, 개인정보 없음) — 기존 `SimpleLeaderboard`를 props만 새로 넘겨 그대로 재사용. 자체 스캐너 통과, 4탭 모바일 넘침 재검증 완료.

## 골드 재산 랭킹 추가 (migration 085, 신규 콘텐츠)

5번째 종류 "💰 재산" — 전체 유저 골드 보유량 TOP20. `profiles.gold`가 이미 공개 RLS라 직접 조회도 가능했지만, 다른 랭킹과 인터페이스 통일을 위해 동일한 RPC 패턴(`fetch_gold_leaderboard`/`fetch_my_gold_rank`)으로 만듦. `SimpleLeaderboard`에 `formatValue` prop 추가(골드 천단위 콤마). 극단값(9억대 골드+긴 닉네임+칭호) 모바일 실측 검증 완료.

## PvP 승수 랭킹 추가 (migration 112, 신규 콘텐츠)

6번째 종류 "🥊 PvP" — `profiles.pvp_wins` 기준 TOP20. 107~109로 PvP를 대폭 강화한 김에 랭킹 화면에도 추가해 경쟁 요소를 완성함. `fetch_pvp_leaderboard()`/`fetch_my_pvp_rank()`는 tower/referral 랭킹(071/084)과 완전히 동일한 패턴(security definer, `pvp_wins > 0`인 유저만 집계) — `SimpleLeaderboard`에 props만 새로 넘겨 그대로 재사용, 신규 함수라 DROP FUNCTION 불필요. 탭이 6개로 늘었지만 `.shop-tabs`가 이미 `flex-wrap: wrap`이라 모바일에서도 안전하게 줄바꿈됨(4탭 때부터 검증된 패턴 그대로 유지).

## 순위 변동 추적 (신규 콘텐츠, `lib/rankHistory.js`)

랭킹 화면 진입 때마다 저번 대비 순위 변동을 "▲5" / "▼3" 배지로 표시. 5개 종류 전부 각각 독립 추적(localStorage에 종류별 키). **순위 판정 자체는 항상 서버값 그대로, 이 모듈은 순수하게 "직전 로컬 저장값과의 차이"만 계산**하는 순수 재미 요소. 헤드리스 브라우저로 첫조회/상승/하락/순위권이탈 시나리오 검증 완료, 큰 순위 숫자(1234위) 모바일 넘침도 재검증.
