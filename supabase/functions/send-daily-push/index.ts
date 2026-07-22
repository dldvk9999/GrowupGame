// supabase/functions/send-daily-push/index.ts
//
// 아침/점심/저녁 보상 시간대에 구독자 전원에게 푸시 알림을 보내는 Edge Function
// (신규, 사용자 요청). pg_cron이 정해진 시각(139 마이그레이션 참고)에 이 함수를
// HTTP로 호출하면, push_subscriptions 테이블의 구독자 전원에게 Web Push 메시지를 보냄.
//
// ⚠️ 배포 전 반드시 필요한 수동 설정(이 세션에서는 직접 못 함 - Supabase CLI/대시보드 필요):
//   1. VAPID 개인키를 시크릿으로 등록:
//      supabase secrets set VAPID_PRIVATE_KEY=<개인키>
//      supabase secrets set VAPID_PUBLIC_KEY=<공개키>  (src/lib/push.js와 동일한 값)
//      supabase secrets set VAPID_SUBJECT=mailto:you@example.com
//   2. 이 함수를 배포: supabase functions deploy send-daily-push
//   3. 139 마이그레이션의 pg_cron 스케줄을 실제 프로젝트 URL/서비스 키로 맞춰서 활성화
//
// 실제 Web Push 발송에는 web-push 라이브러리를 사용(npm: 스펙파이어로 import, 아래
// 참고). 이 코드는 Deno.core.runMicrotasks 관련 크래시를 겪은 뒤 npm: 방식으로
// 교체됐지만, 재배포 후 실제 발송이 되는지는 다시 한 번 확인해볼 것을 권장함.

// ⚠️ [버그 수정, 사용자 제보] 원래 esm.sh(Deno 타겟 트랜스파일)로 web-push를 불러왔는데,
// Supabase Edge Runtime(프로덕션)에서 "Deno.core.runMicrotasks() is not supported in this
// environment" 크래시가 남 - esm.sh의 Node.js 폴리필 레이어가 Edge Runtime의 축소된
// Deno 환경과 안 맞아서 생기는 문제. Supabase가 공식으로 지원하는 npm: 스펙파이어로
// 교체(Edge Runtime이 npm 패키지의 Node.js 호환을 esm.sh보다 훨씬 안정적으로 처리함).
// serve()도 deno.land/std 외부 의존 대신 Deno 내장 전역함수(Deno.serve)로 바꿔서
// 외부 import 자체를 최소화함(같은 종류의 호환성 문제가 또 날 여지를 줄임).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:example@example.com';

// 호출 시 body로 { slot: 'morning' | 'lunch' | 'dinner' }를 받아 문구를 고름(139의 pg_cron이 넘김)
const MESSAGES = {
  morning: { title: '☀️ 좋은 아침이에요!', body: '오늘의 출석 보상과 자동사냥 골드가 기다리고 있어요.' },
  lunch: { title: '🍚 점심시간이에요!', body: '잠깐 들러서 자동사냥 보상과 던전을 확인해보세요.' },
  dinner: { title: '🌙 저녁이 됐어요!', body: '오늘 하루 쌓인 보상을 챙겨가세요. 내일 출석도 잊지 마세요!' },
};

Deno.serve(async (req) => {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response('missing environment secrets', { status: 500 });
    }

    const { slot } = await req.json().catch(() => ({ slot: 'morning' }));
    const message = MESSAGES[slot] ?? MESSAGES.morning;

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key');
    if (error) throw error;

    const payload = JSON.stringify({ title: message.title, body: message.body, url: '/' });

    let sent = 0;
    let removed = 0;
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        );
        sent++;
      } catch (err) {
        // 410/404 = 구독이 더 이상 유효하지 않음(브라우저에서 알림 껐거나 오래된 구독) - 정리
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          removed++;
        }
      }
    }

    return new Response(JSON.stringify({ sent, removed, total: subs?.length ?? 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
