// ═══════════════════════════════════════════
// DESHACER Y PAPELERA
// ═══════════════════════════════════════════
// Lo que se elimina no se pierde: va a una papelera (30 días, hasta 300 elementos) y el aviso de "eliminado" trae un botón
// "Deshacer". Los cambios en lote (marcar como ahorro, asignar cuenta, dar de baja un frecuente) también se pueden deshacer
// mientras el aviso está en pantalla. La papelera vive junto a los demás datos sensibles (se cifra con el PIN, si hay).
// `papelera` se declara en estado-categorias.js y se lee en loadSensitiveIntoMemory.

const PAPELERA_DIAS=30;
const PAPELERA_MAX=300;
const PAPELERA_KEY="fpapelera";
const DESHACER_MS=7000;

// Se queda con lo de los últimos PAPELERA_DIAS días y, como mucho, los PAPELERA_MAX más recientes. Pura.
function purgarPapelera(lista, ahoraMs){
  const limite=(ahoraMs===undefined ? Date.now() : ahoraMs) - PAPELERA_DIAS*86400000;
  const vigentes=(Array.isArray(lista)?lista:[]).filter(e=>e && e.item && Date.parse(e.en)>=limite);
  return vigentes.slice(-PAPELERA_MAX);
}
function guardarPapelera(){
  try{ setSensitiveRaw(PAPELERA_KEY, JSON.stringify(papelera)); }
  catch(e){ console.warn("No se pudo guardar la papelera:", e); }
}
function cargarPapelera(){
  papelera=purgarPapelera(leerJSONSeguro(PAPELERA_KEY,"[]","array"));
}

// Clave única de cada elemento de la papelera (dos borrados en el mismo milisegundo no pueden compartirla).
let papeleraSeq=0;
const nuevaClavePapelera=()=>Date.now()*1000 + (papeleraSeq++ % 1000);

const listaDeKind=kind=> kind==="tc" ? tcs : kind==="meta" ? metas : movs;
function ponerLista(kind, nueva){ if(kind==="tc") tcs=nueva; else if(kind==="meta") metas=nueva; else movs=nueva; }

// Vuelve a dibujar lo que pudo cambiar. Cada pantalla se protege sola: si no está, no pasa nada.
function refrescarVistas(){
  ["renderMovs","renderAhorro","renderInv","renderTarjetas","renderMetas","renderDashCuentas","renderConciliacionCard","renderPapeleraCard","renderSinCuentaCard","renderVentasFondoCard"].forEach(f=>{
    try{ if(typeof window[f]==="function") window[f](); }catch(e){ /* una pantalla sin dibujar no puede cortar el resto */ }
  });
}

// Saca de movs / tcs / metas lo que cumple `criterio`, lo manda a la papelera, guarda y avisa con "Deshacer".
// Devuelve cuántos sacó. `msg` es el texto del aviso.
function eliminarConDeshacer(kind, criterio, msg){
  const lista=listaDeKind(kind);
  const sacados=[]; lista.forEach((x,i)=>{ if(criterio(x)) sacados.push({x,i}); });
  if(!sacados.length) return 0;
  ponerLista(kind, lista.filter(x=>!criterio(x)));
  const en=new Date().toISOString();
  const entradas=sacados.map(s=>({k:nuevaClavePapelera(), kind, item:JSON.parse(JSON.stringify(s.x)), idx:s.i, en}));
  papelera=purgarPapelera([...papelera, ...entradas]);
  guardarPapelera();
  save();
  showToastAccion(msg||"Eliminado", "Deshacer", ()=>restaurarDePapelera(entradas.map(e=>e.k)), DESHACER_MS);
  return sacados.length;
}

// Devuelve a su lugar los elementos de la papelera con esas claves. Devuelve cuántos restauró. Un elemento cuyo id ya está
// ocupado (cargaste otro después) vuelve con un id nuevo para no pisar nada.
function restaurarDePapelera(claves){
  const set=new Set(claves);
  const entradas=papelera.filter(e=>set.has(e.k)).sort((a,b)=>a.idx-b.idx);
  if(!entradas.length) return 0;
  let n=0;
  entradas.forEach(e=>{
    const lista=listaDeKind(e.kind);
    let item=JSON.parse(JSON.stringify(e.item));
    if(item.id!==undefined && lista.some(x=>x.id===item.id)) item={...item, id:Date.now()+n};
    lista.splice(Math.min(Math.max(e.idx,0), lista.length), 0, item);
    n++;
  });
  papelera=papelera.filter(e=>!set.has(e.k));
  guardarPapelera();
  save();
  refrescarVistas();
  showToast(n===1 ? "Restaurado ✓" : `${n} restaurados ✓`);
  return n;
}
function vaciarPapelera(){
  papelera=[];
  guardarPapelera();
  refrescarVistas();
}

// ── Cambios en lote que se pueden deshacer ──
// Antes de tocar `items`, guarda el valor de cada campo (o que no existía); devuelve la función que los deja como estaban.
function capturarCampos(items, campos){
  const foto=(items||[]).map(m=>({m, v:campos.map(c=>[c, Object.prototype.hasOwnProperty.call(m,c), m[c]])}));
  return ()=>{ foto.forEach(({m,v})=>v.forEach(([c,tenia,val])=>{ if(tenia) m[c]=val; else delete m[c]; })); };
}
// Muestra `msg` con el botón "Deshacer"; al tocarlo corre `revertir`, guarda y redibuja.
function ofrecerDeshacerCambio(msg, revertir){
  showToastAccion(msg, "Deshacer", ()=>{ revertir(); save(); refrescarVistas(); showToast("Cambio deshecho ✓"); }, DESHACER_MS);
}

// ── Pantalla: la papelera ──
function descripcionPapelera(e){
  const x=e.item||{};
  if(e.kind==="tc") return {icono:"💳", titulo:escapeHtml(x.desc||"Compra con tarjeta"), detalle:`${x.tarjeta?escapeHtml(x.tarjeta)+" · ":""}${x.frecuente?"Mensual fijo":`${x.cuotasTotal||1} cuota${(x.cuotasTotal||1)===1?"":"s"}`} · ${x.moneda==="USD"?`USD ${fmtNum2(x.total||0)}`:fmtS(x.total||0)}`};
  if(e.kind==="meta") return {icono:iconoSeguro(x.emoji)||"🎯", titulo:escapeHtml(x.nombre||"Meta"), detalle:`Meta · objetivo ${fmtS(x.objetivo||0)}`};
  const monto=x.moneda==="USD" ? `USD ${fmtNum2(x.importeOrig||x.importeUSD||0)}` : fmtS(x.importe||0);
  const partes=[x.subcat&&x.subcat!=="Otros"?escapeHtml(x.subcat):"", x.nota?escapeHtml(String(x.nota).slice(0,28)):"", x.cuenta&&x.cuenta!=="Cuentas"?escapeHtml(x.cuenta):""].filter(Boolean);
  return {icono:x.tipo==="Ingreso"?"⬇️":x.tipo==="Inversion"?"📈":"⬆️", titulo:escapeHtml(x.cat||x.desc||x.tipo||"Movimiento")+(x.frecuente?" 🔁":""),
          detalle:`${monto}${x.fecha?` · ${escapeHtml(fmtDiaMes(x.fecha))}`:""}${partes.length?` · ${partes.join(" · ")}`:""}`};
}
const cuandoPapelera=iso=>{ const d=Math.floor((Date.now()-Date.parse(iso))/86400000); return d<=0 ? "hoy" : d===1 ? "ayer" : `hace ${d} días`; };

function papeleraHTML(lista){
  if(!lista.length) return `<p class="txt-sm txt-muted" style="margin:12px 0">La papelera está vacía. Lo que elimines aparece acá durante ${PAPELERA_DIAS} días.</p>`;
  const filas=lista.slice().reverse().map(e=>{
    const d=descripcionPapelera(e);
    return `<div class="pap-fila"><div class="pap-ico">${d.icono}</div>
      <div class="pap-mid"><div class="pap-tit">${d.titulo}</div><div class="pap-det">${d.detalle}</div><div class="pap-det">Eliminado ${cuandoPapelera(e.en)}</div></div>
      <button type="button" class="btn-sm" onclick="restaurarElementoPapelera(${Number(e.k)})">Restaurar</button></div>`;
  }).join("");
  return `<p class="txt-xs txt-muted" style="margin:10px 0 4px;line-height:1.4">Lo eliminado se guarda ${PAPELERA_DIAS} días. Al restaurar vuelve a su lugar, con todos sus datos.</p>${filas}
    <button type="button" class="btn-sm" style="width:100%;margin-top:12px;color:var(--danger)" onclick="vaciarPapeleraConfirmando()">Vaciar la papelera</button>`;
}
function renderPapeleraCard(){
  const el=document.getElementById("papelera-resumen");
  if(el) el.textContent=papelera.length ? `${papelera.length} ${papelera.length===1?"elemento eliminado":"elementos eliminados"} en los últimos ${PAPELERA_DIAS} días.` : `Lo que elimines se guarda ${PAPELERA_DIAS} días para poder recuperarlo.`;
  const det=document.getElementById("papelera-detalle");
  if(det && document.getElementById("modal-papelera") && document.getElementById("modal-papelera").classList.contains("open")) det.innerHTML=papeleraHTML(papelera);
}
function abrirPapelera(){
  const det=document.getElementById("papelera-detalle");
  if(!det) return;
  det.innerHTML=papeleraHTML(papelera);
  document.getElementById("modal-papelera").classList.add("open");
}
function cerrarPapelera(){
  const m=document.getElementById("modal-papelera");
  if(m) m.classList.remove("open");
}
function restaurarElementoPapelera(k){
  restaurarDePapelera([k]);
  const det=document.getElementById("papelera-detalle");
  if(det) det.innerHTML=papeleraHTML(papelera);
}
async function vaciarPapeleraConfirmando(){
  if(!papelera.length) return;
  if(!await mostrarConfirm(`¿Vaciar la papelera? Se borran para siempre ${papelera.length} ${papelera.length===1?"elemento":"elementos"}.`, {textoOk:"Vaciar", peligroso:true})) return;
  vaciarPapelera();
  showToast("Papelera vaciada");
  const det=document.getElementById("papelera-detalle");
  if(det) det.innerHTML=papeleraHTML(papelera);
}
