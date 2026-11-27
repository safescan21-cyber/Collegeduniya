// Collegeolo service worker — makes the site installable and gives a basic offline page.
// Pages: network first (fresh data), falling back to cache, then /offline.
// Static assets (_next/static, icons): cache first.
const CACHE = 'ses-v1';
const OFFLINE = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, '/icons/icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // never touch Supabase / API calls
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api')) return;

  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
    })));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match(OFFLINE))),
    );
  }
});

// ---- notifications (new messages, chat requests, comments) — sent by the API with Web Push
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: 'Collegeolo', body: event.data ? event.data.text() : '' }; }
  const title = d.title || 'Collegeolo';
  event.waitUntil((async () => {
    // already looking at that chat? don't buzz
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (d.url && wins.some((w) => w.focused && new URL(w.url).pathname + new URL(w.url).search === d.url)) return;
    await self.registration.showNotification(title, {
      body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
      tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || '/' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin && 'focus' in w) { await w.focus(); if ('navigate' in w) await w.navigate(target); return; }
    }
    await self.clients.openWindow(target);
  })());
});
