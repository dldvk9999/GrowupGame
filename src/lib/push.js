import { supabase } from './supabaseClient';

// 공개키(VAPID Public Key) - 이건 공개해도 안전한 값(발신자 식별용, 개인키가 아님).
// 개인키는 서버(Edge Function)에서만 환경변수로 보관 - 절대 클라이언트/저장소에 두지 않음.
const VAPID_PUBLIC_KEY = 'BD0OVsmcZNsjm98f3tCKQQ-i0zYULQ24kptbv9vZHZ6E5QOLfaEBKDvoVZEgPQDc1C4n1Mn_BZ3u3nRjOG5tdyU';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/** 이 브라우저가 지금 실제로 구독돼있는지(서버 DB가 아니라 브라우저 자체 상태) */
export async function isCurrentlySubscribed() {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

/** 알림 권한 요청 + 구독 생성 + 서버에 저장 */
export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error('이 브라우저는 푸시 알림을 지원하지 않아요.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('알림 권한이 거부됐어요. 브라우저 설정에서 허용해주세요.');
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth_key: json.keys.auth,
  });
  if (error) throw error;
  return sub;
}

/** 구독 해제 - 브라우저 구독도 취소하고 서버 기록도 지움 */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await supabase.rpc('remove_push_subscription', { p_endpoint: endpoint }).catch(() => {});
}
