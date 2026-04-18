// 一望 Service Worker - 最小構成
// オフラインキャッシュはしない(シンプルさ優先)
// 将来的にオフライン対応するならここを拡張する

const CACHE_NAME = 'ichibou-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ネットワーク優先、失敗したらキャッシュから(今は何もキャッシュしないのでスルー)
self.addEventListener('fetch', (event) => {
  // PWAとして認識されるために最低限のfetchハンドラを持つ
  return;
});
