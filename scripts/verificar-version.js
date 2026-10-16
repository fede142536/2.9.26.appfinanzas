#!/usr/bin/env node
// Falla si se cambió código que la app sirve (index.html, styles.css, js/*.js) sin subir la versión de
// sw.js. Sin esa subida, los celulares que ya tienen la app instalada siguen sirviendo la versión
// vieja desde su caché y el cambio no llega nunca (ver el comentario de sw.js).
//
//     node scripts/verificar-version.js [referencia-base]      (por defecto origin/main)
//
// Compara contra el punto donde se separó esta rama de la base (merge-base), así que sirve igual para
// una rama de trabajo, un pull request o el merge que llega a main (base: HEAD^1).
// Para subir la versión:  node scripts/subir-version.js

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const base = process.argv[2] || "origin/main";
const git = (...args) => execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const sirve = f => f === "index.html" || f === "styles.css" || /^js\/.+\.js$/.test(f);
const versionDe = texto => { const m = /const CACHE_VERSION = "(enola-v\d+)"/.exec(texto); return m && m[1]; };

let cambiados, puntoBase;
try {
  // Contra el punto donde esta rama se separó de la base. `git diff <commit>` compara con el árbol
  // de trabajo, así que en local también cuenta lo que todavía no se commiteó; en la Action (clon
  // limpio) es lo mismo que comparar contra HEAD.
  puntoBase = git("merge-base", base, "HEAD").trim();
  cambiados = git("diff", "--name-only", puntoBase).split("\n").filter(Boolean);
} catch (e) {
  // Sin la base (clon superficial, primera rama…) no hay contra qué comparar: no se bloquea por eso.
  console.log(`No pude comparar contra "${base}" (${String(e.stderr || e.message).trim().split("\n")[0]}): se omite la verificación.`);
  process.exit(0);
}

const codigo = cambiados.filter(sirve);
if (!codigo.length) { console.log("No cambió código que la app sirva: no hace falta subir la versión."); process.exit(0); }

let versionBase = null;
try { versionBase = versionDe(git("show", `${puntoBase}:sw.js`)); } catch (e) { /* la base no tenía sw.js */ }
const versionActual = versionDe(fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8"));

if (versionBase && versionBase === versionActual) {
  console.error(`✕ Se cambió código que la app sirve pero la versión sigue en ${versionActual}:\n  - ${codigo.join("\n  - ")}\n`);
  console.error("Subila con:  node scripts/subir-version.js   (cambia sw.js e index.html juntos)");
  process.exit(1);
}
console.log(`✓ La versión se subió (${versionBase || "nueva"} → ${versionActual}).`);
