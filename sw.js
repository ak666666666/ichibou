// 一望 Service Worker
// 2026-09-30: ページ本体(index.html)だけは毎回ネットから取る。
// GitHub Pages は max-age=600 を付けるので、放っておくとデプロイ後も最大10分(PWAだとそれ以上)
// 古いコードが動き続け、直したはずの同期の不具合が端末によって残る。
// オフラインのときだけ、最後に取れた版を出す。

const CACHE_NAME = 'ichibou-shell-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;   // ページ本体以外は触らない
  event.respondWith((async () => {
    try {
      const fresh = await fetch(req, { cache: 'no-store' });
      if (fresh && fresh.ok) {
        const c = await caches.open(CACHE_NAME);
        c.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (e) {
      const cached = await caches.match(req);
      return cached || Response.error();
    }
  })());
});
