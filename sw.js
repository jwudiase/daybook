// 폰 앱(설치형 웹앱)용: 인터넷이 없어도 앱 화면이 열리도록 앱 파일을 기기에 보관한다.
// 온라인이면 항상 새 파일을 먼저 받고, 실패하면 보관본을 쓴다. 서버(Supabase) 요청은 건드리지 않는다.
const CACHE = 'daybook-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
  );
});
