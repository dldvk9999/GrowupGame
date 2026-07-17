# 로비 (채팅 + 랭킹)

관련 파일: `LobbyChat.jsx`, `useLobbyChat.js`, `Leaderboard.jsx`, `lib/leaderboard.js`, migration 025/027/048

## 개요

- Supabase Realtime으로 `chat_messages` 테이블 구독, **로그인한 시점(sinceIso) 이후의 메시지만 로드** + 신규 메시지 실시간 반영
- **로그아웃하면(=`LobbyChat`이 언마운트되면) 로컬 화면에서 그 대화 내역이 사라짐** — 단, 이건 "내가 로그인한 동안만 보이는 화면 범위"를 좁힌 것뿐이고, `chat_messages` 테이블 자체에서 실제로 삭제하는 건 아님(다른 유저들은 계속 그 메시지를 볼 수 있음). `App.jsx`가 세션이 확립될 때마다 `loginAt`(현재 시각)을 기록해서 `useLobbyChat(profile, sinceIso)`에 넘겨주고, 로그아웃 시 `loginAt`을 `null`로 되돌림
- 닉네임은 서버 트리거가 `chat_messages.nickname`을 강제로 덮어씀(migration 004) — client가 아무 닉네임이나 보내도 실제 저장되는 건 본인 프로필 닉네임이라 사칭 불가능
- 하단 탭 "💬 로비"에서 접근, 최대 200자, 전체 유저 공용(방 구분 없음)
- 048부터 로비 안에 "💬 채팅" / "🏆 랭킹" 서브탭이 생김(`LobbyChat.jsx`가 두 서브탭을 감쌈)

## 랭킹(명예의 전당) — migration 048

전투력 기준 전체 유저 상위 50명을 보여주는 읽기 전용 랭킹. 경쟁/비교 요소로 재방문을 유도하는 전형적인 장치.

- `owned_monsters`/`profiles`는 RLS로 본인 것만 조회 가능하므로, **`fetch_leaderboard()` security definer RPC**가 필요한 필드(닉네임/레벨/전직단계/속성/전투력)만 안전하게 계산해서 반환함. 골드/이메일 등 민감 정보는 노출 안 됨
- 전투력은 기존 PvP 시스템의 `calc_monster_stats` + `calc_combat_power`(023/029)를 그대로 재사용해서 산출 — PvP 전투력과 랭킹 전투력이 항상 같은 기준으로 일치함. **051부터 장착 장비 4슬롯 보너스(`calc_equipped_stat_bonus`)도 포함**됨(자세한 내용은 [`pvp.md`](./pvp.md))
- 클라이언트는 화면 진입 시 1회 자동 조회 + **"🔄 새로고침" 버튼**으로 수동 갱신 가능(실시간 구독 없이 요청 시점 스냅샷). 새로고침이 실패해도 기존에 보이던 목록은 그대로 유지하고 토스트로만 에러를 알림(최초 로드 실패와는 다르게 처리 — 목록이 갑자기 사라지는 걸 방지)
- `fetch_my_rank()`는 내가 50위 밖이어도 실제 순위를 알 수 있게 별도 계산(전체 유저 중 나보다 전투력 높은 인원 수 + 1)
- 활성 몬스터가 없는 유저(신규 가입 직후 등)는 랭킹에서 자동 제외됨(`owned_monsters` join 자체가 안 됨)
- 클라이언트는 화면 진입 시 1회만 조회하고 자동 갱신은 하지 않음(실시간 구독 없이 단순 스냅샷) — 화면을 나갔다 다시 들어오면 최신화됨
- 모바일 좁은 화면에서는 전직단계 컬럼을 숨겨서 가로 폭을 절약함
- **50위 밖일 때 내 정보 하단 표시**: 상위 50명 목록에 내가 없으면(`rows.some(is_me)`가 false), 목록 맨 아래에 점선 구분자와 함께 내 순위/닉네임/전투력 행을 별도로 붙여줌. 이때 필요한 내 전투력은 PvP 화면과 동일한 `fetchMyCombatPower()`(장비 보너스 포함, 051)를 재사용하고, 닉네임/레벨/전직단계/속성은 `App.jsx`가 이미 들고 있는 `profile`/`activeMonster`를 `LobbyChat` → `Leaderboard`로 그대로 내려받아 씀(추가 API 호출 없음)

## 구현 히스토리

`useLobbyChat.js` 훅은 사실 초기 001/004 마이그레이션 단계에서 이미 완성돼 있었음(최근 50개 로드 + Supabase Realtime `postgres_changes` INSERT 구독) — UI만 없었던 상태라 이후 `LobbyChat.jsx`를 새로 만들어서 연결함.

## 버그 수정 이력

⚠️ `chat_messages` 테이블이 `supabase_realtime` publication에 등록이 안 돼있어서, 메시지는 서버에 정상 저장되는데도 **아무한테도(보낸 사람 본인 포함) 실시간으로 화면에 안 뜨는** 문제가 있었음(migration 025에서 `alter publication supabase_realtime add table chat_messages`로 수정).

추가로 클라이언트도 realtime 수신 여부와 무관하게 항상 동작하도록, `sendMessage`가 INSERT 결과를 직접 받아서 **보낸 즉시 내 화면에 바로 반영**하게 바꿈(realtime으로 같은 메시지가 나중에 도착해도 `id` 기준으로 중복 추가 안 되게 dedupe 처리).

**앞으로 realtime 구독이 필요한 새 테이블을 추가할 때는 `supabase_realtime` publication 등록을 빠뜨리지 않도록 유의.**

## 보안 패치

⚠️ 채팅은 RPC가 아니라 client가 테이블에 직접 INSERT하는 구조라, 닉네임 사칭은 트리거로 막혀있었지만(004) **전송 속도 제한이 없어서 봇으로 도배가 가능했음**. `chat_rate_limit_guard` 트리거로 **본인 기준 최소 2초 간격**을 강제하도록 수정(migration 027).
