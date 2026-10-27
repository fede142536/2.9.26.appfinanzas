#!/usr/bin/env node
// Genera CHANGELOG.md a partir del historial de git: una entrada por cambio (commit que no es un "Merge"), de la más nueva a la más vieja,
// agrupadas por día. El mensaje de cada commit ya dice qué cambió ("v200: botón 'Cobrar'…"), así que el changelog sale de ahí.
//
//     node scripts/generar-changelog.js          → reescribe CHANGELOG.md
//
// Las líneas "Co-Authored-By" y "Claude-Session" de los commits no se copian. Lo escrito a mano en el changelog va en el archivo
// scripts/changelog-hitos.md (se pega arriba de la lista); no se edita CHANGELOG.md a mano porque se pisa al regenerarlo.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const SALIDA = path.join(RAIZ, "CHANGELOG.md");
const HITOS = path.join(__dirname, "changelog-hitos.md");

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaLarga = iso => { const [y, m, d] = iso.split("-").map(Number); return `${d} de ${MESES[m - 1]} de ${y}`; };

// Separadores que no pueden aparecer en un mensaje de commit.
const SEP_CAMPO = "\x1f", SEP_COMMIT = "\x1e";
function leerCommits() {
  const salida = execFileSync("git", ["log", "--no-merges", `--format=%h${SEP_CAMPO}%ad${SEP_CAMPO}%s${SEP_CAMPO}%b${SEP_COMMIT}`, "--date=short"], { cwd: RAIZ, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return salida.split(SEP_COMMIT).map(s => s.replace(/^\n/, "")).filter(s => s.trim()).map(s => {
    const [hash, fecha, asunto, cuerpo] = s.split(SEP_CAMPO);
    return { hash, fecha, asunto: (asunto || "").trim(), cuerpo: (cuerpo || "").trim() };
  });
}

const ES_TRAILER = l => /^(Co-Authored-By|Claude-Session|Signed-off-by):/i.test(l.trim()) || /^🤖 Generated with/.test(l.trim()) || /^https:\/\/claude\.ai\//.test(l.trim());

// "v200: texto" → {version:"v200", titulo:"texto"}; "texto (v126)" → {version:"v126", titulo:"texto"}; sin versión → {version:"", titulo:asunto}
function separarVersion(asunto) {
  let m = /^(v\d+):\s*(.+)$/.exec(asunto);
  if (m) return { version: m[1], titulo: m[2] };
  m = /^(.*?)\s*\((v\d+)\)\s*$/.exec(asunto);
  if (m) return { version: m[2], titulo: m[1] };
  return { version: "", titulo: asunto };
}
const MAX_CUERPO = 700;
const mayuscula = t => t.charAt(0).toUpperCase() + t.slice(1);

function entradaMarkdown(c) {
  const { version, titulo } = separarVersion(c.asunto);
  const lineas = c.cuerpo.split("\n").filter(l => !ES_TRAILER(l));
  while (lineas.length && !lineas[lineas.length - 1].trim()) lineas.pop();
  let cuerpo = lineas.map(l => l.replace(/\s+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  // Los commits viejos traen explicaciones larguísimas: acá alcanza con el principio (el detalle completo está en git).
  if (cuerpo.length > MAX_CUERPO) {
    const corte = cuerpo.slice(0, MAX_CUERPO), fin = Math.max(corte.lastIndexOf("\n\n"), corte.lastIndexOf("\n"), corte.lastIndexOf(". "));
    cuerpo = (fin > MAX_CUERPO / 3 ? corte.slice(0, fin + 1) : corte).trim() + " …";
  }
  const sangrado = cuerpo ? "\n" + cuerpo.split("\n").map(l => l.trim() ? "  " + l : "").join("\n") : "";
  return `- ${version ? `**${version}** · ` : ""}${mayuscula(titulo)}${sangrado}`;
}

function generar() {
  const commits = leerCommits();
  const porDia = new Map();
  commits.forEach(c => { if (!porDia.has(c.fecha)) porDia.set(c.fecha, []); porDia.get(c.fecha).push(c); });
  const primera = commits.map(c => separarVersion(c.asunto).version).find(Boolean) || "";
  const dias = [...porDia.keys()].sort().reverse();
  let md = "# Changelog de Enola\n\n";
  md += "Historial de cambios de la app, del más reciente al más viejo. Se genera solo desde el historial de git con `node scripts/generar-changelog.js`.\n\n";
  if (primera) md += `**Versión actual: ${primera}**\n\n`;
  if (fs.existsSync(HITOS)) md += fs.readFileSync(HITOS, "utf8").trim() + "\n\n";
  md += "---\n\n";
  dias.forEach(d => {
    md += `## ${fechaLarga(d)}\n\n`;
    md += porDia.get(d).map(entradaMarkdown).join("\n") + "\n\n";
  });
  return md.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

if (require.main === module) {
  const md = generar();
  fs.writeFileSync(SALIDA, md);
  console.log(`CHANGELOG.md: ${md.split("\n").filter(l => l.startsWith("- ")).length} cambios`);
}
module.exports = { separarVersion, entradaMarkdown, fechaLarga, generar };
