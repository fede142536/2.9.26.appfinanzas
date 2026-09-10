// Service worker — Finanzas PWA
// Estrategia: network-first para index.html (busca actualizaciones),
// cache-first para los demás assets (íconos, manifest).

const CACHE_VERSION = "misgastos-v52";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png"
];

// Instalación: cachear todos los assets de la app, forzando bytes frescos (sin caché HTTP)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      await Promise.all(
        ASSETS.map((url) =>
          fetch(url, { cache: "no-store" }).then((res) => cache.put(url, res))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activación: borrar versiones viejas del caché
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Mensajes desde la app: reportar versión activa y permitir activación forzada
self.addEventListener("message", (event) => {
  if(!event.data) return;
  if(event.data.tipo === "GET_VERSION"){
    if(event.ports && event.ports[0]){
      event.ports[0].postMessage({version: CACHE_VERSION});
    }
  } else if(event.data.tipo === "SKIP_WAITING"){
    self.skipWaiting();
  }
});

// Fetch: network-first para HTML, cache-first para el resto
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Solo manejar requests del mismo origen
  if (url.origin !== self.location.origin) return;

  // CDN externo (XLSX.js): pasar directamente a la red
  if (url.hostname !== self.location.hostname) return;

  // Para HTML: siempre pedir a la red ignorando CUALQUIER caché (ni la de Cache Storage
  // ni la caché HTTP normal del navegador, que es la que causaba que index.html quedara
  // "pegado" viejo aunque el service worker se actualizara). cache:"no-store" es la clave.
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Para assets: caché primero, fallback a red
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy));
        return res;
      });
    })
  );
});
