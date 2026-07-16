# 로비 채팅

관련 파일: `LobbyChat.jsx`, `useLobbyChat.js`, migration 025/027

## 개요

- Supabase Realtime으로 `chat_messages` 테이블 구독, 최근 50개 로드 + 신규 메시지 실시간 반영
- 닉네임은 서버 트리거가 `chat_messages.nickname`을 강제로 덮어씀(migration 004) — client가 아무 닉네임이나 보내도 실제 저장되는 건 본인 프로필 닉네임이라 사칭 불가능
- 하단 탭 "💬 로비"에서 접근, 최대 200자, 전체 유저 공용(방 구분 없음)

## 구현 히스토리

`useLobbyChat.js` 훅은 사실 초기 001/004 마이그레이션 단계에서 이미 완성돼 있었음(최근 50개 로드 + Supabase Realtime `postgres_changes` INSERT 구독) — UI만 없었던 상태라 이후 `LobbyChat.jsx`를 새로 만들어서 연결함.

## 버그 수정 이력

⚠️ `chat_messages` 테이블이 `supabase_realtime` publication에 등록이 안 돼있어서, 메시지는 서버에 정상 저장되는데도 **아무한테도(보낸 사람 본인 포함) 실시간으로 화면에 안 뜨는** 문제가 있었음(migration 025에서 `alter publication supabase_realtime add table chat_messages`로 수정).

추가로 클라이언트도 realtime 수신 여부와 무관하게 항상 동작하도록, `sendMessage`가 INSERT 결과를 직접 받아서 **보낸 즉시 내 화면에 바로 반영**하게 바꿈(realtime으로 같은 메시지가 나중에 도착해도 `id` 기준으로 중복 추가 안 되게 dedupe 처리).

**앞으로 realtime 구독이 필요한 새 테이블을 추가할 때는 `supabase_realtime` publication 등록을 빠뜨리지 않도록 유의.**

## 보안 패치

⚠️ 채팅은 RPC가 아니라 client가 테이블에 직접 INSERT하는 구조라, 닉네임 사칭은 트리거로 막혀있었지만(004) **전송 속도 제한이 없어서 봇으로 도배가 가능했음**. `chat_rate_limit_guard` 트리거로 **본인 기준 최소 2초 간격**을 강제하도록 수정(migration 027).
