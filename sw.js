// そばミル サービスワーカー。消す控えは「sobamiru-」で始まるものだけ（同じアドレスのほかのアプリには触らない）
const CACHE = 'sobamiru-v2';
const MAPLIB = 'https://api.mapbox.com/mapbox-gl-js/';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('sobamiru-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // 地図の部品は一度取れたら控えを使う（電波の弱い店内でも画面が止まらないように）
  if (req.url.startsWith(MAPLIB)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
    return;
  }
  if (!req.url.startsWith(self.registration.scope)) return;
  // 自分のファイルは新しいものを取りに行き、1.8秒で返らなければ控えを使う
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const net = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) c.put(req, res.clone()); return res; });
    const hit = await c.match(req, { ignoreSearch: true });
    if (!hit) return net;
    return Promise.race([net.catch(() => hit), new Promise(r => setTimeout(() => r(hit), 1800))]);
  })());
});
