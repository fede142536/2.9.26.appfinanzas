#!/usr/bin/env node
// Sube el número de versión de la app a la vez en: <meta name="enola-version"> de index.html, CACHE_VERSION de sw.js
// y los ?v= de los archivos que index.html pide (styles.css y js/*.js). Si se toca solo uno, los celulares con la app instalada siguen
// mostrando la versión vieja desde su caché (ver el comentario de sw.js).
//
//     node scripts/subir-version.js        → enola-v154 pasa a enola-v155
//     node scripts/subir-version.js 160    → fija enola-v160

const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const SW = path.join(RAIZ, "sw.js");
const HTML = path.join(RAIZ, "index.html");

const reSw = /(const CACHE_VERSION = "enola-v)(\d+)(")/;
const reHtml = /(<meta name="enola-version" content="enola-v)(\d+)(")/;

const sw = fs.readFileSync(SW, "utf8");
const html = fs.readFileSync(HTML, "utf8");
const enSw = reSw.exec(sw), enHtml = reHtml.exec(html);
if (!enSw || !enHtml) { console.error("No encontré el número de versión en sw.js o index.html."); process.exit(1); }
if (enSw[2] !== enHtml[2]) {
  console.error(`sw.js dice v${enSw[2]} e index.html dice v${enHtml[2]}: arreglalo a mano antes de subir la versión.`);
  process.exit(1);
}

const nueva = process.argv[2] ? Number(process.argv[2]) : Number(enSw[2]) + 1;
if (!Number.isInteger(nueva) || nueva < 1) { console.error("La versión tiene que ser un entero positivo."); process.exit(1); }

// index.html pide styles.css y cada js/*.js con ?v=<versión>: se suben juntos (ver el comentario de sw.js).
const reAssets = /((?:styles\.css|js\/[\w-]+\.js)\?v=)\d+/g;
fs.writeFileSync(SW, sw.replace(reSw, `$1${nueva}$3`));
fs.writeFileSync(HTML, html.replace(reHtml, `$1${nueva}$3`).replace(reAssets, `$1${nueva}`));
console.log(`enola-v${enSw[2]} → enola-v${nueva}`);
