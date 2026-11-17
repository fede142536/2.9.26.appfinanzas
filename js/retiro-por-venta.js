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
// Cuánto se saca del fondo por una venta o rescate: el CAPITAL que esa venta devuelve (lo que habías puesto), no todo lo cobrado. Si vendiste en 600 algo
// que te costó 500, del fondo salen 500 y los 100 restantes son ganancia (suman a tus ingresos y a "Resultado inv."). Sin capital cargado (o si la venta
// no tiene ganancia) sale el monto entero, como siempre. `lista` debe incluir la venta.
function montoRetiroDeVenta(inv, lista){
  const usd=!!(inv.importeUSD && !inv.importe);
  const total=usd ? inv.importeUSD : inv.importe;
  const dev=((calcularResultadoInv(lista).capitalDevueltoPorOp[inv.id]||{})[usd?"usd":"ars"])||0;
  return (dev>0 && dev<total) ? Math.round(dev*100)/100 : total;
}
function crearRetiroPorVenta(inv, fondo, id, montoRetiro){
  const usd=!!(inv.importeUSD && !inv.importe);
  const monto=(montoRetiro>0) ? montoRetiro : (usd ? inv.importeUSD : inv.importe);
  return {id, tipo:"Gasto", importe: usd ? 0 : monto, importeOrig: usd ? monto : null, moneda: usd ? "USD" : "ARS",
    cat:fondo.cat, subcat:fondo.sub, cuenta:inv.cuenta||"", fecha:inv.fecha, nota: inv.nota || `Venta ${inv.ticker||""}`.trim(), tags:[],
    esAhorro:false, usaAhorro:true, traspaso:true, recuperable:0, origenInvId:inv.id,
    ...((montoRetiro>0 && montoRetiro<(usd ? inv.importeUSD : inv.importe)) ? {soloCapital:true} : {}),
    ...(inv.ticker ? {ticker:inv.ticker} : {}), ...(inv.cantidad>0 ? {cantidad:inv.cantidad} : {})};
}

// Si editás la venta (monto, moneda, fecha, cuenta), el retiro ligado se pone igual. Devuelve cuántos tocó.
function sincronizarRetiroLigado(inv, lista){
  let n=0;
  (lista||[]).forEach(x=>{
    if(x.origenInvId!==inv.id) return;
    // Solo un retiro que NACIÓ por el capital (soloCapital) se vuelve a calcular con el capital cargado. Uno cargado a mano, o creado antes de que existiera esa regla,
    // conserva el monto entero de la venta: con un historial incompleto (compras viejas que están solo en el fondo) el capital conocido es menor al real y achicaría mal el retiro.
    const usd=!!(inv.importeUSD && !inv.importe), monto=x.soloCapital ? montoRetiroDeVenta(inv, lista) : (usd ? inv.importeUSD : inv.importe);
    x.moneda=usd ? "USD" : "ARS"; x.importe=usd ? 0 : monto; x.importeOrig=usd ? monto : null;
    x.fecha=inv.fecha; x.cuenta=inv.cuenta||"";
    if(inv.ticker) x.ticker=inv.ticker;
    // La cantidad viaja de la inversión al movimiento del fondo; si la inversión no la tiene y el movimiento sí, se queda con esa (no se pierde).
    if(inv.cantidad>0) x.cantidad=inv.cantidad; else if(x.cantidad>0) inv.cantidad=x.cantidad;
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
  // [AAA cargar] La opción lleva solo el nombre corto ("Retiro › Cedears"): con el saldo adentro el select lo cortaba justo en el importe
  // ("saldo $65…"). El saldo va en una línea de ayuda debajo (mostrarSaldoFondo), que se actualiza al cambiar de fondo.
  sel.innerHTML=fondos.map(f=>`<option value="${escapeHtml(fondoKey(f))}">${escapeHtml(f.cat.replace(/^Fondo de /i,"")+(f.sub?" › "+f.sub:""))}</option>`).join("");
  const ticker=(document.getElementById("inv-ticker")||{}).value||"";
  const elegido=fondos.find(f=>fondoKey(f)===previo) || fondoSugerido(movs, fondos, ticker);
  if(elegido) sel.value=fondoKey(elegido);
  mostrarSaldoFondo(fondos, moneda);
}
// actualizarSaleDeAhorro se llama al cambiar operación, ticker o moneda: la casilla de la compra se actualiza con ella.
const _actualizarSaleDeAhorroBase=actualizarSaleDeAhorro;
actualizarSaleDeAhorro=function(){ _actualizarSaleDeAhorroBase(); if(typeof actualizarFondoDeCompra==="function") actualizarFondoDeCompra(false); };
function mostrarSaldoFondo(fondos, moneda){
  const el=document.getElementById("inv-fondo-saldo"), sel=document.getElementById("inv-fondo");
  if(!el || !sel) return;
  if(!fondos){ fondos=fondosConSaldo(movs, (document.getElementById("inv-moneda")||{}).value==="USD" ? "USD" : "ARS"); moneda=(document.getElementById("inv-moneda")||{}).value==="USD" ? "USD" : "ARS"; }
  const f=fondos.find(x=>fondoKey(x)===sel.value);
  el.textContent=f ? "Saldo del fondo: "+(moneda==="USD" ? fmtMoneda(f.saldo,"USD") : fmtS(f.saldo)) : "";
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

// ═══════════════════════════════════════════
// INGRESO QUE SALE DE UN FONDO DE AHORRO
// ═══════════════════════════════════════════
// Lo cobrado por vender algo que estaba en un fondo (los CEDEARs del Fondo de Retiro) también se puede cargar como INGRESO: la casilla
// "Sale de mis ahorros" crea el mismo retiro ligado que en una venta (traspaso: baja el fondo sin contar como gasto). La diferencia es que acá el
// ingreso YA suma a lo que tenés a mano, así que el retiro NO lleva `origenInvId` (si no, esa plata se contaría dos veces en el balance, ver
// esRetiroAMano): lleva `origenIngresoId`. Si editás o borrás el ingreso, el retiro lo acompaña.
const monedaDeIngreso=m=>(m && m.moneda==="USD") ? "USD" : "ARS";
const montoDeIngreso=m=>monedaDeIngreso(m)==="USD" ? (m.importeOrig||0) : (m.importe||0);
function crearRetiroPorIngreso(ing, fondo, id){
  const usd=monedaDeIngreso(ing)==="USD", monto=montoDeIngreso(ing);
  return {id, tipo:"Gasto", importe: usd ? 0 : monto, importeOrig: usd ? monto : null, moneda: usd ? "USD" : "ARS",
    cat:fondo.cat, subcat:fondo.sub, cuenta:ing.cuenta||"", fecha:ing.fecha, nota: ing.nota || `Retiro ${ing.cat||"del fondo"}`.trim(), tags:[],
    esAhorro:false, usaAhorro:true, traspaso:true, recuperable:0, origenIngresoId:ing.id};
}
// Los fondos entre los que elegir para un ingreso (más el del retiro que ya tiene, aunque su saldo ya no alcance).
function fondosParaIngreso(lista, ing){
  const fondos=fondosConSaldo(lista, monedaDeIngreso(ing));
  const retiro=(lista||[]).find(x=>x.origenIngresoId===ing.id);
  if(retiro && !fondos.some(f=>f.cat===retiro.cat && f.sub===(retiro.subcat||""))) fondos.push({cat:retiro.cat, sub:retiro.subcat||"", saldo:0});
  return fondos;
}
// Si editás el ingreso (monto, moneda, fecha, cuenta), el retiro ligado se pone igual. Devuelve cuántos tocó.
function sincronizarRetiroDeIngreso(ing, lista){
  let n=0;
  (lista||[]).forEach(x=>{
    if(x.origenIngresoId!==ing.id) return;
    const usd=monedaDeIngreso(ing)==="USD", monto=montoDeIngreso(ing);
    x.moneda=usd ? "USD" : "ARS"; x.importe=usd ? 0 : monto; x.importeOrig=usd ? monto : null;
    x.fecha=ing.fecha; x.cuenta=ing.cuenta||"";
    n++;
  });
  return n;
}
// ── Formulario de Cargar › Ingreso ──
function actualizarSaleDeAhorroIngreso(){
  const grupo=document.getElementById("ing-sale-ahorro-group");
  if(!grupo) return;
  const chk=document.getElementById("ing-sale-ahorro"), sel=document.getElementById("ing-fondo"), fg=document.getElementById("ing-fondo-group");
  const moneda=(document.getElementById("inp-moneda")||{}).value==="USD" ? "USD" : "ARS";
  const fondos=fondosConSaldo(movs, moneda);
  grupo.style.display=fondos.length ? "" : "none";
  if(!fondos.length){ if(chk) chk.checked=false; if(fg) fg.style.display="none"; return; }
  if(fg) fg.style.display=chk && chk.checked ? "" : "none";
  if(!sel) return;
  const previo=sel.value;
  sel.innerHTML=fondos.map(f=>`<option value="${escapeHtml(fondoKey(f))}">${escapeHtml(f.cat.replace(/^Fondo de /i,"")+(f.sub?" › "+f.sub:""))}</option>`).join("");
  const elegido=fondos.find(f=>fondoKey(f)===previo) || fondoSugerido(movs, fondos, "");
  if(elegido) sel.value=fondoKey(elegido);
  mostrarSaldoFondoIngreso(fondos, moneda);
}
function mostrarSaldoFondoIngreso(fondos, moneda){
  const el=document.getElementById("ing-fondo-saldo"), sel=document.getElementById("ing-fondo");
  if(!el || !sel) return;
  moneda=moneda || ((document.getElementById("inp-moneda")||{}).value==="USD" ? "USD" : "ARS");
  fondos=fondos || fondosConSaldo(movs, moneda);
  const f=fondos.find(x=>fondoKey(x)===sel.value);
  el.textContent=f ? "Saldo del fondo: "+(moneda==="USD" ? fmtMoneda(f.saldo,"USD") : fmtS(f.saldo)) : "";
}
// El fondo elegido en el formulario del ingreso, o null si la casilla no está tildada.
function fondoElegidoEnIngreso(){
  const chk=document.getElementById("ing-sale-ahorro"), sel=document.getElementById("ing-fondo");
  if(!chk || !chk.checked || !sel || !sel.value) return null;
  const moneda=(document.getElementById("inp-moneda")||{}).value==="USD" ? "USD" : "ARS";
  return fondosConSaldo(movs, moneda).find(f=>fondoKey(f)===sel.value) || null;
}
// ── Editor de un ingreso: la misma casilla ──
function bloqueSaleDeAhorroEditorIngreso(m){
  if(!m || m.tipo!=="Ingreso" || m.frecuente) return "";
  const fondos=fondosParaIngreso(movs, m);
  if(!fondos.length) return "";
  const retiro=movs.find(x=>x.origenIngresoId===m.id);
  const elegido=(retiro && fondos.find(f=>f.cat===retiro.cat && f.sub===(retiro.subcat||""))) || fondoSugerido(movs, fondos, "") || fondos[0];
  const usd=monedaDeIngreso(m)==="USD";
  const opciones=fondos.map(f=>`<option value="${escapeHtml(fondoKey(f))}"${fondoKey(f)===fondoKey(elegido)?" selected":""}>${escapeHtml(f.cat+(f.sub?" › "+f.sub:""))} · saldo ${usd?fmtMoneda(f.saldo,"USD"):fmtS(f.saldo)}</option>`).join("");
  return `<div class="form-group">
      <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;padding:10px 12px;background:var(--save-light);border-radius:var(--radius-sm)">
        <input type="checkbox" id="edit-ing-sale" class="chk-custom" style="--chk:var(--save)" ${retiro?"checked":""} onchange="document.getElementById('edit-ing-fondo-wrap').style.display=this.checked?'':'none'">
        <span style="color:var(--save);font-weight:500">💸 Sale de mis ahorros (descuenta el fondo)</span>
      </label>
      <div id="edit-ing-fondo-wrap" style="margin-top:8px;display:${retiro?"":"none"}">
        <label class="form-label" for="edit-ing-fondo">¿De qué fondo?</label>
        <select id="edit-ing-fondo" class="form-select">${opciones}</select>
      </div>
    </div>`;
}
function aplicarSaleDeAhorroEditorIngreso(m){
  const chk=document.getElementById("edit-ing-sale");
  if(!chk) return;
  const retiro=movs.find(x=>x.origenIngresoId===m.id);
  if(chk.checked){
    const sel=document.getElementById("edit-ing-fondo");
    const f=fondosParaIngreso(movs, m).find(x=>sel && fondoKey(x)===sel.value);
    if(!f) return;
    if(retiro){ retiro.cat=f.cat; retiro.subcat=f.sub; }
    else{ let id=Date.now()+1; while(movs.some(x=>x.id===id)) id++; movs.unshift(crearRetiroPorIngreso(m, f, id)); }
  } else if(retiro){
    movs=movs.filter(x=>x!==retiro);
  }
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
  const retiro=crearRetiroPorVenta(v.inv, v.fondo, idNuevo, montoRetiroDeVenta(v.inv, movs));
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
    else{ let id=Date.now()+1; while(movs.some(x=>x.id===id)) id++; movs.unshift(crearRetiroPorVenta(m, f, id, montoRetiroDeVenta(m, movs))); }
  } else if(retiro){
    movs=movs.filter(x=>x!==retiro);
  }
}

// ═══════════════════════════════════════════
// COMPRA QUE ES DE UN FONDO DE AHORRO: un solo registro
// ═══════════════════════════════════════════
// Si el fondo de ahorro es una inversión (el Fondo de Retiro es SPY), cada compra se cargaba dos veces: la inversión y el depósito al fondo, a mano y a veces con
// montos distintos. Con la casilla "Es de mi fondo de ahorro", la compra crea su depósito LIGADO (origenInvId): mismo monto, fecha, cuenta, ticker y cantidad. Si
// editás la compra el depósito la acompaña (sincronizarRetiroLigado), y si la borrás se va con ella. No cambia el balance: es el mismo depósito que antes cargabas aparte.

// Pura. Los fondos de ahorro (categoría › subcategoría) que alguna vez recibieron un depósito en esa moneda, el más usado primero: [{cat, sub, n}].
function fondosParaCompra(lista, moneda){
  const mon=moneda==="USD" ? "USD" : "ARS", por={};
  (lista||[]).forEach(m=>{
    if(!esDepositoAhorro(m) || (m.moneda==="USD" ? "USD" : "ARS")!==mon) return;
    const k=(m.cat||"Sin categoría")+"\u0001"+(m.subcat||"");
    (por[k]=por[k]||{cat:m.cat||"Sin categoría", sub:m.subcat||"", n:0}).n++;
  });
  return Object.values(por).sort((a,b)=>b.n-a.n);
}
// Pura. El fondo al que ya fueron otras compras de ese ticker (por el ticker o la nota de sus depósitos), o null: así la casilla se tilda sola para SPY.
function fondoHabitualDelTicker(lista, ticker, moneda){
  const t=tickerClave(ticker);
  if(!ticker || t==="SIN TICKER") return null;
  const cuenta={};
  (lista||[]).forEach(m=>{
    if(!esDepositoAhorro(m) || (m.moneda==="USD" ? "USD" : "ARS")!==(moneda==="USD" ? "USD" : "ARS")) return;
    const deNota=normalizarTexto(m.nota||"").split(/[^a-z0-9]+/).includes(normalizarTexto(ticker));
    if(!(m.ticker && tickerClave(m.ticker)===t) && !deNota) return;
    const k=(m.cat||"Sin categoría")+"\u0001"+(m.subcat||"");
    (cuenta[k]=cuenta[k]||{cat:m.cat||"Sin categoría", sub:m.subcat||"", n:0}).n++;
  });
  return Object.values(cuenta).sort((a,b)=>b.n-a.n)[0] || null;
}
// Pura. El depósito ligado a una compra.
function crearDepositoPorCompra(inv, fondo, id){
  const usd=!!(inv.importeUSD && !inv.importe), monto=usd ? inv.importeUSD : inv.importe;
  return {id, tipo:"Gasto", importe: usd ? 0 : monto, importeOrig: usd ? monto : null, moneda: usd ? "USD" : "ARS",
    cat:fondo.cat, subcat:fondo.sub, cuenta:inv.cuenta||"", fecha:inv.fecha, nota:inv.nota||"", tags:[],
    esAhorro:true, usaAhorro:false, traspaso:false, recuperable:0, origenInvId:inv.id,
    ...(inv.ticker ? {ticker:String(inv.ticker).trim().toUpperCase()} : {}), ...(inv.cantidad>0 ? {cantidad:inv.cantidad} : {})};
}
// ── Formulario de Cargar › Inversión: la casilla de la compra ──
// `porUsuario`: el cambio lo hizo la persona (tildó o destildó); si no, la casilla se tilda sola cuando el ticker ya tiene un fondo habitual.
let fondoCompraTocado=false;
function actualizarFondoDeCompra(porUsuario){
  const grupo=document.getElementById("inv-fondo-compra-group"); if(!grupo) return;
  const chk=document.getElementById("inv-fondo-compra"), sel=document.getElementById("inv-fondo-compra-sel"), selG=document.getElementById("inv-fondo-compra-sel-group");
  const sub=document.getElementById("inv-subcat"), esVenta=sub && (esOperacionDeVenta(sub.value) || /rescate|venta|amortiz|cup[oó]n|dividendo|rendimiento|tomada/i.test(sub.value||""));
  const moneda=(document.getElementById("inv-moneda")||{}).value==="USD" ? "USD" : "ARS";
  const fondos=esVenta ? [] : fondosParaCompra(movs, moneda);
  grupo.style.display=fondos.length ? "" : "none";
  if(!fondos.length){ if(chk) chk.checked=false; if(selG) selG.style.display="none"; return; }
  if(porUsuario) fondoCompraTocado=true;
  const ticker=(document.getElementById("inv-ticker")||{}).value||"";
  const habitual=fondoHabitualDelTicker(movs, ticker, moneda);
  if(!fondoCompraTocado && chk) chk.checked=!!habitual;
  const previo=sel ? sel.value : "";
  if(sel){
    sel.innerHTML=fondos.map(f=>`<option value="${escapeHtml(fondoKey(f))}">${escapeHtml(f.cat+(f.sub?" › "+f.sub:""))}</option>`).join("");
    const elegido=(habitual && fondos.find(f=>fondoKey(f)===fondoKey(habitual))) || fondos.find(f=>fondoKey(f)===previo) || fondos[0];
    if(elegido) sel.value=fondoKey(elegido);
  }
  if(selG) selG.style.display=chk && chk.checked ? "" : "none";
  const subEl=document.getElementById("inv-fondo-compra-sub");
  if(subEl) subEl.textContent=habitual && chk && chk.checked ? `${tickerClave(ticker)} va a ${habitual.cat}${habitual.sub?" › "+habitual.sub:""}: se suma solo` : "Suma al fondo la misma plata: un solo registro";
}
function fondoDeCompraEnFormulario(){
  const chk=document.getElementById("inv-fondo-compra"), sel=document.getElementById("inv-fondo-compra-sel");
  const grupo=document.getElementById("inv-fondo-compra-group");
  if(!chk || !chk.checked || !sel || !sel.value || (grupo && grupo.style.display==="none")) return null;
  const moneda=(document.getElementById("inv-moneda")||{}).value==="USD" ? "USD" : "ARS";
  return fondosParaCompra(movs, moneda).find(f=>fondoKey(f)===sel.value) || null;
}
// ── Editor de una compra: la misma casilla ──
function bloqueFondoCompraEditor(m){
  if(!m || m.tipo!=="Inversion" || isInvSalida(m)) return "";
  const usd=!!(m.importeUSD>0 && !(m.importe>0));
  const fondos=fondosParaCompra(movs, usd?"USD":"ARS");
  const dep=movs.find(x=>x.origenInvId===m.id && esDepositoAhorro(x));
  if(dep && !fondos.some(f=>f.cat===dep.cat && f.sub===(dep.subcat||""))) fondos.push({cat:dep.cat, sub:dep.subcat||"", n:0});
  if(!fondos.length) return "";
  const elegido=(dep && fondos.find(f=>f.cat===dep.cat && f.sub===(dep.subcat||""))) || fondoHabitualDelTicker(movs, m.ticker, usd?"USD":"ARS") || fondos[0];
  // Una compra vieja que ya tiene su depósito cargado aparte: la casilla lo VINCULA (no crea otro, que sería contarlo dos veces).
  const suelto=dep ? null : depositoSueltoDeCompra(m);
  if(suelto) return `<div class="form-group" id="edit-inv-fondo-compra-wrap">
      <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;padding:10px 12px;background:var(--save-light);border-radius:var(--radius-sm)">
        <input type="checkbox" id="edit-inv-fondo-compra" class="chk-custom" style="--chk:var(--save)" data-vincular="${suelto.id}">
        <span style="color:var(--save);font-weight:500">🔗 Vincular con su depósito del ${String(suelto.fecha||"").split("-").reverse().join("/")} en ${escapeHtml(suelto.cat+(suelto.subcat?" › "+suelto.subcat:""))} (${fmtS(suelto.importe)})</span>
      </label>
      <p class="txt-xs txt-muted" style="margin:6px 0 0">Vinculado, el depósito toma el monto, la fecha y la cantidad de esta compra, y se borra con ella.</p>
    </div>`;
  return `<div class="form-group" id="edit-inv-fondo-compra-wrap">
      <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;padding:10px 12px;background:var(--save-light);border-radius:var(--radius-sm)">
        <input type="checkbox" id="edit-inv-fondo-compra" class="chk-custom" style="--chk:var(--save)" ${dep?"checked":""} onchange="document.getElementById('edit-inv-fondo-compra-sel-wrap').style.display=this.checked?'':'none'">
        <span style="color:var(--save);font-weight:500">🏦 Es de mi fondo de ahorro (suma al fondo)</span>
      </label>
      <div id="edit-inv-fondo-compra-sel-wrap" style="margin-top:8px;display:${dep?"":"none"}">
        <label class="form-label" for="edit-inv-fondo-compra-sel">¿A qué fondo?</label>
        <select id="edit-inv-fondo-compra-sel" class="form-select">${fondos.map(f=>`<option value="${escapeHtml(fondoKey(f))}"${elegido && fondoKey(f)===fondoKey(elegido)?" selected":""}>${escapeHtml(f.cat+(f.sub?" › "+f.sub:""))}</option>`).join("")}</select>
      </div>
      ${dep?`<p class="txt-xs txt-muted" style="margin:6px 0 0">El depósito al fondo se actualiza solo con el monto, la fecha y la cantidad de esta compra.</p>`:""}
    </div>`;
}
// Al guardar el editor de una compra: crea, cambia o saca el depósito ligado según la casilla. El monto y la fecha los pone sincronizarRetiroLigado().
// El depósito al fondo que acompaña a una compra pero no está vinculado (cargado aparte), o null.
function depositoSueltoDeCompra(m){
  const par=emparejarFondoInversion(movs).pares.find(p=>p.inv.id===m.id && !p.ligado && !p.f.venta);
  return par ? par.f.m : null;
}
function aplicarFondoCompraEditor(m){
  const chk=document.querySelector("#edit-inv-fondo-compra");
  if(!chk || isInvSalida(m)) return;
  if(chk.dataset.vincular){
    const d=movs.find(x=>String(x.id)===chk.dataset.vincular);
    if(chk.checked && d){ d.origenInvId=m.id; if(m.ticker) d.ticker=String(m.ticker).trim().toUpperCase(); }
    return;
  }
  const dep=movs.find(x=>x.origenInvId===m.id && esDepositoAhorro(x));
  if(chk.checked){
    const sel=document.querySelector("#edit-inv-fondo-compra-sel");
    const usd=!!(m.importeUSD>0 && !(m.importe>0));
    const fondos=fondosParaCompra(movs, usd?"USD":"ARS");
    if(dep && !fondos.some(f=>f.cat===dep.cat && f.sub===(dep.subcat||""))) fondos.push({cat:dep.cat, sub:dep.subcat||""});
    const f=fondos.find(x=>sel && fondoKey(x)===sel.value); if(!f) return;
    if(dep){ dep.cat=f.cat; dep.subcat=f.sub; }
    else{ let id=Date.now()+1; while(movs.some(x=>x.id===id)) id++; movs.unshift(crearDepositoPorCompra(m, f, id)); }
  } else if(dep){
    movs=movs.filter(x=>x!==dep);
  }
}
