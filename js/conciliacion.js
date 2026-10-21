// ═══════════════════════════════════════════
// CONCILIAR CON EL BROKER (versión de prueba: solo muestra diferencias, no cambia nada)
// ═══════════════════════════════════════════
// Cada compra o venta de CEDEARs vive en dos lugares: la inversión que viene de Balanz (monto exacto, con su
// referencia) y el movimiento que cargaste al fondo de ahorro (un depósito por cada compra, un retiro por cada
// venta). Esta pantalla los empareja y muestra lo que no cuadra:
//   · monto o fecha distintos entre el broker y tu fondo;
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

// Empareja los CEDEARs de `lista` con el fondo. Función pura: no toca nada.
// Devuelve {ok, diferencias, faltanEnFondo, sobranEnFondo, duplicados, anteriores, primera}; cada elemento dice de qué lado
// es ("compra" o "venta") y trae los movimientos originales.
function conciliarCedears(lista){
  const todas=(lista||[]).filter(esInvCedear).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
  const fondos=(lista||[]).filter(esFondoCedear);
  const out={ok:[], diferencias:[], faltanEnFondo:[], sobranEnFondo:[], duplicados:[], anteriores:[], primera:todas.length?String(todas[0].fecha).slice(0,10):null};

  // 1. Inversiones repetidas: se queda la que viene de Balanz (tiene refBalanz) o, si no, la primera.
  const dup=new Set();
  for(let i=0;i<todas.length;i++) for(let j=i+1;j<todas.length;j++){
    const a=todas[i], b=todas[j];
    if(dup.has(a)||dup.has(b) || esVentaCedear(a)!==esVentaCedear(b)) continue;
    if(a.ticker && b.ticker && a.ticker!==b.ticker) continue;
    if(Math.abs(difDias(a.fecha,b.fecha))>CONCIL_DUP_DIAS) continue;
    if(Math.abs(a.importe-b.importe)/Math.max(a.importe,b.importe)>CONCIL_DUP_REL) continue;
    const conservar=(!a.refBalanz && b.refBalanz) ? b : a;
    const repetida=conservar===a ? b : a;
    dup.add(repetida);
    out.duplicados.push({lado:esVentaCedear(a)?"venta":"compra", conservar, repetida});
  }
  const invs=todas.filter(m=>!dup.has(m));

  // 2. Por cada lado, los mejores pares primero (menos diferencia de monto, luego de fecha).
  ["compra","venta"].forEach(lado=>{
    const esVenta=lado==="venta";
    const I=invs.filter(m=>esVentaCedear(m)===esVenta);
    const F=fondos.filter(m=>!!m.usaAhorro===esVenta);
    const cand=[];
    I.forEach((a,i)=>F.forEach((b,j)=>{
      const dd=Math.abs(difDias(a.fecha,b.fecha)), da=Math.abs(a.importe-b.importe);
      if(dd<=CONCIL_DIAS && da/Math.max(a.importe,1)<=CONCIL_REL) cand.push({i,j,dd,da});
    }));
    cand.sort((x,y)=>x.da-y.da || x.dd-y.dd);
    const usadaI=new Set(), usadaF=new Set();
    cand.forEach(c=>{
      if(usadaI.has(c.i)||usadaF.has(c.j)) return;
      usadaI.add(c.i); usadaF.add(c.j);
      const inv=I[c.i], fondo=F[c.j];
      const dMonto=r2c(fondo.importe-inv.importe), dDias=difDias(inv.fecha, fondo.fecha);
      if(Math.abs(dMonto)<0.005 && dDias===0) out.ok.push({lado, inv, fondo});
      else out.diferencias.push({lado, inv, fondo, dMonto, dDias,
        tipo: Math.abs(dMonto)>=0.005 && dDias!==0 ? "monto y fecha" : (dDias!==0 ? "fecha" : "monto")});
    });
    I.forEach((inv,i)=>{ if(!usadaI.has(i)) out.faltanEnFondo.push({lado, inv}); });
    F.forEach((fondo,j)=>{
      if(usadaF.has(j)) return;
      if(out.primera && String(fondo.fecha).slice(0,10)<out.primera) out.anteriores.push({lado, fondo});
      else out.sobranEnFondo.push({lado, fondo});
    });
  });
  const porFecha=(x,y)=>String((x.inv||x.fondo||x.repetida).fecha).localeCompare(String((y.inv||y.fondo||y.repetida).fecha));
  ["ok","diferencias","faltanEnFondo","sobranEnFondo","duplicados","anteriores"].forEach(k=>out[k].sort(porFecha));
  return out;
}

// Cuánto cambiaría el saldo del fondo si se corrigiera todo para que coincida con el broker (+ sube, − baja).
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
const etiqInv=m=>`${m.ticker?escapeHtml(m.ticker)+" · ":""}${m.refBalanz?"Balanz":"cargada a mano"}`;

function filasConciliacionHTML(c){
  const fila=(top, delta, lineas, color)=>`<div class="concil-fila"><div class="concil-top"><strong>${top}</strong>${delta?`<span class="concil-delta" style="color:${color||"var(--text)"}">${delta}</span>`:""}</div>${lineas.map(l=>`<div class="concil-det">${l}</div>`).join("")}</div>`;
  const sec=(titulo, n, cuerpo, nota)=>n ? `<div class="concil-sec">${titulo} (${n})</div>${nota?`<p class="txt-xs txt-muted" style="margin:0 0 4px">${nota}</p>`:""}${cuerpo}` : "";
  let h="";
  h+=sec("Montos o fechas distintas", c.diferencias.length, c.diferencias.map(d=>fila(
      `${ladoTxt(d.lado)} ${fmtFechaConcil(d.inv.fecha)}`, d.dMonto ? signo$(d.dMonto) : "otra fecha",
      [`Inversión (${etiqInv(d.inv)}): ${fmtS(d.inv.importe)} · ${fmtFechaConcil(d.inv.fecha)}`,
       `Tu fondo: ${fmtS(d.fondo.importe)} · ${fmtFechaConcil(d.fondo.fecha)}${d.dDias?` (${d.dDias>0?"+":"−"}${Math.abs(d.dDias)} día${Math.abs(d.dDias)===1?"":"s"})`:""}`],
      "var(--warning)")).join(""),
    "Es el mismo movimiento, pero tu fondo tiene otro monto o fecha que la inversión cargada (la de Balanz trae el monto exacto del broker).");
  h+=sec("Faltan en tu fondo", c.faltanEnFondo.length, c.faltanEnFondo.map(f=>fila(
      `${ladoTxt(f.lado)} ${fmtFechaConcil(f.inv.fecha)}`, fmtS(f.inv.importe),
      [`Está en tus inversiones (${etiqInv(f.inv)}) pero no hay ${f.lado==="venta"?"retiro":"depósito"} en tu fondo.`], "var(--danger)")).join(""),
    "Si fue cambiar un CEDEAR por otro dentro del broker, esa plata no pasa por tu fondo y está bien así.");
  h+=sec("Sobran en tu fondo", c.sobranEnFondo.length, c.sobranEnFondo.map(f=>fila(
      `${f.lado==="venta"?"Retiro":"Depósito"} ${fmtFechaConcil(f.fondo.fecha)}`, fmtS(f.fondo.importe),
      [`Está en tu fondo pero no hay ${f.lado==="venta"?"una venta":"una compra"} parecida en tus inversiones.${f.fondo.nota?` Nota: ${escapeHtml(f.fondo.nota)}.`:""}`], "var(--danger)")).join(""),
    "Puede ser una inversión que todavía no cargaste (o importaste de Balanz).");
  h+=sec("Posibles duplicados", c.duplicados.length, c.duplicados.map(d=>fila(
      `${ladoTxt(d.lado)} ${fmtFechaConcil(d.conservar.fecha)}`, fmtS(d.repetida.importe),
      [`Se queda: ${etiqInv(d.conservar)} · ${fmtS(d.conservar.importe)} · ${fmtFechaConcil(d.conservar.fecha)}`,
       `Parece repetida: ${etiqInv(d.repetida)} · ${fmtS(d.repetida.importe)} · ${fmtFechaConcil(d.repetida.fecha)}`], "var(--warning)")).join(""),
    "Dos inversiones casi iguales: probablemente es la misma cargada dos veces.");
  if(c.ok.length) h+=`<details class="concil-plegable"><summary>✓ Coinciden con el broker (${c.ok.length})</summary>${c.ok.map(o=>fila(
      `${ladoTxt(o.lado)} ${fmtFechaConcil(o.inv.fecha)}`, fmtS(o.inv.importe), [`${etiqInv(o.inv)}`], "var(--save)")).join("")}</details>`;
  if(c.anteriores.length) h+=`<details class="concil-plegable"><summary>Anteriores a tu primera inversión cargada (${c.anteriores.length})</summary>
    <p class="txt-xs txt-muted" style="margin:6px 0 0">Tu primera inversión de Balanz es del ${fmtFechaConcil(c.primera)}. De antes solo hay movimientos del fondo, así que no hay con qué compararlos.</p>${c.anteriores.map(a=>fila(
      `${a.lado==="venta"?"Retiro":"Depósito"} ${fmtFechaConcil(a.fondo.fecha)}`, fmtS(a.fondo.importe), [], "var(--muted)")).join("")}</details>`;
  return h;
}

function conciliacionHTML(c){
  const r=resumenConciliacion(c);
  const cab=`<div class="concil-aviso">🧪 <strong>Versión de prueba.</strong> Solo muestra las diferencias; no cambia ninguno de tus movimientos.</div>`;
  if(!r.hayDatos) return cab+`<p class="txt-sm txt-muted" style="margin-top:12px">No encontré inversiones de CEDEARs para comparar con tu fondo.</p>`;
  const resumen=r.pendientes
    ? `<p class="txt-sm" style="margin:12px 0 4px"><strong>${r.pendientes} diferencia${r.pendientes===1?"":"s"}</strong> entre tu fondo y tus inversiones, y ${r.coinciden} que coinciden.</p>
       <p class="txt-sm txt-muted" style="margin:0 0 6px">Si todo se corrigiera para coincidir con tus inversiones, el saldo de tu fondo ${r.ajuste===0?"quedaría igual":`${r.ajuste>0?"subiría":"bajaría"} ${fmtS(Math.abs(r.ajuste))}`}.</p>`
    : `<p class="txt-sm" style="margin:12px 0"><strong>✓ Todo coincide con el broker</strong> (${r.coinciden} operaciones).</p>`;
  return cab+resumen+filasConciliacionHTML(c);
}

function abrirConciliacion(){
  const el=document.getElementById("concil-detalle");
  if(!el) return;
  el.innerHTML=conciliacionHTML(conciliarCedears(movs));
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
