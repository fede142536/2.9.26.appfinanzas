#!/usr/bin/env node
// Corre la suite de tests.html en un Chromium sin interfaz y sale con código 1 si algo falla.
// Es lo que ejecuta la GitHub Action (.github/workflows/tests.yml) y también sirve en local:
//
//     npm install --no-save playwright      (una sola vez; en la Action ya lo hace el workflow)
//     node scripts/correr-tests.js
//
// No necesita un servidor aparte: levanta uno estático mínimo sobre la raíz del repo.
// Variables opcionales:  CHROMIUM_PATH (otro Chromium) · TIMEOUT_MS (por defecto 120000)

const http = require("http");
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS) || 120000;

function cargarPlaywright() {
  for (const ruta of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
    try { return require(ruta); } catch (e) { /* probar la siguiente */ }
  }
  console.error("Falta Playwright. Instalalo con:  npm install --no-save playwright");
  process.exit(2);
}

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};

function servirEstatico() {
  const servidor = http.createServer((req, res) => {
    const limpia = decodeURIComponent(req.url.split("?")[0]);
    const archivo = path.normalize(path.join(RAIZ, limpia === "/" ? "index.html" : limpia));
    if (!archivo.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }   // no salir de la raíz
    fs.readFile(archivo, (err, datos) => {
      if (err) { res.writeHead(404); return res.end("no existe"); }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
      res.end(datos);
    });
  });
  return new Promise(ok => servidor.listen(0, "127.0.0.1", () => ok(servidor)));
}

(async () => {
  const { chromium } = cargarPlaywright();
  const servidor = await servirEstatico();
  const url = `http://127.0.0.1:${servidor.address().port}/tests.html`;

  // Chromium: el que se pida, el de este entorno de desarrollo si existe, o el que instala Playwright.
  const local = "/opt/pw-browsers/chromium";
  const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync(local) ? local : undefined);
  const navegador = await chromium.launch({ executablePath });
  let codigo = 1;
  try {
    const pagina = await navegador.newPage();
    pagina.on("pageerror", e => console.log("Error en la página:", e.message));
    // Sin red externa: los tests no dependen de las librerías de los CDN (los gráficos se saltean
    // solos), y así corren igual en cualquier máquina.
    for (const patron of ["**/cdn.jsdelivr.net/**", "**/cdnjs.cloudflare.com/**"]) await pagina.route(patron, r => r.abort());
    await pagina.goto(url);
    await pagina.waitForFunction(() => window.__resultado, null, { timeout: TIMEOUT_MS });
    const { ok, fail, fallas } = await pagina.evaluate(() => ({
      ok: window.__resultado.ok,
      fail: window.__resultado.fail,
      fallas: [...document.querySelectorAll(".t.fail")].map(e => e.innerText.replace(/\s+\n/g, "\n").slice(0, 700))
    }));
    if (!ok && !fail) {
      console.error("La suite no corrió ningún test: algo se rompió al cargar tests.html.");
    } else if (fail || fallas.length) {
      console.error(`\n${fail || fallas.length} test(s) fallaron de ${ok + fail}:\n`);
      fallas.forEach(f => console.error("✕ " + f.replace(/^✕\s*/, "") + "\n"));
    } else {
      console.log(`✓ ${ok} tests pasaron`);
      codigo = 0;
    }
  } catch (e) {
    console.error("No se pudo correr la suite:", e.message);
  } finally {
    await navegador.close();
    servidor.close();
  }
  process.exit(codigo);
})();
