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

// Pura. Ventas o rescates sin retiro ligado que parecen haber salido de un fondo: [{inv, fondo:{cat,sub}, moneda, monto}], la más nueva primero.
function ventasSinRetiro(lista, ignoradas){
  const ign=new Set(ignoradas||[]);
  const ligadas=new Set((lista||[]).filter(x=>x && x.origenInvId).map(x=>x.origenInvId));
  const out=[];
  (lista||[]).forEach(m=>{
    if(!m || m.tipo!=="Inversion" || !isInvSalida(m) || !esOperacionDeVenta(m.subcat) || ligadas.has(m.id) || ign.has(m.id)) return;
    const usd=!!(m.importeUSD>0 && !(m.importe>0)), monto=usd ? m.importeUSD : m.importe;
    if(!(monto>0) || !m.ticker) return;
    const moneda=usd ? "USD" : "ARS", fondo=fondoDelTicker(lista, m.ticker, moneda);
    if(fondo) out.push({inv:m, fondo, moneda, monto});
  });
  return out.sort((a,b)=>String(b.inv.fecha).localeCompare(String(a.inv.fecha)) || (b.inv.id||0)-(a.inv.id||0));
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
const ventasIgnoradas=()=>leerJSONSeguro(VENTA_IGNORADAS_KEY, "[]", "array");
let ventasFondoFilas=[], ventasFondoCopiaHecha=false;

const fmtMontoVenta=(v)=> v.moneda==="USD" ? fmtMoneda(v.monto,"USD") : fmtS(v.monto);
function ventasFondoHTML(filas){
  if(!filas.length) return `<p class="txt-sm" style="margin:12px 0"><strong>✓ No hay ventas pendientes de revisar.</strong></p>`;
  const nombre=f=>escapeHtml(f.cat+(f.sub?" › "+f.sub:""));
  const items=filas.map((v,i)=>`<div class="sc-grupo">
      <div class="sc-top"><span><strong>${escapeHtml(v.inv.ticker)}</strong> <span class="txt-xs txt-muted">${escapeHtml(v.inv.subcat||"venta")}</span></span><span class="sc-n">${fmtMontoVenta(v)}</span></div>
      <div class="sc-det">${escapeHtml(fmtDiaMes(v.inv.fecha))}${v.inv.cuenta&&v.inv.cuenta!=="Cuentas"?` · ${escapeHtml(v.inv.cuenta)}`:""} · Se descontaría de <strong>${nombre(v.fondo)}</strong>.</div>
      <div class="sc-acc"><button type="button" class="btn-sm" onclick="vincularVentaConFondo(${i})">Sí, salió del fondo</button>
        <button type="button" class="btn-sm" onclick="descartarVentaFondo(${i})">No fue del fondo</button></div>
    </div>`).join("");
  return `<p class="txt-sm" style="margin:12px 0 4px"><strong>${filas.length} ${filas.length===1?"venta":"ventas"} para revisar</strong></p>
    <p class="txt-xs txt-muted" style="margin:0 0 8px;line-height:1.4">Cuando una venta sale de un fondo de ahorro, el fondo tiene que bajar y esa plata suma a lo disponible del mes de la venta (en vez de contarse como ganancia). La pista: el ticker figura en las notas de ese fondo. No se cambia nada hasta que tocás “Sí”.</p>${items}`;
}
function renderVentasFondoDetalle(){
  const el=document.getElementById("ventas-fondo-detalle");
  if(!el) return;
  ventasFondoFilas=ventasSinRetiro(movs, ventasIgnoradas());
  el.innerHTML=ventasFondoHTML(ventasFondoFilas);
}
function renderVentasFondoCard(){
  const card=document.getElementById("ventas-fondo-card");
  if(!card) return;
  const n=ventasSinRetiro(movs, ventasIgnoradas()).length;
  card.style.display=n ? "" : "none";
  const el=document.getElementById("ventas-fondo-resumen");
  if(el) el.textContent=`${n} ${n===1?"venta parece haber salido":"ventas parecen haber salido"} de tus ahorros y no ${n===1?"descontó":"descontaron"} el fondo.`;
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
async function vincularVentaConFondo(i){
  const v=ventasFondoFilas[i];
  if(!v) return false;
  if(!ventasFondoCopiaHecha){
    try{ await guardarCopiaLocal("seguridad"); }catch(e){ console.warn("No se pudo guardar la copia de seguridad previa:", e); }
    ventasFondoCopiaHecha=true;
  }
  let idNuevo=Date.now(); while(movs.some(x=>x.id===idNuevo)) idNuevo++;
  const retiro=crearRetiroPorVenta(v.inv, v.fondo, idNuevo);
  movs.unshift(retiro);
  save();
  ofrecerDeshacerCambio(`${v.inv.ticker}: descontado de ${v.fondo.cat}${v.fondo.sub?" › "+v.fondo.sub:""} ✓`, ()=>{ movs=movs.filter(x=>x.id!==retiro.id); renderVentasFondoDetalle(); });
  renderVentasFondoDetalle();
  return true;
}
function descartarVentaFondo(i){
  const v=ventasFondoFilas[i];
  if(!v) return;
  guardarJSONSeguro(VENTA_IGNORADAS_KEY, [...new Set([...ventasIgnoradas(), v.inv.id])]);
  renderVentasFondoDetalle();
}

// El aviso para el Dashboard. null si no hay ventas para revisar.
function alertaDeVentasSinRetiro(lista){
  const n=ventasSinRetiro(lista, ventasIgnoradas()).length;
  if(!n) return null;
  return {nivel:"info", icono:"💸", titulo:`${n} ${n===1?"venta parece haber salido":"ventas parecen haber salido"} de tus ahorros`,
    detalle:"El fondo no bajó cuando las cargaste. Revisalas y, si salieron del fondo, vinculalas con un toque.", accion:{texto:"Revisar ventas", fn:"abrirVentasFondo"}};
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
