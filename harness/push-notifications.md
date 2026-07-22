# 푸시 알림 (신규, 사용자 요청)

관련 파일: `src/sw.js`(커스텀 서비스워커), `lib/push.js`, `components/GameGuide.jsx`(설정 토글), migration 138, `supabase/functions/send-daily-push/index.ts`, `supabase/functions/139_push_cron_schedule.sql.template`

## 결론 먼저: 가능함, 단 서버 인프라 설정이 별도로 필요함

PWA는 **Web Push API + Service Worker**로 네이티브 앱처럼 브라우저가 꺼져있어도 푸시 알림을 받을 수 있음(표준 브라우저 기능, iOS Safari 16.4+/Android Chrome/데스크톱 전부 지원). 이번 세션에서 **클라이언트 쪽과 DB 스키마는 전부 구현·빌드 검증까지 완료**했지만, "아침/점심/저녁 정해진 시각에 실제로 발송"하려면 Supabase 프로젝트에 **이 세션에서는 직접 할 수 없는 수동 설정**(Edge Function 배포, 시크릿 등록, pg_cron 활성화)이 필요함 — 아래 "직접 해야 하는 일" 참고.

## 클라이언트 (완료, 빌드 검증됨)

- **서비스워커 전략 전환**: 기존 `generateSW`(자동생성, 커스텀 이벤트 리스너를 못 넣음) → `injectManifest`로 변경(`vite.config.js`). `src/sw.js`가 직접 만든 서비스워커 소스 — 기존 프리캐싱(`precacheAndRoute`, `cleanupOutdatedCaches`)은 그대로 유지하면서 `push`/`notificationclick` 이벤트 리스너를 추가함
  - `push` 이벤트: 서버가 보낸 JSON(`{title, body, url}`)을 파싱해서 `self.registration.showNotification()`으로 알림 표시
  - `notificationclick` 이벤트: 이미 열린 탭이 있으면 포커스, 없으면 새 창으로 앱을 열게 함
  - 빌드 시 `dist/sw.js`가 자동 생성되는 건 기존과 동일(파일명 그대로 유지해서 등록 로직 변경 불필요)
- **`lib/push.js`**: `isPushSupported()`(브라우저 지원 여부), `subscribeToPush()`(알림 권한 요청 → 구독 생성 → 서버에 저장), `unsubscribeFromPush()`(구독 해제 + 서버 기록 삭제), `isCurrentlySubscribed()`(브라우저 자체 상태 확인)
  - VAPID **공개키**만 클라이언트 상수로 둠(공개해도 안전 — 발신자 식별용, 개인키 아님)
- **설정 화면 토글(사용자 요청)**: `GameGuide.jsx`(설정 > 게임가이드, BGM/테마와 같은 "개인화 설정" 묶음)에 "🔔 알림" 섹션 추가 — 지원 안 하는 브라우저면 섹션 자체를 안 보여줌(`pushSupported` 체크). 켜면 구독+서버 저장, 끄면 구독 해제+서버 기록 삭제

## 서버 DB (migration 138, 완료)

- `push_subscriptions` 테이블: `user_id`, `endpoint`(unique), `p256dh`/`auth_key`(Web Push 암호화에 필요한 구독 키), RLS로 본인 것만 조회 가능
- `save_push_subscription`/`remove_push_subscription`/`has_push_subscription` — 전부 `auth.uid()` 범위로만 동작하는 security definer 함수

## 서버 발송 인프라

- **`supabase/functions/send-daily-push/index.ts`**: Edge Function(Deno) — `push_subscriptions` 전체를 조회해서 `web-push` 라이브러리로 각 구독자에게 Web Push 메시지 발송. 요청 body의 `{ slot: 'morning'|'lunch'|'dinner' }`에 따라 다른 문구 사용. 발송 실패 시 상태코드 410/404(구독 만료)면 해당 구독을 자동으로 정리함
  - ⚠️ **버그 수정(사용자 제보)**: 처음엔 `https://esm.sh/web-push@3.6.7?target=deno`로 불러왔는데, 실제 배포해서 호출해보니 Supabase Edge Runtime(프로덕션)에서 `Deno.core.runMicrotasks() is not supported in this environment` 크래시가 남 — esm.sh가 Node.js 패키지를 Deno용으로 트랜스파일하며 넣는 Node 호환 폴리필 레이어가, Edge Runtime의 축소된 Deno 환경과 안 맞아서 생기는 문제. **Supabase가 공식으로 지원하는 `npm:` 스펙파이어**(`import webpush from 'npm:web-push@3.6.7'`)로 교체 — Edge Runtime이 npm 패키지의 Node.js 호환을 esm.sh보다 훨씬 안정적으로 처리함. `createClient`도 esm.sh 대신 `jsr:@supabase/supabase-js@2`로, `serve()`도 외부 deno.land/std 의존 대신 **Deno 내장 전역함수 `Deno.serve`**로 바꿔서 외부 import 자체를 최소화(같은 종류의 호환성 문제가 재발할 여지를 줄임)
  - 이 수정은 로그로 원인을 확인한 뒤 반영한 것이라 이전보다 신뢰도가 높지만, **재배포 후 실제로 알림이 오는지는 다시 한 번 확인 필요**(esm.sh 문제는 실제 배포해봐야 드러나는 유형이었듯, npm: 방식도 첫 실사용 검증이 아직 남음)
- **`supabase/functions/139_push_cron_schedule.sql.template`**: pg_cron으로 매일 08:00/12:00/18:00(KST) 저 Edge Function을 호출하는 스케줄 — **일부러 `.sql.template` 확장자로 둬서 migrations 폴더 밖에 위치**시킴(자동 실행 방지, 실제 프로젝트 URL/서비스키를 채워야 의미 있는 파일이라 그대로 실행하면 안 됨)

### ⚠️ 배포하려면 사용자가 직접 해야 하는 일 (이 세션에서 불가능한 부분)

1. **VAPID 키페어를 Supabase 시크릿으로 등록**: `supabase secrets set VAPID_PRIVATE_KEY=... VAPID_PUBLIC_KEY=... VAPID_SUBJECT=mailto:본인이메일`(공개키는 `lib/push.js`에 이미 넣어둔 값과 동일해야 함 — 대화에서 직접 전달했고, 저장소에는 개인키를 절대 커밋하지 않음)
2. **Edge Function 배포**: `supabase functions deploy send-daily-push`
3. **`pg_cron`/`pg_net` 익스텐션 활성화**: Supabase 대시보드 Database > Extensions
4. **`139_push_cron_schedule.sql.template`의 `<PROJECT_REF>`/`<SERVICE_ROLE_KEY>`를 실제 값으로 채워서 SQL Editor에서 직접 실행**(파일 그대로 두면 플레이스홀더라 아무 효과 없음)
5. 배포 후 실제로 알림이 오는지 한 번 테스트해볼 것 — 이 코드는 프로덕션에서 발송 테스트를 거치지 않은 상태(Deno 환경에서 `web-push` 라이브러리의 esm.sh 트랜스파일이 실제로 문제없이 동작하는지는 배포 시점에 확인 필요)

## 알려진 한계

- 알림 시각(아침/점심/저녁)은 서버 cron 스케줄에 고정돼있고, 유저별 커스터마이징(원하는 시간대 선택 등)은 없음 — 필요하면 후속 작업
- iOS는 홈 화면에 "추가"된 PWA(Safari에서 "홈 화면에 추가")여야 푸시가 동작함 — 일반 사파리 탭에서는 iOS가 푸시를 지원 안 함(iOS 16.4+ 기준 표준 제약, 설정 화면에 별도 안내는 아직 없음)
