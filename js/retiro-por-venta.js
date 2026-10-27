// ═══════════════════════════════════════════
// VENTA DE UNA INVERSIÓN QUE SALE DE UN FONDO DE AHORRO
// ═══════════════════════════════════════════
// Vender SPY y dejar los pesos en el broker no es un ingreso: es plata tuya que cambia de lugar. La venta se carga como inversión
// (así suma a lo que tenés a mano), pero el saldo del fondo de ahorro de donde salió solo baja con un RETIRO del fondo. Antes había
// que cargar dos movimientos a mano. Ahora, al cargar una venta, la casilla "Sale de mis ahorros" crea el retiro ligado
// (`origenInvId`): es un traspaso, así que baja el fondo sin contar como gasto. Si editás o borrás la venta, el retiro la acompaña.

const SALE_VENTA_RE=/venta|rescate|tomada/;
const esOperacionDeVenta=sub=>SALE_VENTA_RE.test(normalizarTexto(sub||""));

// Pura. Los fondos de ahorro (categoría › subcategoría) con saldo positivo en esa moneda, el más grande primero: [{cat, sub, saldo}].
function fondosConSaldo(lista, moneda){
  const mon=moneda==="USD" ? "USD" : "ARS", por={};
  (lista||[]).forEach(m=>{
    if(!esDepositoAhorro(m) && !esRetiroAhorro(m)) return;
    if((m.moneda==="USD" ? "USD" : "ARS")!==mon) return;
    const v=mon==="USD" ? (m.importeOrig||0) : (m.importe||0);
    const cat=m.cat||"Sin categoría", sub=m.subcat||"";
    const k=cat+"\u0001"+sub;
    const o=por[k]||(por[k]={cat, sub, saldo:0});
    o.saldo+=esDepositoAhorro(m) ? v : -v;
  });
  return Object.values(por).map(o=>({...o, saldo:Math.round(o.saldo*100)/100})).filter(o=>o.saldo>0).sort((a,b)=>b.saldo-a.saldo);
}

// Pura. El fondo donde más veces aparece el ticker en las notas de sus depósitos y retiros; si no aparece en ninguno, el de mayor saldo.
function fondoSugerido(lista, fondos, ticker){
  if(!fondos || !fondos.length) return null;
  const t=normalizarTexto(ticker||"");
  if(t.length>=2){
    const cuenta={};
    (lista||[]).forEach(m=>{
      if(!esDepositoAhorro(m) && !esRetiroAhorro(m)) return;
      if(!normalizarTexto(m.nota||"").split(/\s+/).includes(t)) return;
      const k=(m.cat||"Sin categoría")+"\u0001"+(m.subcat||"");
      cuenta[k]=(cuenta[k]||0)+1;
    });
    const mejor=fondos.map(f=>({f, n:cuenta[f.cat+"\u0001"+f.sub]||0})).sort((a,b)=>b.n-a.n)[0];
    if(mejor && mejor.n>0) return mejor.f;
  }
  return fondos[0];
}

// Pura. El retiro del fondo que acompaña a una venta: mismo monto y fecha, es un traspaso (no un gasto) y queda ligado a la venta.
function crearRetiroPorVenta(inv, fondo, id){
  const usd=!!(inv.importeUSD && !inv.importe);
  const monto=usd ? inv.importeUSD : inv.importe;
  return {id, tipo:"Gasto", importe: usd ? 0 : monto, importeOrig: usd ? monto : null, moneda: usd ? "USD" : "ARS",
    cat:fondo.cat, subcat:fondo.sub, cuenta:inv.cuenta||"", fecha:inv.fecha, nota: inv.nota || `Venta ${inv.ticker||""}`.trim(), tags:[],
    esAhorro:false, usaAhorro:true, traspaso:true, recuperable:0, origenInvId:inv.id};
}

// Si editás la venta (monto, moneda, fecha, cuenta), el retiro ligado se pone igual. Devuelve cuántos tocó.
function sincronizarRetiroLigado(inv, lista){
  let n=0;
  (lista||[]).forEach(x=>{
    if(x.origenInvId!==inv.id) return;
    const usd=!!(inv.importeUSD && !inv.importe), monto=usd ? inv.importeUSD : inv.importe;
    x.moneda=usd ? "USD" : "ARS"; x.importe=usd ? 0 : monto; x.importeOrig=usd ? monto : null;
    x.fecha=inv.fecha; x.cuenta=inv.cuenta||"";
    n++;
  });
  return n;
}

// ── Formulario de Cargar › Inversión ──
const fondoKey=f=>f.cat+"\u0001"+f.sub;
function actualizarSaleDeAhorro(){
  const grupo=document.getElementById("inv-sale-ahorro-group");
  if(!grupo) return;
  const chk=document.getElementById("inv-sale-ahorro"), sel=document.getElementById("inv-fondo"), sub=document.getElementById("inv-subcat"), fg=document.getElementById("inv-fondo-group");
  const moneda=(document.getElementById("inv-moneda")||{}).value==="USD" ? "USD" : "ARS";
  const fondos=esOperacionDeVenta(sub && sub.value) ? fondosConSaldo(movs, moneda) : [];
  grupo.style.display=fondos.length ? "" : "none";
  if(!fondos.length){ if(chk) chk.checked=false; if(fg) fg.style.display="none"; return; }
  if(fg) fg.style.display=chk && chk.checked ? "" : "none";
  if(!sel) return;
  const previo=sel.value;
  sel.innerHTML=fondos.map(f=>`<option value="${escapeHtml(fondoKey(f))}">${escapeHtml(f.cat+(f.sub?" › "+f.sub:""))} · saldo ${moneda==="USD"?fmtMoneda(f.saldo,"USD"):fmtS(f.saldo)}</option>`).join("");
  const ticker=(document.getElementById("inv-ticker")||{}).value||"";
  const elegido=fondos.find(f=>fondoKey(f)===previo) || fondoSugerido(movs, fondos, ticker);
  if(elegido) sel.value=fondoKey(elegido);
}
// El fondo elegido en el formulario, o null si la casilla no está tildada.
function fondoElegidoEnFormulario(){
  const chk=document.getElementById("inv-sale-ahorro"), sel=document.getElementById("inv-fondo");
  if(!chk || !chk.checked || !sel || !sel.value) return null;
  const moneda=(document.getElementById("inv-moneda")||{}).value==="USD" ? "USD" : "ARS";
  return fondosConSaldo(movs, moneda).find(f=>fondoKey(f)===sel.value) || null;
}

// ═══════════════════════════════════════════
// VENTAS YA CARGADAS QUE PARECEN HABER SALIDO DE UN FONDO
// ═══════════════════════════════════════════
// Las ventas cargadas antes de la casilla "Sale de mis ahorros" no descontaron el fondo. Se detectan por una pista concreta: el ticker de la
// venta figura en las notas de un fondo de ahorro ("Spy x 12" en Fondo de Retiro › Cedears). Sin esa pista no se propone nada (un rescate de
// un FCI que nunca pasó por un fondo no se toca). Nada cambia solo: cada venta se confirma o se descarta.

// Pura. El fondo (categoría › subcategoría) donde más veces aparece el ticker en las notas de depósitos y retiros, en esa moneda; null si no aparece.
function fondoDelTicker(lista, ticker, moneda){
  const t=normalizarTexto(ticker||"");
  if(t.length<2) return null;
  const mon=moneda==="USD" ? "USD" : "ARS", cuenta={};
  (lista||[]).forEach(m=>{
    if(!esDepositoAhorro(m) && !esRetiroAhorro(m)) return;
    if((m.moneda==="USD" ? "USD" : "ARS")!==mon) return;
    if(!normalizarTexto(m.nota||"").split(/\s+/).includes(t)) return;
    const k=(m.cat||"Sin categoría")+"\u0001"+(m.subcat||"");
    (cuenta[k]=cuenta[k]||{cat:m.cat||"Sin categoría", sub:m.subcat||"", n:0}).n++;
  });
  const mejor=Object.values(cuenta).sort((a,b)=>b.n-a.n)[0];
  return mejor ? {cat:mejor.cat, sub:mejor.sub} : null;
}

const diasEntreISO=(a,b)=>Math.abs(Math.round((Date.parse(String(a).slice(0,10)+"T00:00:00Z")-Date.parse(String(b).slice(0,10)+"T00:00:00Z"))/86400000));
const esVentaDeInversion=m=>!!m && m.tipo==="Inversion" && isInvSalida(m) && esOperacionDeVenta(m.subcat);
const montoDeVenta=m=>(m.importeUSD>0 && !(m.importe>0)) ? m.importeUSD : (m.importe||0);

// Pura. El retiro que YA estaba cargado a mano para esa venta (un gasto "sale de mis ahorros" del mismo fondo, sin ligar a ninguna venta): el ticker
// figura en su nota, hasta RETIRO_DIAS días de diferencia y monto parecido (±RETIRO_TOLERANCIA). Elige el más parecido que no esté en `usados`.
const RETIRO_DIAS=10, RETIRO_TOLERANCIA=0.05;
function retiroCargadoDeVenta(lista, inv, fondo, usados){
  const monto=montoDeVenta(inv), usd=!!(inv.importeUSD>0 && !(inv.importe>0)), t=normalizarTexto(inv.ticker||"");
  let mejor=null, mejorPuntaje=Infinity;
  (lista||[]).forEach(x=>{
    if(!esRetiroAhorro(x) || x.origenInvId || (usados && usados.has(x.id))) return;
    if((x.cat||"Sin categoría")!==fondo.cat || (x.subcat||"")!==fondo.sub) return;
    if((x.moneda==="USD")!==usd) return;
    if(!normalizarTexto(x.nota||"").split(/\s+/).includes(t)) return;
    const dias=diasEntreISO(x.fecha, inv.fecha), xm=usd ? (x.importeOrig||0) : (x.importe||0);
    if(dias>RETIRO_DIAS || !(monto>0) || Math.abs(xm-monto)/monto>RETIRO_TOLERANCIA) return;
    const puntaje=Math.abs(xm-monto)/monto*100+dias;
    if(puntaje<mejorPuntaje){ mejor=x; mejorPuntaje=puntaje; }
  });
  return mejor;
}

// Pura. Si hay OTRA venta del mismo ticker, día y cuenta con casi el mismo monto (±0,5%), devuelve la más vieja de las dos cuando `inv` es la que sobra;
// si `inv` es la original (o no hay otra), null. Se queda la que se cargó primero (el id más bajo).
function ventaRepetidaDe(lista, inv){
  const monto=montoDeVenta(inv);
  if(!(monto>0)) return null;
  const otras=(lista||[]).filter(w=>w!==inv && esVentaDeInversion(w) && w.ticker===inv.ticker && String(w.fecha).slice(0,10)===String(inv.fecha).slice(0,10)
    && (w.cuenta||"")===(inv.cuenta||"") && Math.abs(montoDeVenta(w)-monto)/monto<=0.005 && (w.id||0)<(inv.id||0));
  return otras.sort((a,b)=>(a.id||0)-(b.id||0))[0] || null;
}

// Pura. Ventas o rescates sin retiro ligado que parecen haber salido de un fondo, la más nueva primero:
// [{inv, fondo:{cat,sub}, moneda, monto, retiro (el retiro ya cargado a mano que le corresponde, o null), repetida (la venta original si esta parece repetida, o null)}].
// `descartadasRepetidas`: ids de ventas que ya confirmaste que NO son repetidas.
function ventasSinRetiro(lista, ignoradas, noRepetidas){
  const ign=new Set(ignoradas||[]), noRep=new Set(noRepetidas||[]);
  const ligadas=new Set((lista||[]).filter(x=>x && x.origenInvId).map(x=>x.origenInvId));
  const cand=[];
  (lista||[]).forEach(m=>{
    if(!esVentaDeInversion(m) || ligadas.has(m.id) || ign.has(m.id)) return;
    const usd=!!(m.importeUSD>0 && !(m.importe>0)), monto=usd ? m.importeUSD : m.importe;
    if(!(monto>0) || !m.ticker) return;
    const moneda=usd ? "USD" : "ARS", fondo=fondoDelTicker(lista, m.ticker, moneda);
    if(fondo) cand.push({inv:m, fondo, moneda, monto, retiro:null, repetida: noRep.has(m.id) ? null : ventaRepetidaDe(lista, m)});
  });
  // Cada retiro cargado a mano se empareja con UNA venta: primero las que mejor encajan.
  const usados=new Set();
  cand.filter(c=>!c.repetida).map(c=>({c, r:retiroCargadoDeVenta(lista, c.inv, c.fondo, null)})).filter(x=>x.r)
    .sort((a,b)=>Math.abs((a.r.importe||a.r.importeOrig)-a.c.monto)-Math.abs((b.r.importe||b.r.importeOrig)-b.c.monto))
    .forEach(({c})=>{ const r=retiroCargadoDeVenta(lista, c.inv, c.fondo, usados); if(r){ c.retiro=r; usados.add(r.id); } });
  return cand.sort((a,b)=>String(b.inv.fecha).localeCompare(String(a.inv.fecha)) || (b.inv.id||0)-(a.inv.id||0));
}

// Pura. Los fondos que se ofrecen para una venta (en su moneda) más el fondo del que ya está ligada, aunque su saldo sea cero.
function fondosParaVenta(lista, inv){
  const usd=!!(inv.importeUSD>0 && !(inv.importe>0)), moneda=usd ? "USD" : "ARS";
  const fondos=fondosConSaldo(lista, moneda);
  const retiro=(lista||[]).find(x=>x.origenInvId===inv.id);
  if(retiro && !fondos.some(f=>f.cat===retiro.cat && f.sub===(retiro.subcat||""))) fondos.push({cat:retiro.cat, sub:retiro.subcat||"", saldo:0});
  return fondos;
}

// ── Pantalla: Configuración › Ventas que salieron de ahorros ──
const VENTA_IGNORADAS_KEY="fventafondoignoradas";
const VENTA_NOREPETIDA_KEY="fventanorepetidas";
const ventasIgnoradas=()=>leerJSONSeguro(VENTA_IGNORADAS_KEY, "[]", "array");
const ventasNoRepetidas=()=>leerJSONSeguro(VENTA_NOREPETIDA_KEY, "[]", "array");
const ventasPorRevisar=lista=>ventasSinRetiro(lista, ventasIgnoradas(), ventasNoRepetidas());
let ventasFondoFilas=[], ventasFondoCopiaHecha=false;

const fmtMontoVenta=(v)=> v.moneda==="USD" ? fmtMoneda(v.monto,"USD") : fmtS(v.monto);
function ventasFondoHTML(filas){
  if(!filas.length) return `<p class="txt-sm" style="margin:12px 0"><strong>✓ No hay ventas pendientes de revisar.</strong></p>`;
  const nombre=f=>escapeHtml(f.cat+(f.sub?" › "+f.sub:""));
  const items=filas.map((v,i)=>{
    const cab=`<div class="sc-top"><span><strong>${escapeHtml(v.inv.ticker)}</strong> <span class="txt-xs txt-muted">${escapeHtml(v.inv.subcat||"venta")}</span></span><span class="sc-n">${fmtMontoVenta(v)}</span></div>`;
    const dato=`${escapeHtml(fmtDiaMes(v.inv.fecha))}${v.inv.cuenta&&v.inv.cuenta!=="Cuentas"?` · ${escapeHtml(v.inv.cuenta)}`:""}`;
    if(v.repetida) return `<div class="sc-grupo">${cab}
      <div class="sc-det">${dato} · ⚠️ Parece <strong>repetida</strong>: hay otra venta de ${escapeHtml(v.inv.ticker)} el mismo día por ${fmtMontoVenta({monto:montoDeVenta(v.repetida), moneda:v.moneda})}.</div>
      <div class="sc-acc"><button type="button" class="btn-sm" onclick="eliminarVentaRepetida(${i})">Es repetida: eliminar esta</button>
        <button type="button" class="btn-sm" onclick="ventaNoEsRepetida(${i})">Son dos ventas</button></div></div>`;
    if(v.retiro) return `<div class="sc-grupo">${cab}
      <div class="sc-det">${dato} · Ya la cargaste como retiro de <strong>${nombre(v.fondo)}</strong> (“${escapeHtml(v.retiro.nota||"")}”, ${escapeHtml(fmtDiaMes(v.retiro.fecha))}, ${v.moneda==="USD"?fmtMoneda(v.retiro.importeOrig||0,"USD"):fmtS(v.retiro.importe||0)}). Unirlas evita contarla dos veces.</div>
      <div class="sc-acc"><button type="button" class="btn-sm" onclick="unirVentaConRetiro(${i})">Unir con ese retiro</button>
        <button type="button" class="btn-sm" onclick="descartarVentaFondo(${i})">No es esa</button></div></div>`;
    return `<div class="sc-grupo">${cab}
      <div class="sc-det">${dato} · Se descontaría de <strong>${nombre(v.fondo)}</strong>.</div>
      <div class="sc-acc"><button type="button" class="btn-sm" onclick="vincularVentaConFondo(${i})">Sí, salió del fondo</button>
        <button type="button" class="btn-sm" onclick="descartarVentaFondo(${i})">No fue del fondo</button></div></div>`;
  }).join("");
  return `<p class="txt-sm" style="margin:12px 0 4px"><strong>${filas.length} ${filas.length===1?"venta":"ventas"} para revisar</strong></p>
    <p class="txt-xs txt-muted" style="margin:0 0 8px;line-height:1.4">Cuando una venta sale de un fondo de ahorro, el fondo tiene que bajar y esa plata suma a lo disponible del mes de la venta (en vez de contarse como ganancia y como gasto a la vez). Si ya cargaste el retiro del fondo a mano, se <strong>une</strong> a la venta: queda un solo registro, no dos. No se cambia nada hasta que lo confirmás.</p>${items}`;
}
function renderVentasFondoDetalle(){
  const el=document.getElementById("ventas-fondo-detalle");
  if(!el) return;
  ventasFondoFilas=ventasPorRevisar(movs);
  el.innerHTML=ventasFondoHTML(ventasFondoFilas);
}
function renderVentasFondoCard(){
  const card=document.getElementById("ventas-fondo-card");
  if(!card) return;
  const n=ventasPorRevisar(movs).length;
  card.style.display=n ? "" : "none";
  const el=document.getElementById("ventas-fondo-resumen");
  if(el) el.textContent=`${n} ${n===1?"venta tiene":"ventas tienen"} que revisarse: salieron de tus ahorros y el fondo no las refleja bien (o están repetidas).`;
}
function abrirVentasFondo(){
  if(!document.getElementById("ventas-fondo-detalle")) return;
  ventasFondoCopiaHecha=false;
  renderVentasFondoDetalle();
  document.getElementById("modal-ventas-fondo").classList.add("open");
}
function cerrarVentasFondo(){
  const m=document.getElementById("modal-ventas-fondo");
  if(m) m.classList.remove("open");
  renderVentasFondoCard();
  if(typeof refrescarVistas==="function") refrescarVistas();
  if(typeof renderAlertas==="function") try{ renderAlertas(); }catch(e){ /* sin Dashboard */ }
}
async function copiaAntesDeVentasFondo(){
  if(ventasFondoCopiaHecha) return;
  try{ await guardarCopiaLocal("seguridad"); }catch(e){ console.warn("No se pudo guardar la copia de seguridad previa:", e); }
  ventasFondoCopiaHecha=true;
}
// Crea el retiro del fondo que acompaña a la venta (cuando no estaba cargado).
async function vincularVentaConFondo(i){
  const v=ventasFondoFilas[i];
  if(!v) return false;
  await copiaAntesDeVentasFondo();
  let idNuevo=Date.now(); while(movs.some(x=>x.id===idNuevo)) idNuevo++;
  const retiro=crearRetiroPorVenta(v.inv, v.fondo, idNuevo);
  movs.unshift(retiro);
  save();
  ofrecerDeshacerCambio(`${v.inv.ticker}: descontado de ${v.fondo.cat}${v.fondo.sub?" › "+v.fondo.sub:""} ✓`, ()=>{ movs=movs.filter(x=>x.id!==retiro.id); renderVentasFondoDetalle(); });
  renderVentasFondoDetalle();
  return true;
}
// Une la venta con el retiro que ya estaba cargado a mano: ese retiro pasa a ser el de la venta (deja de contar como gasto, toma su monto y fecha).
async function unirVentaConRetiro(i){
  const v=ventasFondoFilas[i];
  if(!v || !v.retiro) return false;
  await copiaAntesDeVentasFondo();
  const r=movs.find(x=>x.id===v.retiro.id);
  if(!r) return false;
  const revertir=capturarCampos([r], ["origenInvId","traspaso","importe","importeOrig","moneda","fecha","cuenta"]);
  r.origenInvId=v.inv.id; r.traspaso=true;
  sincronizarRetiroLigado(v.inv, movs);
  save();
  ofrecerDeshacerCambio(`${v.inv.ticker}: unida con su retiro del fondo ✓`, ()=>{ revertir(); renderVentasFondoDetalle(); });
  renderVentasFondoDetalle();
  return true;
}
// Elimina la venta que sobra (queda la que se cargó primero). Va a la papelera, se puede deshacer.
async function eliminarVentaRepetida(i){
  const v=ventasFondoFilas[i];
  if(!v || !v.repetida) return false;
  await copiaAntesDeVentasFondo();
  eliminarConDeshacer("mov", x=>x.id===v.inv.id, `Venta repetida de ${v.inv.ticker} eliminada`);
  renderVentasFondoDetalle();
  return true;
}
function ventaNoEsRepetida(i){
  const v=ventasFondoFilas[i];
  if(!v) return;
  guardarJSONSeguro(VENTA_NOREPETIDA_KEY, [...new Set([...ventasNoRepetidas(), v.inv.id])]);
  renderVentasFondoDetalle();
}
function descartarVentaFondo(i){
  const v=ventasFondoFilas[i];
  if(!v) return;
  guardarJSONSeguro(VENTA_IGNORADAS_KEY, [...new Set([...ventasIgnoradas(), v.inv.id])]);
  renderVentasFondoDetalle();
}

// El aviso para el Dashboard. null si no hay ventas para revisar.
function alertaDeVentasSinRetiro(lista){
  const n=ventasPorRevisar(lista).length;
  if(!n) return null;
  return {nivel:"info", icono:"💸", titulo:`${n} ${n===1?"venta parece haber salido":"ventas parecen haber salido"} de tus ahorros`,
    detalle:"El fondo no las refleja bien (o están repetidas). Revisalas: si ya cargaste el retiro a mano se unen en un solo registro.", accion:{texto:"Revisar ventas", fn:"abrirVentasFondo"}};
}

// ── Editor de una inversión: la misma casilla "Sale de mis ahorros" ──
// HTML del bloque para el editor de una venta/rescate ("" si no es una venta o no hay fondos).
function bloqueSaleDeAhorroEditor(m){
  if(!m || m.tipo!=="Inversion" || !isInvSalida(m) || !esOperacionDeVenta(m.subcat)) return "";
  const fondos=fondosParaVenta(movs, m);
  if(!fondos.length) return "";
  const retiro=movs.find(x=>x.origenInvId===m.id);
  const elegido=(retiro && fondos.find(f=>f.cat===retiro.cat && f.sub===(retiro.subcat||""))) || fondoSugerido(movs, fondos, m.ticker) || fondos[0];
  const usd=!!(m.importeUSD>0 && !(m.importe>0));
  const opciones=fondos.map(f=>`<option value="${escapeHtml(fondoKey(f))}"${fondoKey(f)===fondoKey(elegido)?" selected":""}>${escapeHtml(f.cat+(f.sub?" › "+f.sub:""))} · saldo ${usd?fmtMoneda(f.saldo,"USD"):fmtS(f.saldo)}</option>`).join("");
  return `<div class="form-group">
      <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;padding:10px 12px;background:var(--save-light);border-radius:var(--radius-sm)">
        <input type="checkbox" id="edit-inv-sale" class="chk-custom" style="--chk:var(--save)" ${retiro?"checked":""} onchange="document.getElementById('edit-inv-fondo-wrap').style.display=this.checked?'':'none'">
        <span style="color:var(--save);font-weight:500">💸 Sale de mis ahorros (descuenta el fondo)</span>
      </label>
      <div id="edit-inv-fondo-wrap" style="margin-top:8px;display:${retiro?"":"none"}">
        <label class="form-label" for="edit-inv-fondo">¿De qué fondo?</label>
        <select id="edit-inv-fondo" class="form-select">${opciones}</select>
      </div>
    </div>`;
}
// Al guardar el editor: crea, cambia o saca el retiro ligado según la casilla. El monto y la fecha los pone sincronizarRetiroLigado().
function aplicarSaleDeAhorroEditor(m){
  const chk=document.getElementById("edit-inv-sale");
  if(!chk) return;
  const retiro=movs.find(x=>x.origenInvId===m.id);
  if(chk.checked){
    const sel=document.getElementById("edit-inv-fondo");
    const f=fondosParaVenta(movs, m).find(x=>sel && fondoKey(x)===sel.value);
    if(!f) return;
    if(retiro){ retiro.cat=f.cat; retiro.subcat=f.sub; }
    else{ let id=Date.now()+1; while(movs.some(x=>x.id===id)) id++; movs.unshift(crearRetiroPorVenta(m, f, id)); }
  } else if(retiro){
    movs=movs.filter(x=>x!==retiro);
  }
}
