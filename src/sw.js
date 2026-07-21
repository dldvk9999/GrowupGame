import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

// vite-plugin-pwa(injectManifest)가 빌드 시 이 자리에 프리캐시 목록을 주입함
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

/**
 * 푸시 알림 수신 (신규, 사용자 요청) - 아침/점심/저녁 보상 알림 등.
 * 서버(Edge Function)가 Web Push 프로토콜로 보낸 메시지를 받아 알림으로 표시함.
 * payload는 JSON { title, body, icon?, url? } 형태로 보낸다고 가정.
 */
self.addEventListener('push', (event) => {
  let payload = { title: 'GrowupGame', body: '새로운 소식이 있어요!' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // JSON이 아니면 텍스트 그대로 body로 사용
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url || '/' },
    })
  );
});

/** 알림 클릭 시 앱 창으로 포커스 이동(이미 열려있으면 그 창을 쓰고, 없으면 새로 열기) */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
