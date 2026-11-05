// ═══════════════════════════════════════════
// CUENTAS (default + agregadas por el usuario)
// ═══════════════════════════════════════════
const CUENTAS_DEFAULT=["Cuentas","Efectivo","Tarjetas de crédito","Balanz","Cuenta DNI","Galicia","Naranja X","BPat","MODO"];
let cuentasCustom = [];
function saveCuentasCustom(){ setSensitiveRaw("fcuentas", JSON.stringify(cuentasCustom)); marcarDatosSucios(); }
// Las cuentas por defecto también se pueden renombrar: el nombre nuevo se guarda aparte ({ "Galicia": "Galicia Pro" }) y reemplaza al de fábrica en
// el mismo lugar de la lista. Va como preferencia y dentro de las copias de seguridad (campo cuentasRenombradas). "Cuentas" no se toca: es la
// opción "sin elegir" que usa toda la app para saber qué movimientos no dicen de qué banco son.
const CUENTAS_REN_KEY="fcuentasren";
let cuentasRenCache=null;
function normalizarCuentasRen(o){
  const out={}, usados=new Set();
  if(o && typeof o==="object" && !Array.isArray(o)) Object.keys(o).forEach(k=>{
    if(!CUENTAS_DEFAULT.includes(k) || k==="Cuentas" || typeof o[k]!=="string") return;
    const v=nombreSeguro(o[k].trim());
    if(!v || v===k || v==="Cuentas" || usados.has(v.toLowerCase())) return;
    usados.add(v.toLowerCase()); out[k]=v;
  });
  return out;
}
function getCuentasRen(){
  if(cuentasRenCache===null){ try{ cuentasRenCache=normalizarCuentasRen(JSON.parse(localStorage.getItem(CUENTAS_REN_KEY)||"{}")); }catch(e){ cuentasRenCache={}; } }
  return cuentasRenCache;
}
function guardarCuentasRen(mapa){
  cuentasRenCache=normalizarCuentasRen(mapa);
  const ok=guardarPreferencia(CUENTAS_REN_KEY, JSON.stringify(cuentasRenCache));
  if(typeof marcarDatosSucios==="function") marcarDatosSucios();
  return ok;
}
// Las cuentas de fábrica que no usás se pueden quitar de la lista (y volver a mostrar). Se guarda el nombre de FÁBRICA de cada una, aunque la hayas renombrado.
// Quitar una cuenta no toca los movimientos que ya la tienen: la lista es lo que ofrecen los selectores. "Cuentas" no se quita (es el "sin elegir").
const CUENTAS_OCULTAS_KEY="fcuentasoc";
let cuentasOcultasCache=null;
function normalizarOcultas(a, defaults, reservadas){
  const out=[]; if(Array.isArray(a)) a.forEach(x=>{ if(typeof x==="string" && defaults.includes(x) && !(reservadas||[]).includes(x) && !out.includes(x)) out.push(x); });
  return out;
}
function getCuentasOcultas(){
  if(cuentasOcultasCache===null){ try{ cuentasOcultasCache=normalizarOcultas(JSON.parse(localStorage.getItem(CUENTAS_OCULTAS_KEY)||"[]"), CUENTAS_DEFAULT, ["Cuentas"]); }catch(e){ cuentasOcultasCache=[]; } }
  return cuentasOcultasCache;
}
function guardarCuentasOcultas(lista){
  cuentasOcultasCache=normalizarOcultas(lista, CUENTAS_DEFAULT, ["Cuentas"]);
  const ok=guardarPreferencia(CUENTAS_OCULTAS_KEY, JSON.stringify(cuentasOcultasCache));
  if(typeof marcarDatosSucios==="function") marcarDatosSucios();
  return ok;
}
// Devuelve la lista completa de cuentas: default (con el nombre que les hayas puesto, menos las que quitaste) + las agregadas por el usuario (sin duplicar)
function getCuentas(){
  const ren=getCuentasRen(), ocultas=getCuentasOcultas();
  const todas=CUENTAS_DEFAULT.filter(c=>!ocultas.includes(c)).map(c=>ren[c]||c);
  cuentasCustom.forEach(c=>{ if(!todas.includes(c)) todas.push(c); });
  return todas;
}
// Llena un <select> de cuentas, preservando el valor actual si se pasa
function buildCuentaSelect(selectId, valorActual){
  const sel=document.getElementById(selectId);
  if(!sel) return;
  const actual = valorActual!==undefined ? valorActual : sel.value;
  const cuentas=getCuentas();
  let opts=cuentas.map(c=>`<option ${c===actual?"selected":""}>${escapeHtml(c)}</option>`);
  // Si el valor actual no está en la lista (cuenta vieja de un import, por ejemplo), agregarla igual
  if(actual && !cuentas.includes(actual)){
    opts.unshift(`<option selected>${escapeHtml(actual)}</option>`);
  }
  sel.innerHTML=opts.join("");
}
// Pide el nombre de una cuenta nueva, la guarda y actualiza el select indicado
async function agregarCuentaRapida(selectId){
  const nombre=await mostrarPrompt("Nombre de la cuenta nueva:", {titulo:"Nueva cuenta", placeholder:"Ej: Mercado Pago, Ualá, Brubank", textoOk:"Agregar"});
  if(!nombre) return;
  const limpio=nombreSeguro(nombre.trim());
  if(!limpio) return;
  if(getCuentas().some(c=>c.toLowerCase()===limpio.toLowerCase())){
    showToast("Esa cuenta ya existe");
    buildCuentaSelect(selectId, limpio);
    return;
  }
  cuentasCustom.push(limpio);
  saveCuentasCustom();
  showToast(`Cuenta "${limpio}" agregada ✓`);
  buildCuentaSelect(selectId, limpio);
}
// Elimina una cuenta custom (no se puede borrar una cuenta default)
async function borrarCuentaCustom(nombre){
  if(!cuentasCustom.includes(nombre)) return;
  if(!await mostrarConfirm(`¿Eliminar la cuenta "${nombre}" de la lista? (los movimientos que ya la tienen asignada no se modifican)`, {textoOk:"Eliminar", peligroso:true})) return;
  cuentasCustom=cuentasCustom.filter(c=>c!==nombre);
  saveCuentasCustom();
  showToast("Cuenta eliminada de la lista");
  renderCuentasManager();
  buildCuentaSelect("inp-cuenta");
  buildCuentaSelect("inv-cuenta");
  buildCuentaSelect("tc-cuenta");
}
// Cambia el nombre de una cuenta en TODO lo que la usa. Recorre movimientos, compras con tarjeta, papelera y metas y cambia los campos `cuenta`
// y `cuentaDestino` que valgan exactamente `viejo`. Pura (modifica en el lugar) y devuelve cuántos cambió.
function renombrarCuentaEnObjeto(x, viejo, nuevo, visto){
  if(!x || typeof x!=="object") return 0;
  visto=visto||new Set(); if(visto.has(x)) return 0; visto.add(x);
  let n=0;
  if(Array.isArray(x)){ x.forEach(e=>{ n+=renombrarCuentaEnObjeto(e,viejo,nuevo,visto); }); return n; }
  Object.keys(x).forEach(k=>{
    if((k==="cuenta"||k==="cuentaDestino") && x[k]===viejo){ x[k]=nuevo; n++; }
    else if(x[k] && typeof x[k]==="object") n+=renombrarCuentaEnObjeto(x[k],viejo,nuevo,visto);
  });
  return n;
}
// Cuántos campos `cuenta` / `cuentaDestino` valen `nombre` (misma recorrida que renombrarCuentaEnObjeto, sin cambiar nada). Pura.
function contarCuentaEnObjeto(x, nombre, visto){
  if(!x || typeof x!=="object") return 0;
  visto=visto||new Set(); if(visto.has(x)) return 0; visto.add(x);
  let n=0;
  if(Array.isArray(x)){ x.forEach(e=>{ n+=contarCuentaEnObjeto(e,nombre,visto); }); return n; }
  Object.keys(x).forEach(k=>{
    if((k==="cuenta"||k==="cuentaDestino") && x[k]===nombre) n++;
    else if(x[k] && typeof x[k]==="object") n+=contarCuentaEnObjeto(x[k],nombre,visto);
  });
  return n;
}
// Saca una cuenta de la lista. Las propias se borran; las de fábrica se ocultan (se pueden volver a mostrar).
async function quitarCuenta(nombre){
  if(cuentasCustom.includes(nombre)) return borrarCuentaCustom(nombre);
  const ren=getCuentasRen();
  const original=Object.keys(ren).find(k=>ren[k]===nombre) || (CUENTAS_DEFAULT.includes(nombre) ? nombre : null);
  if(!original || original==="Cuentas") return;
  const usos=contarCuentaEnObjeto(movs,nombre)+contarCuentaEnObjeto(tcs,nombre);
  const aviso=usos ? `"${nombre}" figura en ${usos} movimiento${usos===1?"":"s"}: se saca de la lista, pero esos movimientos la conservan.` : `No la usaste en ningún movimiento.`;
  if(!await mostrarConfirm(`¿Quitar "${nombre}" de la lista de cuentas? ${aviso} La podés volver a mostrar desde Configuración.`, {textoOk:"Quitar", peligroso:!!usos})) return;
  guardarCuentasOcultas([...getCuentasOcultas(), original]);
  showToast(`Cuenta "${nombre}" quitada de la lista`);
  refrescarCuentas();
}
function mostrarCuentasOcultas(){ guardarCuentasOcultas([]); showToast("Cuentas de fábrica restauradas ✓"); refrescarCuentas(); }
function refrescarCuentas(){
  renderCuentasManager();
  ["inp-cuenta","inv-cuenta","tc-cuenta"].forEach(id=>buildCuentaSelect(id));
  if(typeof renderTarjetasManager==="function") renderTarjetasManager();
}
// Edita (renombra) una cuenta, de fábrica o propia. Todo lo cargado con la cuenta pasa a llevar el nombre nuevo.
async function editarCuenta(nombreActual){
  if(nombreActual==="Cuentas") return;   // es la opción "sin elegir", no una cuenta
  const nuevo=await mostrarPrompt(`Nuevo nombre para "${nombreActual}":`, {titulo:"Editar cuenta", valorInicial:nombreActual, textoOk:"Guardar"});
  if(nuevo===null || nuevo===undefined) return;
  const limpio=nombreSeguro(String(nuevo).trim());
  if(!limpio || limpio===nombreActual) return;
  if(limpio==="Cuentas"){ showToast("Ese nombre está reservado"); return; }
  if(getCuentas().some(c=>c.toLowerCase()===limpio.toLowerCase() && c!==nombreActual)){ showToast("Ya existe una cuenta con ese nombre"); return; }
  // 1) La lista: una propia se cambia en su lugar; una de fábrica guarda su nombre nuevo aparte (y si vuelve al de fábrica, se quita).
  const ren={...getCuentasRen()};
  const original=Object.keys(ren).find(k=>ren[k]===nombreActual) || (CUENTAS_DEFAULT.includes(nombreActual) ? nombreActual : null);
  const iPropia=cuentasCustom.indexOf(nombreActual);
  if(iPropia>=0){ cuentasCustom[iPropia]=limpio; saveCuentasCustom(); }
  else if(original){ if(limpio===original) delete ren[original]; else ren[original]=limpio; guardarCuentasRen(ren); }
  else { cuentasCustom.push(limpio); saveCuentasCustom(); }   // viene de datos importados y no estaba en la lista
  // 2) Los datos que la usan.
  let cambios=renombrarCuentaEnObjeto(movs,nombreActual,limpio)+renombrarCuentaEnObjeto(tcs,nombreActual,limpio)+renombrarCuentaEnObjeto(metas,nombreActual,limpio);
  const enPapelera=renombrarCuentaEnObjeto(papelera,nombreActual,limpio);
  const bancos=leerBancosTc(); let tocoBancos=false;
  Object.keys(bancos).forEach(t=>{ if(bancos[t]===nombreActual){ bancos[t]=limpio; tocoBancos=true; } });
  if(tocoBancos) guardarBancosTc(bancos);
  if(typeof filtroCuenta!=="undefined" && filtroCuenta===nombreActual) filtroCuenta=limpio;
  if(cambios>0) save();
  if(enPapelera>0 && typeof guardarPapelera==="function") guardarPapelera();
  showToast(`Cuenta renombrada${cambios>0?` · ${cambios} movimiento${cambios===1?"":"s"} actualizado${cambios===1?"":"s"}`:""} ✓`);
  // 3) Lo que se ve: la lista de Config, los selectores (conservando lo elegido) y las pantallas.
  renderCuentasManager();
  ["inp-cuenta","inv-cuenta","tc-cuenta"].forEach(id=>{ const s=document.getElementById(id); if(s) buildCuentaSelect(id, s.value===nombreActual ? limpio : undefined); });
  if(typeof renderTarjetasManager==="function") renderTarjetasManager();
  if(typeof renderMovs==="function") renderMovs();
  if(typeof renderTarjetas==="function") renderTarjetas();
}
// Renderiza el listado de cuentas en Config (para poder agregarlas, editarlas y borrarlas ahí también)
function renderCuentasManager(){
  const el=document.getElementById("cuentas-manager");
  if(!el) return;
  const html=getCuentas().map(c=>{
    const esCustom=cuentasCustom.includes(c);
    const editable=c!=="Cuentas";
    return `<span class="cfg-chip${esCustom?' cfg-chip-propio':''}"><span class="cfg-chip-txt">💳 ${escapeHtml(c)}</span>${editable?`<button type="button" class="cfg-chip-x cfg-chip-edit" aria-label="Editar la cuenta ${escapeHtml(c)}" onclick="editarCuenta(${attrJS(c)})">✎</button>`:''}${editable?`<button type="button" class="cfg-chip-x" aria-label="Quitar la cuenta ${escapeHtml(c)}" onclick="quitarCuenta(${attrJS(c)})">×</button>`:''}</span>`;
  }).join("");
  const ocultas=getCuentasOcultas().length;
  el.innerHTML=`<div class="cfg-chips">${html}</div><div class="cfg-acciones"><button class="btn-sm" onclick="agregarCuentaRapida('inp-cuenta')">+ Agregar cuenta</button>${ocultas?`<button class="btn-sm" onclick="mostrarCuentasOcultas()">Volver a mostrar las que quité (${ocultas})</button>`:""}</div>`;
}

// ═══════════════════════════════════════════
// NOMBRES DE TARJETAS (default + agregadas por el usuario + renombrado con propagación)
// ═══════════════════════════════════════════
const TARJETAS_DEFAULT=["Visa","Mastercard","Amex","Cabal","Naranja","Otra"];
let tarjetasCustom = [];
function saveTarjetasCustom(){ setSensitiveRaw("ftarjetas", JSON.stringify(tarjetasCustom)); marcarDatosSucios(); }
// Devuelve todos los nombres de tarjeta: default + agregados por el usuario + cualquiera que
// ya esté en uso en gastos cargados (por si vino de un import viejo con un nombre no listado)
// Igual que con las cuentas: las de fábrica que no usás se pueden quitar de la lista. Una tarjeta con compras cargadas no se quita (volvería a aparecer sola).
const TARJETAS_OCULTAS_KEY="ftarjetasoc";
let tarjetasOcultasCache=null;
function getTarjetasOcultas(){
  if(tarjetasOcultasCache===null){ try{ tarjetasOcultasCache=normalizarOcultas(JSON.parse(localStorage.getItem(TARJETAS_OCULTAS_KEY)||"[]"), TARJETAS_DEFAULT); }catch(e){ tarjetasOcultasCache=[]; } }
  return tarjetasOcultasCache;
}
function guardarTarjetasOcultas(lista){
  tarjetasOcultasCache=normalizarOcultas(lista, TARJETAS_DEFAULT);
  const ok=guardarPreferencia(TARJETAS_OCULTAS_KEY, JSON.stringify(tarjetasOcultasCache));
  if(typeof marcarDatosSucios==="function") marcarDatosSucios();
  return ok;
}
function getTarjetas(){
  const ocultas=getTarjetasOcultas();
  const todas=TARJETAS_DEFAULT.filter(t=>!ocultas.includes(t));
  tcs.forEach(t=>{
    if(t.tarjeta && !todas.includes(t.tarjeta)) todas.push(t.tarjeta);
    (t.tarjetas||[]).forEach(c=>{ if(c.tarjeta && !todas.includes(c.tarjeta)) todas.push(c.tarjeta); });
  });
  tarjetasCustom.forEach(t=>{ if(!todas.includes(t)) todas.push(t); });
  return todas;
}
// ── Banco de cada tarjeta ──
// Cada tarjeta puede asociarse a una cuenta (su banco o billetera): {"Visa":"BPat","Mastercard":"Galicia"}. Sirve para que
// las compras con tarjeta digan de qué banco son sin tener que cargarlo en cada una. Es una preferencia: localStorage llano.
const BANCOS_TC_KEY="fbancotc";
function normalizarBancosTc(o){
  const out={};
  if(o && typeof o==="object" && !Array.isArray(o)) Object.entries(o).forEach(([t,b])=>{ if(typeof b==="string" && b.trim() && t) out[t]=b.trim(); });
  return out;
}
function leerBancosTc(){
  try{ return normalizarBancosTc(JSON.parse(localStorage.getItem(BANCOS_TC_KEY)||"{}")); }catch(e){ return {}; }
}
function guardarBancosTc(mapa){ return guardarPreferencia(BANCOS_TC_KEY, JSON.stringify(normalizarBancosTc(mapa))); }
// Copia del mapa con el banco de UNA tarjeta cambiado (vacío lo quita). Pura.
function conBancoDeTarjeta(mapa, tarjeta, banco){
  const nuevo=normalizarBancosTc(mapa), b=String(banco||"").trim();
  if(b) nuevo[tarjeta]=b; else delete nuevo[tarjeta];
  return nuevo;
}
const bancoDeTarjeta=(tarjeta, mapa)=>(mapa||leerBancosTc())[tarjeta]||"";
// "Visa · BPat" (con el banco en gris) o solo "Visa".
function tarjetaConBancoHTML(tarjeta, mapa){
  const b=bancoDeTarjeta(tarjeta, mapa);
  return escapeHtml(tarjeta||"Sin tarjeta")+(b?` <span class="tc-banco">· ${escapeHtml(b)}</span>`:"");
}
function setBancoTarjeta(tarjeta, banco){
  guardarBancosTc(conBancoDeTarjeta(leerBancosTc(), tarjeta, banco));
  showToast(banco ? `${tarjeta}: banco ${banco} ✓` : `${tarjeta}: sin banco`);
  if(typeof renderTarjetas==="function") renderTarjetas();
  if(typeof renderMovs==="function" && document.getElementById("tx-list")) renderMovs();
}

// Llena un <select> de tarjetas, preservando el valor actual si se pasa
function buildTarjetaSelect(selectId, valorActual){
  const sel=document.getElementById(selectId);
  if(!sel) return;
  const actual = valorActual!==undefined ? valorActual : sel.value;
  const tarjetas=getTarjetas();
  let opts=tarjetas.map(t=>`<option ${t===actual?"selected":""}>${escapeHtml(t)}</option>`);
  if(actual && !tarjetas.includes(actual)){
    opts.unshift(`<option selected>${escapeHtml(actual)}</option>`);
  }
  sel.innerHTML=opts.join("");
}
// Pide el nombre de una tarjeta nueva, la guarda y actualiza el select indicado
async function agregarTarjetaRapida(selectId){
  const nombre=await mostrarPrompt("Nombre de la tarjeta:", {titulo:"Nueva tarjeta", placeholder:"Ej: Visa Santander, Mastercard BBVA", textoOk:"Agregar"});
  if(!nombre) return;
  const limpio=nombreSeguro(nombre.trim());
  if(!limpio) return;
  if(getTarjetas().some(t=>t.toLowerCase()===limpio.toLowerCase())){
    showToast("Esa tarjeta ya existe");
    buildTarjetaSelect(selectId, limpio);
    return;
  }
  tarjetasCustom.push(limpio);
  saveTarjetasCustom();
  showToast(`Tarjeta "${limpio}" agregada ✓`);
  buildTarjetaSelect(selectId, limpio);
}
// Elimina una tarjeta custom de la lista (no se puede borrar si hay gastos usándola)
async function borrarTarjetaCustom(nombre){
  if(!tarjetasCustom.includes(nombre)) return;
  if(tcs.some(t=>t.tarjeta===nombre || (t.tarjetas||[]).some(c=>c.tarjeta===nombre))){
    showToast("No se puede borrar: hay gastos cargados con esa tarjeta. Renombrala en su lugar.");
    return;
  }
  if(!await mostrarConfirm(`¿Eliminar "${nombre}" de la lista de tarjetas?`, {textoOk:"Eliminar", peligroso:true})) return;
  tarjetasCustom=tarjetasCustom.filter(t=>t!==nombre);
  saveTarjetasCustom();
  guardarBancosTc(conBancoDeTarjeta(leerBancosTc(), nombre, ""));
  showToast("Tarjeta eliminada de la lista");
  renderTarjetasManager();
  buildTarjetaSelect("tc-tarjeta");
}
// Quita una tarjeta de la lista: las propias se borran, las de fábrica se ocultan (y se pueden volver a mostrar).
async function quitarTarjeta(nombre){
  if(tarjetasCustom.includes(nombre)) return borrarTarjetaCustom(nombre);
  if(!TARJETAS_DEFAULT.includes(nombre)) return;
  const usos=tcs.filter(t=>t.tarjeta===nombre || (t.tarjetas||[]).some(c=>c.tarjeta===nombre)).length;
  if(usos){ showToast(`No se puede quitar: hay ${usos} compra${usos===1?"":"s"} con esa tarjeta. Renombrala en su lugar.`); return; }
  if(getTarjetas().length<=1){ showToast("Tiene que quedar al menos una tarjeta"); return; }
  if(!await mostrarConfirm(`¿Quitar "${nombre}" de la lista de tarjetas? No la usaste en ninguna compra. La podés volver a mostrar desde Configuración.`, {textoOk:"Quitar"})) return;
  guardarTarjetasOcultas([...getTarjetasOcultas(), nombre]);
  guardarBancosTc(conBancoDeTarjeta(leerBancosTc(), nombre, ""));
  showToast(`Tarjeta "${nombre}" quitada de la lista`);
  renderTarjetasManager();
  buildTarjetaSelect("tc-tarjeta");
}
function mostrarTarjetasOcultas(){ guardarTarjetasOcultas([]); showToast("Tarjetas de fábrica restauradas ✓"); renderTarjetasManager(); buildTarjetaSelect("tc-tarjeta"); }
// Renombra una tarjeta en TODOS los gastos que ya la usan (propaga el cambio),
// y actualiza también la lista de tarjetas custom si corresponde.
async function renombrarTarjeta(nombreActual){
  const nuevo=await mostrarPrompt(`Nuevo nombre para "${nombreActual}":`, {titulo:"Renombrar tarjeta", valorInicial:nombreActual, textoOk:"Renombrar"});
  if(nuevo===null) return;
  const limpio=nombreSeguro(nuevo.trim());
  if(!limpio || limpio===nombreActual) return;
  if(getTarjetas().some(t=>t.toLowerCase()===limpio.toLowerCase() && t!==nombreActual)){
    showToast("Ya existe una tarjeta con ese nombre");
    return;
  }
  let cambios=0;
  tcs.forEach(t=>{
    if(t.tarjeta===nombreActual){ t.tarjeta=limpio; cambios++; }
    (t.tarjetas||[]).forEach(c=>{ if(c.tarjeta===nombreActual){ c.tarjeta=limpio; cambios++; } });
  });
  const idx=tarjetasCustom.indexOf(nombreActual);
  if(idx>=0) tarjetasCustom[idx]=limpio;
  else if(!TARJETAS_DEFAULT.includes(nombreActual)) tarjetasCustom.push(limpio);
  saveTarjetasCustom();
  // El día de vencimiento acompaña a la tarjeta: si no se mueve, el aviso se pierde en silencio.
  const venc=leerVencTc();
  if(venc[nombreActual]!==undefined){ venc[limpio]=venc[nombreActual]; delete venc[nombreActual]; guardarVencTc(venc); }
  const bancos=leerBancosTc();   // y el banco también
  if(bancos[nombreActual]){ guardarBancosTc(conBancoDeTarjeta(conBancoDeTarjeta(bancos, limpio, bancos[nombreActual]), nombreActual, "")); }
  if(cambios>0) save();
  showToast(`Renombrada${cambios>0?` · ${cambios} gasto(s) actualizado(s)`:""} ✓`);
  renderTarjetasManager();
  renderTarjetas();
  buildTarjetaSelect("tc-tarjeta");
}
// Renderiza el listado de tarjetas en Config (para agregarlas/renombrarlas/borrarlas)
function renderTarjetasManager(){
  const el=document.getElementById("tarjetas-manager");
  if(!el) return;
  const bancos=leerBancosTc();
  const cuentas=getCuentas().filter(c=>c!=="Cuentas");
  const html=getTarjetas().map(t=>{
    const esCustom=tarjetasCustom.includes(t);
    const esDefault=TARJETAS_DEFAULT.includes(t);
    const tEsc=attrJS(t);
    const actual=bancos[t]||"";
    const opciones=[`<option value="">Sin banco</option>`, ...(actual && !cuentas.includes(actual)?[actual]:[]).concat(cuentas).map(c=>`<option value="${escapeHtml(c)}"${c===actual?" selected":""}>${escapeHtml(c)}</option>`)].join("");
    return `<div class="cfg-tc-fila">
      <div class="cfg-tc-top">
        <span class="cfg-tc-nombre">💳 ${escapeHtml(t)}${esDefault?"":' <span class="badge badge-accent">propia</span>'}</span>
        <div class="cfg-tc-acc">
          <button type="button" class="cfg-ico-btn cfg-ico-plano" aria-label="Renombrar la tarjeta ${escapeHtml(t)}" title="Renombrar" onclick="renombrarTarjeta(${tEsc})">✎</button>
          <button type="button" class="cfg-ico-btn cfg-ico-plano cfg-ico-peligro" aria-label="${esCustom?"Eliminar":"Quitar"} la tarjeta ${escapeHtml(t)}" title="${esCustom?"Eliminar":"Quitar de la lista"}" onclick="quitarTarjeta(${tEsc})">×</button>
        </div>
      </div>
      <label class="tc-banco-fila"><span>Banco</span><select class="form-select" aria-label="Banco de ${escapeHtml(t)}" onchange="setBancoTarjeta(${tEsc}, this.value)">${opciones}</select></label>
    </div>`;
  }).join("");
  const ocultasTc=getTarjetasOcultas().length;
  el.innerHTML=html+`<div class="cfg-acciones"><button class="btn-sm" onclick="agregarTarjetaRapida('tc-tarjeta')">+ Agregar tarjeta</button>${ocultasTc?`<button class="btn-sm" onclick="mostrarTarjetasOcultas()">Volver a mostrar las que quité (${ocultasTc})</button>`:""}</div>`;
}

// ═══════════════════════════════════════════
// CATEGORÍAS
// ═══════════════════════════════════════════
function openCatModal(){
  nuevoCatIcono=null;
  const prev=document.getElementById("new-cat-icon-preview");
  if(prev) prev.textContent="📦";
  document.getElementById("modal-cat").classList.add("open");
}
function closeCatModal(){
  document.getElementById("modal-cat").classList.remove("open");
  // Cancelar (tocar afuera) también tiene que soltar la bandera: si no, la próxima vez que se
  // abra "+ Cat." desde el ALTA (sin pasar por Editar) esta función igual intentaría refrescar
  // el select de edición.
  catModalDesdeEdit=false;
}
function guardarNuevaCat(){
  const t=document.getElementById("new-cat-tipo").value;
  const nombre=nombreSeguro(document.getElementById("new-cat-name").value.trim());
  const subsRaw=document.getElementById("new-cat-subs").value.trim();
  if(!nombre){showToast("Ingresá un nombre");return;}
  const subs=subsRaw?subsRaw.split(",").map(s=>nombreSeguro(s.trim())).filter(Boolean):["Otros"];
  if(!custom[t])custom[t]={};custom[t][nombre]=subs;
  if(iconoSeguro(nuevoCatIcono)){ iconsCustom[nombre]=iconoSeguro(nuevoCatIcono); saveIconsCustom(); }
  save();
  document.getElementById("new-cat-name").value="";document.getElementById("new-cat-subs").value="";
  nuevoCatIcono=null; document.getElementById("new-cat-icon-preview").textContent="📦";
  // Se guarda ANTES de closeCatModal(): esa función también apaga la bandera (para el caso de
  // cancelar tocando afuera), así que leerla después de cerrarla siempre daría false.
  const veniaDeEdit=catModalDesdeEdit;
  closeCatModal();showToast("Categoría agregada ✓");buildCats();buildTcCats();buildInvCats();renderCatManager();
  // El "+ Cat." del modal de edición usa este mismo modal (no hay uno aparte), pero
  // buildCats() de arriba solo refresca el select del alta (#inp-cat). Sin esto, la categoría
  // recién creada quedaba invisible en el modal de edición hasta cerrarlo y volver a abrirlo.
  if(veniaDeEdit){
    const em=editingId!=null && movs.find(x=>x.id===editingId);
    if(em && (em.tipo==="Gasto"||em.tipo==="Ingreso") && document.getElementById("edit-cat")){
      const catActual=document.getElementById("edit-cat").value||em.cat;
      const subActual=document.getElementById("edit-subcat").value||em.subcat;
      populateEditCatSelect(em.tipo, catActual, subActual);
    }
  }
}
function renderCatManager(){
  const el=document.getElementById("cat-manager");let html="";
  ["Gasto","Ingreso","Inversion","Tarjeta"].forEach(t=>{
    const cats=getCats(t);
    if(!Object.keys(cats).length) return;
    html+=`<p class="seccion-label txt-medium mt-14 mb-6">${t}</p>`;
    const nombresOrdenados=ordenarCats(t, cats);
    nombresOrdenados.forEach((cat,idx)=>{
      const subs=cats[cat];
      const esDefault=DEFAULT_CATS[t]&&DEFAULT_CATS[t][cat];
      const catEsc=attrJS(cat);
      const subsDefault=esDefault?DEFAULT_CATS[t][cat]:[];
      const subsCustom=(custom[t]&&custom[t][cat])||[];
      // Render subs como chips, marcando cuáles son del usuario (se pueden borrar)
      const subsHtml=subs.map(s=>{
        const esSubCustom=subsCustom.includes(s)&&!subsDefault.includes(s);
        if(esSubCustom){
          return `<span class="cfg-chip cfg-chip-sub cfg-chip-propio"><span class="cfg-chip-txt">${escapeHtml(s)}</span><button type="button" class="cfg-chip-x" aria-label="Quitar la subcategoría ${escapeHtml(s)} de ${escapeHtml(cat)}" onclick="borrarSubcat('${t}',${catEsc},${attrJS(s)})">×</button></span>`;
        }
        return `<span class="cfg-chip cfg-chip-sub"><span class="cfg-chip-txt">${escapeHtml(s)}</span></span>`;
      }).join("");
      const esPrimera=idx===0, esUltima=idx===nombresOrdenados.length-1;
      const flecha=(dir)=>`<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="${dir<0?'M2 8l4-4 4 4':'M2 4l4 4 4-4'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      html+=`<div class="cat-row cfg-cat">
        <div class="cfg-cat-head">
          <button type="button" class="cfg-cat-ico" onclick="openIconPicker({mode:'edit',cat:${catEsc}})" title="Cambiar ícono" aria-label="Cambiar el ícono de ${escapeHtml(cat)}">${getIcon(cat)}</button>
          <div class="cfg-cat-nombre">${escapeHtml(cat)}${esDefault?'':' <span class="badge badge-accent">propia</span>'}</div>
          <div class="cfg-cat-orden">
            <button type="button" class="cfg-ico-btn"${esPrimera?' disabled':''} onclick="moverCategoriaOrden('${t}',${catEsc},-1)" title="Subir" aria-label="Subir ${escapeHtml(cat)}">${flecha(-1)}</button>
            <button type="button" class="cfg-ico-btn"${esUltima?' disabled':''} onclick="moverCategoriaOrden('${t}',${catEsc},1)" title="Bajar" aria-label="Bajar ${escapeHtml(cat)}">${flecha(1)}</button>
          </div>
        </div>
        <div class="cfg-chips cfg-chips-sub">${subsHtml||'<span class="txt-xs txt-muted cfg-sin-sub">Sin subcategorías</span>'}<button type="button" class="cfg-chip cfg-chip-btn" onclick="agregarSubcat('${t}',${catEsc})" aria-label="Agregar una subcategoría a ${escapeHtml(cat)}">+ Sub</button>${esDefault?'':`<button type="button" class="cfg-chip cfg-chip-btn cfg-chip-peligro" onclick="borrarCat('${t}',${catEsc})" aria-label="Eliminar la categoría ${escapeHtml(cat)}">Eliminar categoría</button>`}</div>
      </div>`;
    });
  });
  if(!html)html=`<p style="font-size:13px;color:var(--muted);padding:8px 0">Sin categorías</p>`;
  el.innerHTML=html;
}

// Pide al usuario una nueva subcategoría y la agrega a la categoría indicada
async function agregarSubcat(tipo, cat){
  const nombre=await mostrarPrompt(`Nueva subcategoría para "${cat}":`, {titulo:"Nueva subcategoría", textoOk:"Agregar"});
  if(!nombre) return;
  const limpio=nombreSeguro(nombre.trim());
  if(!limpio) return;
  // Verificar duplicado
  const actuales=getCats(tipo)[cat]||[];
  if(actuales.includes(limpio)){
    showToast("Esa subcategoría ya existe");
    return;
  }
  // Agregar al custom store
  if(!custom[tipo]) custom[tipo]={};
  if(!custom[tipo][cat]) custom[tipo][cat]=[];
  custom[tipo][cat].push(limpio);
  save();
  buildCats();buildTcCats();buildInvCats();
  renderCatManager();
  showToast("Subcategoría agregada ✓");
}

// Borra una subcategoría custom (solo las que agregó el usuario, no las default)
async function borrarSubcat(tipo, cat, sub){
  if(!custom[tipo]||!custom[tipo][cat]) return;
  if(!await mostrarConfirm(`¿Eliminar subcategoría "${sub}" de "${cat}"?`, {textoOk:"Eliminar", peligroso:true})) return;
  custom[tipo][cat]=custom[tipo][cat].filter(s=>s!==sub);
  // Si la cat custom queda vacía y NO es default, conservar (puede ser cat nueva sin subs)
  // Si la cat es default y custom queda vacío, eliminar la entry
  if(custom[tipo][cat].length===0 && DEFAULT_CATS[tipo] && DEFAULT_CATS[tipo][cat]){
    delete custom[tipo][cat];
  }
  save();
  buildCats();buildTcCats();buildInvCats();
  renderCatManager();
  showToast("Subcategoría eliminada");
}

async function borrarCat(t,cat){
  if(!await mostrarConfirm(`¿Eliminar la categoría "${cat}"?`, {textoOk:"Eliminar", peligroso:true})) return;   // igual que la subcategoría: sin esto se borraba de un toque
  if(custom[t])delete custom[t][cat];save();buildCats();buildTcCats();buildInvCats();renderCatManager();showToast("Categoría eliminada");}

// Evalúa una expresión simple de suma/resta para el campo importe
// Acepta: 1500, 1500.50, 1500+750+300, 1500-200, etc. Solo dígitos, +, -, ., ,
