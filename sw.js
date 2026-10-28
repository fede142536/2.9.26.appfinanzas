// Service worker — Finanzas PWA
// Estrategia: network-first para index.html (busca actualizaciones),
// cache-first para los demás assets (íconos, manifest).

// ⚠️ SUBIR ESTA VERSIÓN ANTE CUALQUIER CAMBIO en index.html, styles.css o js/*.js.
// ⚠️ Y SUBIR TAMBIÉN <meta name="enola-version"> en index.html, que es lo que compara el
// aviso de "tenés una versión vieja". Hay un test que verifica que las dos coincidan.
// El navegador solo busca una versión nueva del service worker cuando el contenido de
// ESTE archivo cambia. Si tocás un .js y no subís este número, los celulares que ya
// tienen la app instalada siguen sirviendo para siempre la versión vieja desde su caché
// (la estrategia para los assets es "cache-first") y tu cambio NO LLEGA NUNCA.
const CACHE_VERSION = "enola-v206";
// index.html pide el CSS y los .js con ?v=<versión> (ver scripts/subir-version.js). Así el HTML nuevo y sus
// estilos y scripts son SIEMPRE los de la misma versión: con el nombre pelado, el service worker viejo seguía
// sirviendo el styles.css/.js de su caché (cache-first) debajo de un HTML ya nuevo y la pantalla quedaba sin
// estilos o con código viejo hasta el próximo arranque. Con la versión en la URL, un archivo nuevo es otra
// entrada de la caché y se baja de la red sí o sí.
const VERSION_NUM = CACHE_VERSION.replace(/^enola-v/, "");
const conVersion = (url) => /\.(js|css)$/.test(url) ? `${url}?v=${VERSION_NUM}` : url;
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./styles.css",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png",
  "./fab-perro.jpg",
  "./js/estado-categorias.js",
  "./js/resultado-inversiones.js",
  "./js/render-comun.js",
  "./js/form-cargar.js",
  "./js/movimientos.js",
  "./js/editar-movimiento.js",
  "./js/tarjetas-inversiones.js",
  "./js/analisis.js",
  "./js/cambio-moneda.js",
  "./js/traspasos.js",
  "./js/dashboard.js",
  "./js/inflacion.js",
  "./js/ahorros.js",
  "./js/conciliacion.js",
  "./js/papelera.js",
  "./js/carga-rapida.js",
  "./js/atajos.js",
  "./js/aumentos.js",
  "./js/retiro-por-venta.js",
  "./js/selector-mes.js",
  "./js/decimales.js",
  "./js/recuperable.js",
  "./js/resumen-anual.js",
  "./js/repetir.js",
  "./js/informe-periodo.js",
  "./js/cierre-mes.js",
  "./js/huella.js",
  "./js/cuentas-sugeridas.js",
  "./js/graficos-interactivos.js",
  "./js/importar-exportar.js",
  "./js/cuentas-tarjetas-categorias.js",
  "./js/config-ui.js",
  "./js/calendario-google.js",
  "./js/backup-drive.js",
  "./js/presupuestos.js",
  "./js/seguridad-pin.js",
  "./js/main.js"
];

// Instalación: cachear todos los assets de la app, forzando bytes frescos (sin caché HTTP)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      await Promise.all(
        ASSETS.map(conVersion).map((url) =>
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

  // CDN externo (XLSX.js, Chart.js): pasar directamente a la red
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
