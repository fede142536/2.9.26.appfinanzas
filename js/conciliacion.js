// ═══════════════════════════════════════════
// CONCILIAR CON EL BROKER (versión de prueba: solo muestra diferencias, no cambia nada)
// ═══════════════════════════════════════════
// Cada compra o venta de CEDEARs vive en dos lugares: la inversión (la que viene de Balanz trae el monto exacto
// y su referencia) y el movimiento que cargaste al fondo de ahorro (un depósito por cada compra, un retiro por
// cada venta). Esta pantalla los empareja y muestra lo que no cuadra.
//
// Cada movimiento dice a QUÉ CEDEAR pertenece y cuántos son: la inversión en su `ticker`, el del fondo en su nota
// ("Spy x 4", "MCD X 3"). Eso se usa para emparejar: una compra de MCD nunca se empareja con un depósito de SPY, y si
// los dos dicen cuántos son y no coinciden, se marca. Sin ticker en la nota (algunos depósitos viejos no la tienen)
// se empareja por monto y fecha, y se dice que no tiene descripción.
//
//   · monto, fecha o cantidad distintos entre la inversión y tu fondo;
//   · inversiones que no están en tu fondo, y movimientos del fondo que no tienen su inversión;
//   · inversiones duplicadas (la importada de Balanz y una cargada a mano casi igual).
// Lo del fondo que es ANTERIOR a tu primera inversión cargada no se compara: de esa época solo hay fondo.
// Todo es de lectura. Si la prueba te sirve, el paso siguiente es un botón "corregir" en cada diferencia.

const CONCIL_FONDO={cat:"Fondo de Retiro", subcat:"Cedears"};   // el ahorro que representa los CEDEARs
const CONCIL_DIAS=7;          // un depósito se empareja con una compra si hay hasta 7 días de diferencia…
const CONCIL_REL=0.03;        // …y hasta un 3% de diferencia en el monto
const CONCIL_DUP_DIAS=3;      // dos inversiones del mismo lado con hasta 3 días…
const CONCIL_DUP_REL=0.005;   // …y hasta 0,5% de diferencia son la misma, cargada dos veces

const esInvCedear=m=>!!m && m.tipo==="Inversion" && m.cat==="CEDEARs" && /Compra|Venta/.test(m.subcat||"") && (m.importe||0)>0;
const esVentaCedear=m=>/Venta/.test(m.subcat||"");
const esFondoCedear=m=>!!m && m.tipo==="Gasto" && m.moneda!=="USD" && (!!m.esAhorro || !!m.usaAhorro)
  && m.cat===CONCIL_FONDO.cat && m.subcat===CONCIL_FONDO.subcat && (m.importe||0)>0;

const r2c=x=>Math.round(x*100)/100;
const difDias=(a,b)=>diasEntre(String(a).slice(0,10), String(b).slice(0,10));   // b − a, en días

// "Spy x 28", "MCD X 3", "SPY x 12 para este mes" → {ticker:"SPY", cantidad:28}. Si la nota no empieza así, busca
// alguno de los tickers conocidos como palabra suelta ("compra de spy"). Sin nada de eso: {ticker:null, cantidad:null}.
function leerTickerYCantidad(nota, conocidos){
  const t=String(nota||"");
  const m=/^\s*([A-Za-z]{1,6})\s*[xX×]\s*(\d+(?:[.,]\d+)?)/.exec(t);
  if(m) return {ticker:m[1].toUpperCase(), cantidad:Number(m[2].replace(",","."))};
  for(const k of (conocidos||[])){
    if(k && new RegExp(`(^|[^A-Za-z])${k}([^A-Za-z]|$)`,"i").test(t)) return {ticker:String(k).toUpperCase(), cantidad:null};
  }
  return {ticker:null, cantidad:null};
}

// Empareja los CEDEARs de `lista` con el fondo. Función pura: no toca nada.
// Devuelve {ok, diferencias, faltanEnFondo, sobranEnFondo, duplicados, anteriores, primera, tickers}. Cada elemento trae
// su `lado` ("compra" o "venta"), su `ticker` (o null) y los movimientos originales.
function conciliarCedears(lista){
  const todas=(lista||[]).filter(esInvCedear).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
  const fondos=(lista||[]).filter(esFondoCedear);
  const conocidos=[...new Set(todas.map(m=>m.ticker).filter(Boolean).map(t=>String(t).toUpperCase()))];
  const infoInv=new Map(), infoFondo=new Map();
  todas.forEach(m=>{
    const n=leerTickerYCantidad(m.nota, conocidos);
    infoInv.set(m, {ticker:(m.ticker?String(m.ticker).toUpperCase():null)||n.ticker, cantidad:Number.isFinite(Number(m.cantidad))&&m.cantidad ? Number(m.cantidad) : n.cantidad});
  });
  fondos.forEach(m=>infoFondo.set(m, leerTickerYCantidad(m.nota, conocidos)));

  const out={ok:[], diferencias:[], faltanEnFondo:[], sobranEnFondo:[], duplicados:[], anteriores:[],
             primera:todas.length?String(todas[0].fecha).slice(0,10):null, tickers:[]};

  // 1. Inversiones repetidas: se queda la que viene de Balanz (tiene refBalanz) o, si no, la primera.
  const dup=new Set();
  for(let i=0;i<todas.length;i++) for(let j=i+1;j<todas.length;j++){
    const a=todas[i], b=todas[j];
    if(dup.has(a)||dup.has(b) || esVentaCedear(a)!==esVentaCedear(b)) continue;
    const ta=infoInv.get(a).ticker, tb=infoInv.get(b).ticker;
    if(ta && tb && ta!==tb) continue;
    if(Math.abs(difDias(a.fecha,b.fecha))>CONCIL_DUP_DIAS) continue;
    if(Math.abs(a.importe-b.importe)/Math.max(a.importe,b.importe)>CONCIL_DUP_REL) continue;
    const conservar=(!a.refBalanz && b.refBalanz) ? b : a;
    const repetida=conservar===a ? b : a;
    dup.add(repetida);
    out.duplicados.push({lado:esVentaCedear(a)?"venta":"compra", ticker:infoInv.get(conservar).ticker, conservar, repetida});
  }
  const invs=todas.filter(m=>!dup.has(m));

  // 2. Por cada lado, los mejores pares primero (menos diferencia de monto, luego de fecha). Un par solo vale si
  //    el CEDEAR no se contradice: si los dos dicen cuál es y son distintos, no son el mismo movimiento.
  ["compra","venta"].forEach(lado=>{
    const esVenta=lado==="venta";
    const I=invs.filter(m=>esVentaCedear(m)===esVenta);
    const F=fondos.filter(m=>!!m.usaAhorro===esVenta);
    const cand=[];
    I.forEach((a,i)=>F.forEach((b,j)=>{
      const ta=infoInv.get(a).ticker, tb=infoFondo.get(b).ticker;
      if(ta && tb && ta!==tb) return;
      const dd=Math.abs(difDias(a.fecha,b.fecha)), da=Math.abs(a.importe-b.importe);
      if(dd<=CONCIL_DIAS && da/Math.max(a.importe,1)<=CONCIL_REL) cand.push({i,j,dd,da});
    }));
    cand.sort((x,y)=>x.da-y.da || x.dd-y.dd);
    const usadaI=new Set(), usadaF=new Set();
    cand.forEach(c=>{
      if(usadaI.has(c.i)||usadaF.has(c.j)) return;
      usadaI.add(c.i); usadaF.add(c.j);
      const inv=I[c.i], fondo=F[c.j];
      const ci=infoInv.get(inv).cantidad, cf=infoFondo.get(fondo).cantidad;
      const dMonto=r2c(fondo.importe-inv.importe), dDias=difDias(inv.fecha, fondo.fecha);
      const dCant=(ci!=null && cf!=null) ? cf-ci : 0;
      const par={lado, ticker:infoInv.get(inv).ticker, inv, fondo, cantInv:ci, cantFondo:cf, dMonto, dDias, dCant};
      const partes=[]; if(Math.abs(dMonto)>=0.005) partes.push("monto"); if(dDias!==0) partes.push("fecha"); if(dCant!==0) partes.push("cantidad");
      if(!partes.length) out.ok.push(par); else out.diferencias.push({...par, tipo:partes.join(" y ")});
    });
    I.forEach((inv,i)=>{ if(!usadaI.has(i)) out.faltanEnFondo.push({lado, ticker:infoInv.get(inv).ticker, inv}); });
    F.forEach((fondo,j)=>{
      if(usadaF.has(j)) return;
      const it={lado, ticker:infoFondo.get(fondo).ticker, fondo};
      if(out.primera && String(fondo.fecha).slice(0,10)<out.primera) out.anteriores.push(it); else out.sobranEnFondo.push(it);
    });
  });
  const porFecha=(x,y)=>String((x.inv||x.fondo||x.repetida).fecha).localeCompare(String((y.inv||y.fondo||y.repetida).fecha));
  const claves=["ok","diferencias","faltanEnFondo","sobranEnFondo","duplicados","anteriores"];
  claves.forEach(k=>out[k].sort(porFecha));
  out.tickers=[...new Set(claves.flatMap(k=>out[k]).map(x=>x.ticker).filter(Boolean))].sort();
  return out;
}

// Solo lo de un CEDEAR ("SPY"), o solo lo que no dice cuál es ("—"). Sin filtro devuelve todo.
function filtrarConciliacion(c, ticker){
  if(!ticker) return c;
  const sirve=x=>ticker==="—" ? !x.ticker : x.ticker===ticker;
  const out={...c};
  ["ok","diferencias","faltanEnFondo","sobranEnFondo","duplicados","anteriores"].forEach(k=>{ out[k]=c[k].filter(sirve); });
  return out;
}

// Cuánto cambiaría el saldo del fondo si se corrigiera todo para que coincida con las inversiones (+ sube, − baja).
function ajusteSaldoConciliacion(c){
  let s=0;
  c.diferencias.forEach(d=>{ const dif=d.inv.importe-d.fondo.importe; s+= d.lado==="venta" ? -dif : dif; });
  c.faltanEnFondo.forEach(f=>{ s+= f.lado==="venta" ? -f.inv.importe : f.inv.importe; });
  c.sobranEnFondo.forEach(f=>{ s+= f.lado==="venta" ? f.fondo.importe : -f.fondo.importe; });
  return r2c(s);
}
function resumenConciliacion(c){
  const pend=c.diferencias.length+c.faltanEnFondo.length+c.sobranEnFondo.length+c.duplicados.length;
  return {pendientes:pend, coinciden:c.ok.length, anteriores:c.anteriores.length, ajuste:ajusteSaldoConciliacion(c),
          hayDatos:c.ok.length+pend>0};
}

// ── Pantalla ──
const fmtFechaConcil=iso=>`${fmtDiaMes(iso)} ${String(iso).slice(0,4)}`;
const ladoTxt=l=>l==="venta" ? "Venta" : "Compra";
const signo$=x=>`${x>0?"+":x<0?"−":""}${fmtS(Math.abs(x))}`;
const chipTicker=t=>t ? `<span class="concil-tick">${escapeHtml(t)}</span>` : `<span class="concil-tick concil-tick-vacio">¿cuál?</span>`;
const unidades=n=>n==null ? "" : ` · ${n} ${n===1?"unidad":"unidades"}`;
// "“Spy x 4”" o "sin descripción": lo que dice el movimiento sobre sí mismo.
const descConcil=m=>m.nota ? `“${escapeHtml(m.nota)}”` : "sin descripción";
const origenInv=m=>m.refBalanz ? "Balanz" : "cargada a mano";

function filasConciliacionHTML(c){
  const fila=(top, delta, lineas, color)=>`<div class="concil-fila"><div class="concil-top"><span>${top}</span>${delta?`<span class="concil-delta" style="color:${color||"var(--text)"}">${delta}</span>`:""}</div>${lineas.map(l=>`<div class="concil-det">${l}</div>`).join("")}</div>`;
  const sec=(titulo, n, cuerpo, nota)=>n ? `<div class="concil-sec">${titulo} (${n})</div>${nota?`<p class="txt-xs txt-muted" style="margin:0 0 4px">${nota}</p>`:""}${cuerpo}` : "";
  const titulo=(x,fecha,lado)=>`${chipTicker(x.ticker)} <strong>${lado} ${fmtFechaConcil(fecha)}</strong>`;
  const lineaInv=(m,ci)=>`Inversión (${origenInv(m)}): ${fmtS(m.importe)} · ${fmtFechaConcil(m.fecha)}${unidades(ci)}${m.nota?` · ${descConcil(m)}`:""}`;
  const lineaFondo=(m,cf,dDias)=>`Tu fondo: ${fmtS(m.importe)} · ${fmtFechaConcil(m.fecha)}${dDias?` (${dDias>0?"+":"−"}${Math.abs(dDias)} día${Math.abs(dDias)===1?"":"s"})`:""}${unidades(cf)} · ${descConcil(m)}`;
  let h="";
  h+=sec("Montos, fechas o cantidades distintas", c.diferencias.length, c.diferencias.map(d=>fila(
      titulo(d, d.inv.fecha, ladoTxt(d.lado)), d.dMonto ? signo$(d.dMonto) : (d.dDias ? "otra fecha" : "otra cantidad"),
      [lineaInv(d.inv,d.cantInv), lineaFondo(d.fondo,d.cantFondo,d.dDias)],
      "var(--warning)")).join(""),
    "Es el mismo movimiento (mismo CEDEAR), pero tu fondo tiene otro monto, fecha o cantidad que la inversión cargada (la de Balanz trae el monto exacto del broker).");
  h+=sec("Faltan en tu fondo", c.faltanEnFondo.length, c.faltanEnFondo.map(f=>fila(
      titulo(f, f.inv.fecha, ladoTxt(f.lado)), fmtS(f.inv.importe),
      [`${lineaInv(f.inv,null)}`, `No hay ${f.lado==="venta"?"un retiro":"un depósito"} de ${f.ticker||"este CEDEAR"} en tu fondo.`], "var(--danger)")).join(""),
    "Si fue cambiar un CEDEAR por otro dentro del broker, esa plata no pasa por tu fondo y está bien así.");
  h+=sec("Sobran en tu fondo", c.sobranEnFondo.length, c.sobranEnFondo.map(f=>fila(
      titulo(f, f.fondo.fecha, f.lado==="venta"?"Retiro":"Depósito"), fmtS(f.fondo.importe),
      [lineaFondo(f.fondo,null,0), `No hay ${f.lado==="venta"?"una venta":"una compra"}${f.ticker?" de "+escapeHtml(f.ticker):""} parecida en tus inversiones.`], "var(--danger)")).join(""),
    "Puede ser una inversión que todavía no cargaste (o importaste de Balanz).");
  h+=sec("Posibles duplicados", c.duplicados.length, c.duplicados.map(d=>fila(
      titulo(d, d.conservar.fecha, ladoTxt(d.lado)), fmtS(d.repetida.importe),
      [`Se queda: ${origenInv(d.conservar)} · ${fmtS(d.conservar.importe)} · ${fmtFechaConcil(d.conservar.fecha)}`,
       `Parece repetida: ${origenInv(d.repetida)} · ${fmtS(d.repetida.importe)} · ${fmtFechaConcil(d.repetida.fecha)}${d.repetida.nota?` · ${descConcil(d.repetida)}`:""}`], "var(--warning)")).join(""),
    "Dos inversiones casi iguales del mismo CEDEAR: probablemente es la misma cargada dos veces.");
  if(c.ok.length) h+=`<details class="concil-plegable"><summary>✓ Coinciden (${c.ok.length})</summary>${c.ok.map(o=>fila(
      titulo(o, o.inv.fecha, ladoTxt(o.lado)), fmtS(o.inv.importe),
      [`Inversión (${origenInv(o.inv)}) = tu fondo: ${descConcil(o.fondo)}${unidades(o.cantFondo)}`], "var(--save)")).join("")}</details>`;
  if(c.anteriores.length) h+=`<details class="concil-plegable"><summary>Anteriores a tu primera inversión cargada (${c.anteriores.length})</summary>
    <p class="txt-xs txt-muted" style="margin:6px 0 0">Tu primera inversión cargada es del ${fmtFechaConcil(c.primera)}. De antes solo hay movimientos del fondo, así que no hay con qué compararlos.</p>${c.anteriores.map(a=>fila(
      titulo(a, a.fondo.fecha, a.lado==="venta"?"Retiro":"Depósito"), fmtS(a.fondo.importe), [descConcil(a.fondo)], "var(--muted)")).join("")}</details>`;
  return h;
}

let concilFiltro="";
// Los botones para ver un solo CEDEAR: Todos · SPY · MCD · XLK (· ¿cuál? si hay movimientos sin descripción).
function chipsConciliacionHTML(c){
  const hayVacios=["ok","diferencias","faltanEnFondo","sobranEnFondo","duplicados","anteriores"].some(k=>c[k].some(x=>!x.ticker));
  const opciones=[["","Todos"], ...c.tickers.map(t=>[t,t]), ...(hayVacios?[["—","Sin descripción"]]:[])];
  return `<div class="concil-chips">${opciones.map(([v,txt])=>`<button type="button" class="concil-chip${concilFiltro===v?" activo":""}" onclick="setFiltroConcil(${attrJS(v)})">${escapeHtml(txt)}</button>`).join("")}</div>`;
}

function conciliacionHTML(c, filtro){
  const cab=`<div class="concil-aviso">🧪 <strong>Versión de prueba.</strong> Solo muestra las diferencias; no cambia ninguno de tus movimientos.</div>`;
  const total=resumenConciliacion(c);
  if(!total.hayDatos) return cab+`<p class="txt-sm txt-muted" style="margin-top:12px">No encontré inversiones de CEDEARs para comparar con tu fondo.</p>`;
  const vista=filtrarConciliacion(c, filtro||"");
  const r=resumenConciliacion(vista);
  const que=filtro ? (filtro==="—" ? "los movimientos sin descripción" : filtro) : "tus CEDEARs";
  const resumen=r.pendientes
    ? `<p class="txt-sm" style="margin:12px 0 4px"><strong>${r.pendientes} diferencia${r.pendientes===1?"":"s"}</strong> entre tu fondo y tus inversiones (${escapeHtml(que)}), y ${r.coinciden} que coinciden.</p>
       <p class="txt-sm txt-muted" style="margin:0 0 6px">Si todo se corrigiera para coincidir con tus inversiones, el saldo de tu fondo ${r.ajuste===0?"quedaría igual":`${r.ajuste>0?"subiría":"bajaría"} ${fmtS(Math.abs(r.ajuste))}`}.</p>`
    : `<p class="txt-sm" style="margin:12px 0"><strong>✓ Todo coincide con el broker</strong> (${r.coinciden} operaciones${filtro?` de ${escapeHtml(que)}`:""}).</p>`;
  return cab+chipsConciliacionHTML(c)+resumen+filasConciliacionHTML(vista);
}

function renderConciliacionDetalle(){
  const el=document.getElementById("concil-detalle");
  if(el) el.innerHTML=conciliacionHTML(conciliarCedears(movs), concilFiltro);
}
function setFiltroConcil(t){ concilFiltro=t||""; renderConciliacionDetalle(); }
function abrirConciliacion(){
  if(!document.getElementById("concil-detalle")) return;
  concilFiltro="";
  renderConciliacionDetalle();
  document.getElementById("modal-concil").classList.add("open");
}
function cerrarConciliacion(){
  const m=document.getElementById("modal-concil");
  if(m) m.classList.remove("open");
}

// La tarjeta de Ahorros: una línea con el estado y el botón para ver el detalle. Sin CEDEARs no se muestra.
function renderConciliacionCard(){
  const card=document.getElementById("concil-card");
  if(!card) return;
  const r=resumenConciliacion(conciliarCedears(movs));
  card.style.display=r.hayDatos ? "" : "none";
  const el=document.getElementById("concil-resumen");
  if(!el) return;
  el.innerHTML=r.pendientes
    ? `<strong style="color:var(--warning)">${r.pendientes} diferencia${r.pendientes===1?"":"s"}</strong> entre tu fondo y tus inversiones · ${r.coinciden} coinciden`
    : `<strong style="color:var(--save)">✓ Tu fondo coincide con el broker</strong> · ${r.coinciden} operaciones`;
}
