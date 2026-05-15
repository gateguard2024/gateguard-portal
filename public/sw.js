// GateGuard Portal — Service Worker
// Cache strategies: cache-first (static), stale-while-revalidate (API lists), network-first (other APIs)
// Offline queue: IndexedDB for POST/PATCH mutations, replayed via Background Sync

const STATIC_CACHE = 'gg-static-v1';
const API_CACHE = 'gg-api-v1';
const QUEUE_DB = 'gg-sync-queue';
const QUEUE_DB_VERSION = 1;
const QUEUE_STORE = 'requests';
const MAX_RETRY = 3;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/offline.html',
  '/tech',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap',
];

// Routes that use stale-while-revalidate
const SWR_ROUTES = [
  '/api/kb/products',
  '/api/crm/opportunities',
];

// Static asset patterns (cache-first)
function isStaticAsset(url) {
  const { pathname } = new URL(url);
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/images/') ||
    pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf)$/) ||
    url.startsWith('https://fonts.googleapis.com') ||
    url.startsWith('https://fonts.gstatic.com')
  );
}

function isSWRRoute(url) {
  const { pathname } = new URL(url);
  return SWR_ROUTES.some(r => pathname.startsWith(r));
}

function isApiRoute(url) {
  const { pathname } = new URL(url);
  return pathname.startsWith('/api/');
}

function isTechPage(url) {
  const { pathname } = new URL(url);
  return pathname === '/tech' || pathname.startsWith('/tech?');
}

// ── IndexedDB helpers ────────────────────────────────────────

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB, QUEUE_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function enqueueRequest(entry) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).put(entry);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getAllQueued() {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteQueued(id) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function updateQueued(entry) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).put(entry);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

// Notify all clients of queue length changes
async function broadcastQueueLength() {
  try {
    const entries = await getAllQueued();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({ type: 'QUEUE_LENGTH', count: entries.length });
    });
  } catch (_) {}
}

// ── Install ──────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Pre-cache what we can; skip failures (font CDN may be unavailable offline)
      const results = await Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(() => null))
      );
      return results;
    })
  );
});

// ── Activate ─────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  const VALID_CACHES = [STATIC_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => !VALID_CACHES.includes(key))
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Only handle same-origin + allowed cross-origins
  if (!url.startsWith(self.location.origin) &&
      !url.startsWith('https://fonts.googleapis.com') &&
      !url.startsWith('https://fonts.gstatic.com')) {
    return;
  }

  // Queue POST/PATCH mutations when offline
  if (request.method === 'POST' || request.method === 'PATCH') {
    event.respondWith(networkOrQueue(request));
    return;
  }

  // Cache-first: static assets, /tech page, icons, fonts
  if (isStaticAsset(url) || isTechPage(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Stale-while-revalidate: product/opportunity lists
  if (isSWRRoute(url)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Network-first: other API routes
  if (isApiRoute(url)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Default: network-first for navigation, cache-first for everything else
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNav(request));
    return;
  }

  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ── Cache strategies ─────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return offlineFallback(request);
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || (await fetchPromise) || offlineFallback(request);
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

async function networkFirstNav(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (_) {
    // For navigation: try the cache, then /tech, then offline page
    const cached = await caches.match(request);
    if (cached) return cached;
    const techPage = await caches.match('/tech');
    if (techPage && new URL(request.url).pathname.startsWith('/tech')) return techPage;
    return caches.match('/offline.html');
  }
}

// POST/PATCH: try network; if offline, queue for later
async function networkOrQueue(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (_) {
    // Offline — read body and queue
    try {
      const body = await request.text();
      const headers = {};
      request.headers.forEach((value, key) => { headers[key] = value; });

      const entry = {
        id: crypto.randomUUID(),
        url: request.url,
        method: request.method,
        headers,
        body,
        timestamp: Date.now(),
        retries: 0,
      };

      await enqueueRequest(entry);
      await broadcastQueueLength();

      // Register background sync if supported
      if (self.registration.sync) {
        await self.registration.sync.register('gg-mutation-sync');
      }
    } catch (queueErr) {
      console.warn('[SW] Failed to queue request:', queueErr);
    }

    // Return a synthetic queued response
    return new Response(
      JSON.stringify({ queued: true, message: 'Request queued for sync when online' }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json', 'X-GG-Queued': '1' },
      }
    );
  }
}

function offlineFallback(request) {
  if (request.headers.get('Accept')?.includes('text/html')) {
    return caches.match('/offline.html');
  }
  return new Response(
    JSON.stringify({ error: 'offline', message: 'No network connection' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );
}

// ── Background Sync ──────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'gg-mutation-sync') {
    event.waitUntil(replayQueue());
  }
});

async function replayQueue() {
  let entries;
  try {
    entries = await getAllQueued();
  } catch (_) {
    return;
  }

  const now = Date.now();

  for (const entry of entries) {
    // Drop stale entries (> 24 hours old)
    if (now - entry.timestamp > MAX_AGE_MS) {
      await deleteQueued(entry.id);
      continue;
    }

    // Exponential backoff: don't retry immediately
    const backoffMs = Math.pow(2, entry.retries) * 1000;
    if (entry.lastAttempt && now - entry.lastAttempt < backoffMs) {
      continue;
    }

    try {
      const response = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body || undefined,
      });

      if (response.ok) {
        await deleteQueued(entry.id);
      } else if (entry.retries >= MAX_RETRY) {
        // Give up after max retries
        await deleteQueued(entry.id);
        notifyClients({ type: 'SYNC_FAILED', url: entry.url });
      } else {
        await updateQueued({ ...entry, retries: entry.retries + 1, lastAttempt: now });
      }
    } catch (_) {
      if (entry.retries >= MAX_RETRY) {
        await deleteQueued(entry.id);
      } else {
        await updateQueued({ ...entry, retries: entry.retries + 1, lastAttempt: now });
      }
    }
  }

  await broadcastQueueLength();
}

// ── Message handler ──────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_QUEUE_LENGTH') {
    broadcastQueueLength();
  }
  if (event.data?.type === 'TRIGGER_SYNC') {
    replayQueue();
  }
});

async function notifyClients(message) {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => client.postMessage(message));
  } catch (_) {}
}
