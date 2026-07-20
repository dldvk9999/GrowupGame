# 친구 시스템 (migration 129, 신규 콘텐츠, 사용자 요청)

관련 파일: `components/Friends.jsx`, `lib/friends.js`, migration 129

## 개요

UID(Supabase auth user id, uuid)를 서로 공유해서 친구를 맺는 시스템. **반드시 상대가 수락해야 친구가 성립**되고(일방적 등록 불가), 최대 100명까지. 헤더의 "👥 친구" 버튼(마이페이지 옆)으로 진입 — 하단 게임 탭이 아니라 마이페이지/설정과 같은 성격의 오버레이 화면(`activeTab === 'friends'`, `Esc`로 닫기 가능).

## 스키마 설계

요청/성립을 별도 테이블로 분리:

- **`friend_requests`**: 대기 중인 요청만 존재. `unique(requester_id, target_id)`로 중복 요청 방지, `check(requester_id <> target_id)`로 자기 자신 요청 원천 차단. 수락되면 이 행은 삭제되고 `friendships`로 옮겨감(거절/취소되면 그냥 삭제).
- **`friendships`**: 성립된 친구 관계. **양방향 2행**(`(A,B)`와 `(B,A)`)으로 저장해서, "내 친구 목록" 조회가 `where user_id = 나`만으로 끝나게 함(조인/OR 조건 없이 단순).
- 둘 다 RLS로 본인 관련 행만 조회 가능, INSERT/UPDATE/DELETE는 `authenticated`에서 회수(다른 테이블들과 동일 패턴) — 실제 쓰기는 아래 security definer 함수들 내부에서만 일어남.

## 요청/수락 흐름

- `send_friend_request(p_target_id)`: 자기 자신 차단, 대상 유저 존재 확인, 이미 친구/이미 요청 보냄/**상대가 나에게 이미 요청을 보낸 경우**(친절하게 "요청함에서 수락하라"고 안내)까지 전부 명확한 에러 메시지로 거부. **나 또는 상대 중 누구라도 100명이 꽉 차 있으면 요청 자체를 막음**(사용자 요청: "상대가 더 이상 수락할 수 없으면 친구초대도 못 보내게 해줘")
- `accept_friend_request(p_requester_id)`: 요청 삭제 + `friendships`에 양방향 2행 삽입. **수락 시점에도 100명 제한을 한 번 더 확인**(요청 보낸 뒤 그 사이 다른 요청들을 왕창 수락해서 꽉 찼을 수 있음 — TOCTOU 성격의 엣지케이스를 막기 위함)
- `reject_friend_request`/`cancel_friend_request`: 각각 받은 요청 거절(상대가 다시 보낼 수 있음)/내가 보낸 요청 취소
- `remove_friend(p_friend_id)`: 양방향 두 행 모두 삭제

## 조회 (페이지네이션)

- `fetch_my_friends(p_page)` — 페이지당 20명(`p_page`는 0부터), 닉네임/장착칭호와 함께 반환. `total_count`를 매 행에 동봉해서(약간의 중복이지만 페이지네이션 UI가 별도 count 쿼리 없이 바로 총 페이지 수를 계산할 수 있게 함) 클라이언트가 "◀ 이전 / N of M / 다음 ▶" UI를 간단히 구현
- `fetch_incoming_friend_requests()` / `fetch_outgoing_friend_requests()` — 각각 받은/보낸 요청 목록(정렬: 최신순). "요청함" 탭에서 둘 다 보여줌, 받은 요청이 있으면 탭 버튼에 미확인 점(`mail-unread-dot` 재사용) 표시

## UID 복사/입력

- 마이페이지가 아니라 **친구 화면 상단**에 "내 UID" + 복사 버튼(`clipboard.js` 공용 유틸 재사용) — 붙여넣기용 input과 나란히 배치해서 "복사→상대에게 전달→상대가 붙여넣기" 흐름이 한 화면에서 자연스럽게 이어지도록 함
- UID는 순수 텍스트 입력(형식 검증 없음) — 잘못된 UID를 넣으면 서버가 "존재하지 않는 유저입니다" 에러로 안내

## 알려진 범위

- 친구 신청/수락에 대한 알림(우편/토스트)은 아직 없음 — 받은 요청은 "친구" 화면에 직접 들어가야 확인 가능(추후 우편함 연동 검토 가능)
- 친구 목록에서 상대 프로필(전투력/스테이지 진행도 등)을 바로 보는 기능은 아직 없음 — 닉네임/칭호만 표시
