# Supabase 세팅 가이드

## 1. DB 마이그레이션 실행
1. Supabase 대시보드 → SQL Editor 접속
2. `supabase/migrations/001_init.sql` 내용 전체 복사해서 붙여넣고 실행
3. Table Editor에서 `profiles`, `monster_species`, `owned_monsters`, `stage_progress`, `chat_messages` 생성됐는지 확인

## 2. 키 재발급 (중요, 아직 안 했으면 지금 하기)
채팅에 service_role 키/DB 비밀번호가 노출됐으므로 Supabase 대시보드 →
Project Settings → API 에서 키 재생성 필수.

## 3. 프론트엔드 연결
```bash
npm install @supabase/supabase-js
cp .env.example .env
```
`.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`(anon 또는 publishable 키)만 채우기.
service_role 키는 프론트엔드에 절대 넣지 않는다.

`src/lib/` 폴더를 프로젝트에 그대로 복사:
- `supabaseClient.js` — 클라이언트 초기화
- `auth.js` — 회원가입/로그인/닉네임 중복확인/프로필 수정
- `useLobbyChat.js` — 로비 실시간 채팅 훅

## 4. 사용 예시
```jsx
import { signUp, checkNicknameAvailable } from './lib/auth';
import { useLobbyChat } from './lib/useLobbyChat';

// 회원가입
await signUp({ email, password, nickname });

// 채팅
const { messages, sendMessage } = useLobbyChat(myProfile);
```

## 5. Realtime 활성화 확인
Supabase 대시보드 → Database → Replication 에서 `chat_messages` 테이블의
Realtime 토글이 켜져 있는지 확인 (기본적으로 꺼져있을 수 있음).
