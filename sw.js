/* =====================================================================
   $DOLLARDGT — Service Worker (Fase 4: Modo Offline-First)
   Sube este archivo a la MISMA carpeta que tu HTML principal en
   dollardgt.com (junto a dollardgt-app.html / index.html). El registro
   en el HTML usa la ruta relativa 'sw.js', así que debe quedar en el
   mismo directorio para que el scope cubra toda la app.

   Qué hace:
   - Cachea el shell de la app (el HTML) y, a medida que se van pidiendo,
     los assets de los CDNs externos (Tailwind, Tesseract, jsPDF, QRCode)
     con estrategia cache-first, para que la app cargue sin red.
   - NUNCA cachea ni intercepta llamadas a supabase.co o a Stripe —
     esos datos siempre van directo a la red o fallan explícitamente,
     nunca se sirven "viejos" sin que la app lo sepa. La capa de caché
     de datos reales (Bóveda, cola de registros pendientes) vive en
     IndexedDB, manejada por el propio HTML — este archivo solo cubre
     el shell estático.
===================================================================== */

const CACHE_NAME = 'dgt-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['./']).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST/RPC nunca se cachean — van directo a Supabase

  const url = new URL(req.url);
  if (url.hostname.includes('supabase.co') || url.hostname.includes('stripe.com')) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      // El documento principal: network-first (para no quedarte con una
      // versión vieja de la app). Todo lo demás (CDNs/assets): cache-first.
      return req.mode === 'navigate' ? network : (cached || network);
    })
  );
});
