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
// 실제 Web Push 발송에는 web-push 라이브러리를 사용(esm.sh의 Deno 타겟 빌드로 import).
// 이 코드는 프로덕션 배포/실제 발송 테스트를 거치지 않았으므로, 배포 시 로그를 보며
// 한 번 점검해볼 것을 권장함.

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'https://esm.sh/web-push@3.6.7?target=deno';

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

serve(async (req) => {
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
