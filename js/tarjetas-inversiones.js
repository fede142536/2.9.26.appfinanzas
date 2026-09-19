// ═══════════════════════════════════════════
// HELPERS DE CUOTAS / TARJETAS
// ═══════════════════════════════════════════
// Suma `n` meses a un "YYYY-MM" y devuelve el "YYYY-MM" resultante
// (currentYM/currentYMD se movieron a js/estado-categorias.js: el estado global
// necesita llamarlas antes de que este archivo llegue a cargar)

// Suma n meses a "YYYY-MM" usando aritmética pura (sin Date, evita bug de zona horaria).
// new Date().toISOString() puede saltarse un mes en Argentina (UTC-3) porque al
// crear Date(y, m, 1) a las 00:00 local y convertir a UTC retrocede a 21:00 del mes anterior.
function addMonths(ym, n){
  if(!ym || ym.length<7) return "";
  let [y,m] = ym.split("-").map(Number);
  m += n;
  // Normalizar a rango 1-12
  while(m > 12){ m -= 12; y++; }
  while(m < 1){ m += 12; y--; }
  return y + "-" + String(m).padStart(2, "0");
}
// Devuelve el número de cuota (1..N) que cae en el mes ym, o 0 si está fuera de rango.
// Para gastos frecuentes: devuelve el número de mes desde el inicio (1, 2, 3...).
function getCuotaEnMes(tc, ym){
  if(!tc.mesInicio || !ym) return 0;
  const [iY,iM] = tc.mesInicio.split("-").map(Number);
  const [tY,tM] = ym.split("-").map(Number);
  const diff = (tY-iY)*12 + (tM-iM);
  if(diff<0) return 0;
  if(tc.frecuente){
    // Frecuente: respetar mesFin si está definido
    if(tc.mesFin && ym>tc.mesFin) return 0;
    return diff+1;
  }
  if(diff>=tc.cuotasTotal) return 0;
  return diff+1;
}

// Devuelve el monto vigente para un gasto en un mes dado.
// Para cuotas: total/cuotasTotal (siempre la misma).
// Para frecuentes: aplica el último cambio cuya fecha "desde" sea <= ym, o usa total si no hay cambios.
function getMontoEnMes(tc, ym){
  if(tc.frecuente){
    let monto=tc.total; // monto base
    if(Array.isArray(tc.cambios)){
      // Buscar el cambio aplicable más reciente
      const aplicables=tc.cambios.filter(c=>c.desde<=ym).sort((a,b)=>a.desde.localeCompare(b.desde));
      if(aplicables.length) monto=aplicables[aplicables.length-1].monto;
    }
    return Math.round(monto*100)/100;
  }
  return Math.round((tc.total/tc.cuotasTotal)*100)/100;
}

// Devuelve los "movimientos virtuales" de cuotas / frecuentes que caen en el mes ym
function getTcMovsEnMes(ym){
  return tcs.map(t=>{
    const n = getCuotaEnMes(t, ym);
    if(!n) return null;
    const importeMes=getMontoEnMes(t, ym);
    return {
      _isTc: true,
      id: t.id,
      tipo: "Tarjeta",
      desc: t.desc,
      tarjeta: t.tarjeta,
      cat: t.cat,
      subcat: t.tarjeta,
      moneda: t.moneda||"ARS",
      importe: importeMes,
      importeTotal: t.frecuente?null:t.total,
      cuotasTotal: t.cuotasTotal,
      nCuota: n,
      frecuente: !!t.frecuente,
      fecha: ym+"-01",
      nota: t.nota||""
    };
  }).filter(Boolean);
}

// ═══════════════════════════════════════════
// CUOTAS PENDIENTES POR MES
// ═══════════════════════════════════════════
// Una caja por mes con lo que queda por pagar, desde el mes que estás mirando hacia adelante.
// Al tocar una caja se abre abajo el desglose de las compras que arman ese monto.
// Antes esto era un mini-recuadro fijo de 3 meses dentro de la card de balance, sin desglose.

// Mes cuyo desglose está abierto (null = ninguno). Vive acá y no dentro del render porque
// cada toque vuelve a dibujar la card entera y una variable local se perdería.
let tcMesAbierto=null;

// Hasta dónde proyectar. El horizonte lo marca la última cuota de las compras en cuotas: un
// gasto frecuente sin fecha de fin seguiría para siempre, así que no puede definir el límite
// (sí aparece DENTRO de los meses proyectados, porque también lo vas a pagar).
// El tope de 24 meses es una red por si quedara una compra con un plazo disparatado.
function horizonteCuotas(desde){
  let ultimo=desde;
  tcs.forEach(t=>{
    if(t.frecuente) return;
    const fin=addMonths(t.mesInicio, (t.cuotasTotal||1)-1);
    if(fin>ultimo) ultimo=fin;
  });
  let meses=0, ym=desde;
  while(ym<ultimo && meses<24){ ym=addMonths(ym,1); meses++; }
  return meses;
}

// Devuelve [{ym, movs, totalARS, totalUSD}] de los meses que tienen algo por pagar.
function mesesConCuotasPendientes(desde){
  const out=[];
  const cantidad=horizonteCuotas(desde);
  for(let i=0;i<=cantidad;i++){
    const ym=addMonths(desde,i);
    const movs=getTcMovsEnMes(ym);
    if(!movs.length) continue;
    const enARS=movs.filter(m=>m.moneda!=="USD");
    const enUSD=movs.filter(m=>m.moneda==="USD");
    out.push({
      ym, movs,
      totalARS: enARS.reduce((s,m)=>s+(m.importe||0),0),
      totalUSD: enUSD.reduce((s,m)=>s+(m.importe||0),0),
      // Alguna de las compras de este mes no tiene un monto usable: el total de abajo es una
      // suma parcial, no el total del mes.
      incompleto: movs.some(m=>numeroRoto(m.importe))
    });
  }
  return out;
}

function toggleTcMes(ym){
  tcMesAbierto = (tcMesAbierto===ym) ? null : ym;
  renderTcPendientes();
}

function renderTcPendientes(){
  const el=document.getElementById("tc-pendientes");
  if(!el) return;
  // Arranca en el mes SIGUIENTE al que estás mirando: el mes en curso ya está detallado
  // arriba, en "Balance del mes" (con desglose por tarjeta y los gastos de mayor a menor), y
  // tenerlo también como primera cajita acá lo mostraba dos veces. Así cada mes aparece una
  // sola vez y el encabezado ("N meses por delante") pasa a contar solo lo que falta.
  const desde=addMonths(mesTc,1);
  const meses=mesesConCuotasPendientes(desde);
  if(!meses.length){
    el.innerHTML=`<div class="empty" style="padding:20px"><div class="empty-icon">✓</div>Nada pendiente después de ${escapeHtml(mesLbl(mesTc))}</div>`;
    return;
  }
  // Si el mes que estaba abierto ya no está en la lista (cambiaste de mes), se cierra.
  if(tcMesAbierto && !meses.some(m=>m.ym===tcMesAbierto)) tcMesAbierto=null;

  const totalARS=meses.reduce((s,m)=>s+m.totalARS,0);
  const totalUSD=meses.reduce((s,m)=>s+m.totalUSD,0);
  const algunoIncompleto=meses.some(m=>m.incompleto);

  // Se aclara desde cuándo cuenta el total, para que no parezca que se perdió plata al no
  // incluir el mes en curso.
  let html=`<div class="txt-sm txt-muted mb-10">
    Después de ${escapeHtml(mesLbl(mesTc))} · ${meses.length} ${meses.length===1?"mes":"meses"} ·
    <strong style="color:var(--warning)">${algunoIncompleto ? "—" : fmtTotal(totalARS)}</strong>${totalUSD>0?` + <strong style="color:var(--accent)">USD ${totalUSD.toFixed(2)}</strong>`:""} en total
  </div>${algunoIncompleto?`<div class="txt-micro txt-muted mb-10">Hay una compra sin monto, así que el total no se puede calcular. Está en el aviso del Dashboard.</div>`:""}`;

  html+=`<div class="mes-grid">`+meses.map(m=>`
    <div class="mes-caja${tcMesAbierto===m.ym?" abierta":""}" role="button" tabindex="0"
         aria-expanded="${tcMesAbierto===m.ym}" onclick="toggleTcMes(${attrJS(m.ym)})">
      <div class="mes-caja-label">${escapeHtml(mesLbl(m.ym).replace(" "," ").slice(0,3))} ${m.ym.slice(2,4)}</div>
      <div class="mes-caja-val">${m.incompleto ? "—" : fmtAbbr(m.totalARS)}</div>
      ${m.totalUSD>0?`<div class="mes-caja-usd">USD ${m.totalUSD.toFixed(0)}</div>`:""}
      <div class="mes-caja-n">${m.movs.length} ${m.movs.length===1?"cuota":"cuotas"}</div>
    </div>`).join("")+`</div>`;

  const abierto=meses.find(m=>m.ym===tcMesAbierto);
  if(abierto){
    html+=`<div class="mes-desglose">
      <div class="seccion-label mb-6">${escapeHtml(mesLbl(abierto.ym))}</div>`;
    html+=abierto.movs.slice().sort((a,b)=>b.importe-a.importe).map(m=>{
      const tag=m.frecuente?"🔁 mensual fijo":`cuota ${m.nCuota}/${m.cuotasTotal}`;
      const monto=m.moneda==="USD"?`USD ${(m.importe||0).toFixed(2)}`:fmtS(m.importe||0);
      return `<div class="mes-desglose-fila">
        <div class="u-min0">
          <div class="txt-strong">${escapeHtml(m.desc||"")}</div>
          <div class="txt-micro txt-muted">💳 ${escapeHtml(m.tarjeta||"Sin tarjeta")} · ${tag}</div>
        </div>
        <strong>${monto}</strong>
      </div>`;
    }).join("");
    html+=`<div class="mes-desglose-fila" style="border-top:1px solid var(--border);border-bottom:none">
      <span class="txt-muted">Total del mes</span>
      <strong style="color:var(--warning)">${fmtTotal(abierto.totalARS)}${abierto.totalUSD>0?` + USD ${abierto.totalUSD.toFixed(2)}`:""}</strong>
    </div></div>`;
  } else {
    html+=`<div class="txt-micro txt-muted" style="text-align:center;margin-top:10px">Tocá un mes para ver qué lo compone</div>`;
  }
  el.innerHTML=html;
}

// ═══════════════════════════════════════════
// TARJETAS
// ═══════════════════════════════════════════
function cambiarMesTc(delta){
  mesTc = addMonths(mesTc, delta);
  renderTarjetas();
  animarCambioDeMes(delta, document.getElementById("tc-balance"), document.getElementById("tc-pendientes"));
}

function renderTarjetas(){
  const ymSel = mesTc;
  const hoyYM = currentYM();
  document.getElementById("tc-mes-label").textContent=mesLbl(ymSel);

  // ── BALANCE DEL MES SELECCIONADO ──
  const movsMes = getTcMovsEnMes(ymSel);
  const movsMesARS = movsMes.filter(m=>m.moneda!=="USD");
  const movsMesUSD = movsMes.filter(m=>m.moneda==="USD");
  const totalMesARS = movsMesARS.reduce((s,m)=>s+m.importe,0);
  const totalMesUSD = movsMesUSD.reduce((s,m)=>s+m.importe,0);
  const cantidadMes = movsMes.length;
  // Subtotales por tarjeta (Visa, Master, etc.) — separados por moneda
  const porTarjeta = {};
  // Subtotales por categoría del mes: "por tarjeta" dice con qué plástico pagaste, no en qué
  // se te fue la plata. La clave lleva la moneda pegada por el mismo motivo que la de tarjeta:
  // pesos y dólares no se suman entre sí.
  const porCategoria = {};
  movsMes.forEach(m=>{
    const moneda=m.moneda||"ARS";
    const key=`${m.tarjeta}|${moneda}`;
    porTarjeta[key] = (porTarjeta[key]||0) + m.importe;
    const cat=m.cat||"Sin categoría";
    const keyCat=`${cat}|${moneda}`;
    porCategoria[keyCat] = (porCategoria[keyCat]||0) + m.importe;
  });
  // La fila de chips de arriba (Total ARS/USD, Gastos, Pendiente ARS/USD) se sacó a pedido:
  // repetía números que ya están en las dos cards. El total del mes y la cantidad de gastos
  // los muestra "Balance del mes"; el total de lo que falta pagar, "Cuotas pendientes".

  // Card Balance del mes con desglose por tarjeta
  const balanceEl=document.getElementById("tc-balance");
  if(balanceEl){
    const esMesActual = ymSel===hoyYM;
    let html=`<div class="seccion-label mb-6">${esMesActual?"A pagar este mes":"Total "+mesLbl(ymSel)}</div>
      <div style="display:flex;gap:14px;align-items:baseline;margin-bottom:6px;flex-wrap:wrap">
        <div style="font-size:24px;font-weight:600;color:var(--warning)" data-animar="${totalMesARS}">${fmtTotal(0)}</div>
        ${totalMesUSD>0?`<div style="font-size:18px;font-weight:600;color:var(--warning)">+ USD ${totalMesUSD.toFixed(2)}</div>`:""}
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px">${cantidadMes} ${cantidadMes===1?"gasto":"gastos"} en este mes</div>`;
    const tarjEntries=Object.entries(porTarjeta).sort((a,b)=>b[1]-a[1]);
    if(tarjEntries.length){
      html+=`<div class="seccion-label mb-6">Por tarjeta</div>`;
      // Un solo máximo para las dos monedas hacía que, con una tarjeta en USD, su barra
      // quedara invisible al lado de las de pesos: se comparaba 50 contra 300.000. Cada
      // moneda se escala contra su propio máximo.
      const maxTarjPorMoneda={};
      tarjEntries.forEach(([key,val])=>{
        const moneda=key.slice(key.lastIndexOf("|")+1);
        maxTarjPorMoneda[moneda]=Math.max(maxTarjPorMoneda[moneda]||0, val);
      });
      html+=tarjEntries.map(([key,val])=>{
        const sep=key.lastIndexOf("|");
        const tarj=key.slice(0,sep), moneda=key.slice(sep+1);
        const fmt=moneda==="USD"?`USD ${val.toFixed(2)}`:fmtS(val);
        const monedaBadge=moneda==="USD"?` <span class="badge badge-accent">USD</span>`:"";
        const max=maxTarjPorMoneda[moneda]||1;
        return `<div class="bar-row" style="margin-bottom:6px">
          <div class="bar-label">💳 ${escapeHtml(tarj)}${monedaBadge}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(val/max*100)}%;background:var(--warning)"></div></div>
          <div class="bar-val">${fmt}</div>
        </div>`;
      }).join("");
    } else {
      html+=`<p style="font-size:13px;color:var(--muted);text-align:center;padding:8px 0">Sin gastos en ${mesLbl(ymSel)}</p>`;
    }
    // Por categoría: mismo formato que "Por tarjeta", ordenado de mayor a menor.
    // Las barras se comparan dentro de cada moneda, no entre monedas: si no, un gasto de
    // USD 50 al lado de uno de $300.000 dibujaría una barra llena y otra invisible, comparando
    // números que no son comparables.
    const catEntries=Object.entries(porCategoria).sort((a,b)=>b[1]-a[1]);
    if(catEntries.length){
      html+=`<div class="seccion-label mt-14 mb-6">Por categoría</div>`;
      const maxPorMoneda={};
      catEntries.forEach(([key,val])=>{
        const moneda=key.split("|")[1];
        maxPorMoneda[moneda]=Math.max(maxPorMoneda[moneda]||0, val);
      });
      html+=catEntries.map(([key,val])=>{
        const sep=key.lastIndexOf("|");
        const cat=key.slice(0,sep), moneda=key.slice(sep+1);
        const fmt=moneda==="USD"?`USD ${val.toFixed(2)}`:fmtS(val);
        const monedaBadge=moneda==="USD"?` <span class="badge badge-accent">USD</span>`:"";
        const max=maxPorMoneda[moneda]||1;
        return `<div class="bar-row" style="margin-bottom:6px">
          <div class="bar-label">${getIcon(cat,"💳")} ${escapeHtml(cat)}${monedaBadge}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(val/max*100)}%;background:var(--warning)"></div></div>
          <div class="bar-val">${fmt}</div>
        </div>`;
      }).join("");
    }
    // Lista detallada de gastos del mes
    if(movsMes.length){
      html+=`<div class="seccion-label mt-14 mb-6">Detalle</div>
        <div style="font-size:12px">`;
      movsMes.sort((a,b)=>b.importe-a.importe).forEach(m=>{
        const tag=m.frecuente?"🔁":`${m.nCuota}/${m.cuotasTotal}`;
        const monto=m.moneda==="USD"?`USD ${m.importe.toFixed(2)}`:fmtS(m.importe);
        html+=`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)">
          <span><span style="color:var(--muted);font-size:10px">${tag}</span> ${escapeHtml(m.desc)}</span>
          <strong>${monto}</strong>
        </div>`;
      });
      html+=`</div>`;
    }
    // (La proyección mes a mes vive ahora en su propia card: renderTcPendientes())
    balanceEl.innerHTML=html;
    animarNumerosDe(balanceEl);
  }

  renderTcPendientes();

  // La sección "Activas" (una card por compra, con sus balances y barra de progreso) se sacó
  // a pedido: era un desglose de cada movimiento cargado y ya está cubierto por la card de
  // Cuotas pendientes (proyección mes a mes, con desglose al tocar) más el Balance del mes.
  // `activas` sigue calculándose porque de ahí salen los chips "Pendiente ARS"/"Pendiente USD".

  // "Completados" también se sacó a pedido: después de Cuotas pendientes no va nada más.
  // El historial de compras terminadas y sus acciones (editar/eliminar) viven en la solapa
  // Movimientos, donde cada cuota aparece como un movimiento con swipe para editar o borrar.
}

// ═══════════════════════════════════════════
// INVERSIONES (pestaña dedicada)
// ═══════════════════════════════════════════
function cambiarMesInv(delta){
  mesInv = addMonths(mesInv, delta);
  renderInv();
  animarCambioDeMes(delta, document.getElementById("inv-summary"),
                    document.getElementById("inv-balance"), document.getElementById("inv-movs"));
}

// Helper: detecta si una operación de inversión es SALIDA DEL PORTFOLIO
// (rescates/ventas/cupones que retornan cash al bolsillo del usuario).
// Suscripciones, compras y colocadas son ENTRADAS al portfolio (sale cash del bolsillo).
function isInvSalida(m){
  const txt=(m.subcat||"").toLowerCase()+" "+(m.cat||"").toLowerCase();
  return /rescate|venta|amortizaci|cup[oó]n|dividendo|rendimiento|tomada/.test(txt);
}
// Signo desde la perspectiva del PORTFOLIO (qué tan invertido estás).
// Suscripción=+1 (más portfolio), rescate=-1 (menos portfolio).
function invSigno(m){
  return isInvSalida(m) ? -1 : 1;
}
// Signo desde la perspectiva del CASH FLOW (efecto en tu bolsillo).
// Suscripción=-1 (sale cash), rescate=+1 (entra cash).
// Es exactamente el opuesto de invSigno.
function invSignoCash(m){
  return isInvSalida(m) ? 1 : -1;
}
// Suma neta del portfolio (lo que está invertido)
function sumInvNeto(arr){
  return arr.reduce((s,m)=>s+(m.importe||0)*invSigno(m),0);
}
function sumInvNetoUSD(arr){
  return arr.reduce((s,m)=>s+(m.importeUSD||0)*invSigno(m),0);
}

function renderInv(){
  const ymSel=mesInv;
  document.getElementById("inv-mes-label").textContent=mesLbl(ymSel);

  // Movimientos de inversión del mes seleccionado
  const invsMes=movs.filter(m=>{
    if(m.tipo!=="Inversion") return false;
    return String(m.fecha||"").slice(0,7)===ymSel;
  }).sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));

  const cantMes=invsMes.length;
  // El resultado sale de resultado-inversiones.js, que mira TODA la historia: por una lista de
  // un mes suelto no se puede saber si una venta fue ganancia o capital volviendo.
  const ganInv=gananciaInvDelMes(ymSel);
  const puestoARS=invsMes.filter(m=>!isInvSalida(m)&&m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0);

  // ── CHIPS ──
  // Antes decían "Balance ARS −$110.918", el neto de CAJA del mes, justo arriba de un cuadro que
  // encabezaba con otra cifra sobre los mismos movimientos. Y trataban una compra como plata
  // perdida, que es lo que el modelo dejó de hacer hace rato.
  const colorRes=Math.round(ganInv.ars)===0 ? "" : (ganInv.ars>0 ? "positive" : "negative");
  let chips=`<div class="chip"><div class="chip-label">Resultado</div><div class="chip-val ${colorRes}">${fmtTotalMas(ganInv.ars)}</div></div>`;
  if(Math.abs(ganInv.usd||0)>=0.01){
    chips+=`<div class="chip"><div class="chip-label">Resultado USD</div><div class="chip-val ${ganInv.usd>=0?"positive":"negative"}">${ganInv.usd>=0?"+":""}USD ${ganInv.usd.toFixed(2)}</div></div>`;
  }
  chips+=`<div class="chip"><div class="chip-label" style="color:var(--invest)">◈ Invertido</div><div class="chip-val" style="color:var(--invest)">${fmtTotal(puestoARS)}</div></div>`;
  chips+=`<div class="chip"><div class="chip-label">Movimientos</div><div class="chip-val">${cantMes}</div></div>`;
  document.getElementById("inv-summary").innerHTML=chips;

  // ── EL MES (el mismo cuadro que en Movimientos, más el desglose por categoría) ──
  const balanceEl=document.getElementById("inv-balance");
  if(!cantMes){
    balanceEl.innerHTML=`<p style="font-size:13px;color:var(--muted);text-align:center;padding:14px 0">Sin movimientos en ${mesLbl(ymSel)}</p>`;
  } else {
    balanceEl.innerHTML=cuadroMesInversionesHTML(invsMes, mesLbl(ymSel), ganInv, {porCategoria:true});
    animarNumerosDe(balanceEl);
  }

  // ── LISTA DE MOVIMIENTOS DEL MES (con editar/eliminar) ──
  // Acá decía "GASTO" en rojo sobre una suscripción, justo debajo de un cuadro que a eso mismo
  // lo llamaba "invertido". Una compra va en color de inversión, no en rojo de gasto.
  // Sin badge de "INVERTIDO"/"RECUPERO" como en Movimientos: ahí sirve para distinguir una
  // inversión del supermercado, pero en esta lista TODAS son inversiones, así que no distingue
  // nada y se comía el ancho del nombre. Compra o rescate ya lo dicen el subtítulo, el ícono
  // y el signo.
  const movsEl=document.getElementById("inv-movs");
  if(!cantMes){
    movsEl.innerHTML=`<div class="empty"><div class="empty-icon">📭</div>Sin movimientos este mes</div>`;
  } else {
    movsEl.innerHTML=invsMes.map(m=>{
      const esIngreso=isInvSalida(m); // rescate/cupón = ingreso al bolsillo
      const sign=esIngreso?"+":"-";
      let amt;
      if(m.importeUSD>0) amt=`${sign}USD ${(Math.round(m.importeUSD*100)/100).toFixed(2)}`;
      else amt=`${sign}${fmtS(m.importe||0)}`;
      const sub=`${escapeHtml(m.subcat||m.cat)} · ${(m.fecha||"").split("-").reverse().join("/")}`;
      const amtColor=esIngreso?"var(--success)":"var(--invest)";
      return `<div class="tx-item">
        <div class="tx-icon inversion">${esIngreso?"📥":"📤"}</div>
        <div class="tx-info">
          <div class="tx-cat">${escapeHtml(m.cat)}<span class="inv-badge">${escapeHtml(m.ticker||"?")}</span></div>
          <div class="tx-sub">${sub}${m.nota?" · "+escapeHtml(m.nota.slice(0,18)):""}</div>
        </div>
        <div class="tx-amount" style="color:${amtColor}">${amt}</div>
        <div class="tx-actions">
          <button class="tx-edit" onclick="openEditModal(${m.id})" title="Editar">✎</button>
          <button class="tx-del" onclick="borrarMovInv(${m.id},this)" title="Eliminar (tocá dos veces)">×</button>
        </div>
      </div>`;
    }).join("");
  }

  // ── HISTÓRICO TOTAL ──
  renderInvHistorico();

  if(typeof renderPosicionInicial==="function") renderPosicionInicial();
  renderInvertidoHoy();
}

// La curva de la cartera: cuánto capital quedaba adentro al cierre de cada mes.
// Antes esta card era "Histórico total", con sus propios chips de Balance/Ingresos/Gastos y un
// "Top tickers (balance)": otra vez el neto de CAJA, con otras palabras, al lado de un cuadro
// que decía otra cosa sobre los mismos movimientos. Quedó solo el gráfico, adentro del cuadro
// que ya dice cuánto tenés puesto, y midiendo eso mismo.
function renderInvHistorico(){
  const wrap=document.getElementById("inv-curva-wrap");
  const canvas=document.getElementById("chart-inv-historico");
  if(!wrap||!canvas) return;
  const serie=capitalInvertidoPorMes(movs);
  if(serie.length<2){ wrap.style.display="none"; return; }   // con un mes solo no hay curva
  wrap.style.display="block";
  const labels=serie.map(d=>{ const [y,m]=d.ym.split("-"); return m+"/"+y.slice(2); });
  renderChartInvHistoricoBI(labels, serie.map(d=>d.ars));
}

function borrarMovInv(id,btn){
  if(btn && btn.dataset.confirm!=="1"){
    btn.dataset.confirm="1";
    btn.style.color="var(--danger)";
    btn.style.fontWeight="bold";
    btn.textContent="?";
    setTimeout(()=>{
      if(btn){btn.dataset.confirm="0";btn.style.color="";btn.style.fontWeight="";btn.textContent="×";}
    },2500);
    return;
  }
  movs=movs.filter(m=>m.id!==id);
  save();
  renderInv();
}

// ═══════════════════════════════════════════
// EDITAR TARJETA
// ═══════════════════════════════════════════
let editingTcId=null;

function openEditTcModal(id){
  const t=tcs.find(x=>x.id===id);
  if(!t) return;
  editingTcId=id;
  document.getElementById("edit-form-content").innerHTML=renderEditTcForm(t);
  document.getElementById("modal-edit").classList.add("open");
  // Reemplazo el handler del botón de guardar
  const btnGuardar=document.querySelector("#modal-edit .btn-primary");
  if(btnGuardar) btnGuardar.setAttribute("onclick","guardarEditTc()");
}

function renderEditTcForm(t){
  const hoyYM=currentYM();
  if(t.frecuente){
    const montoActual=getMontoEnMes(t,hoyYM);
    const cambios=Array.isArray(t.cambios)?t.cambios.slice().sort((a,b)=>a.desde.localeCompare(b.desde)):[];
    return `
      <div style="display:inline-block;font-size:10px;font-weight:600;padding:3px 9px;border-radius:10px;background:var(--warning-light);color:var(--warning);margin-bottom:10px">🔁 GASTO FRECUENTE</div>
      <div class="form-group"><label class="form-label">Descripción</label>
        <input type="text" id="edit-tc-desc" class="form-input" value="${escapeHtml(t.desc)}">
      </div>
      <div class="two-col">
        <div class="form-group"><label class="form-label">Tarjeta</label>
          <div class="u-row-6">
            <select id="edit-tc-tarj" class="form-select u-flex1">
              ${getTarjetas().map(nm=>`<option ${t.tarjeta===nm?'selected':''}>${escapeHtml(nm)}</option>`).join("")}
              ${t.tarjeta && !getTarjetas().includes(t.tarjeta)?`<option selected>${escapeHtml(t.tarjeta)}</option>`:""}
            </select>
            <button type="button" class="btn-sm" onclick="agregarTarjetaRapida('edit-tc-tarj')" title="Agregar tarjeta nueva">+</button>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Categoría</label>
          <input type="text" id="edit-tc-cat" class="form-input" value="${escapeHtml(t.cat)}">
        </div>
      </div>
      <div class="two-col">
        <div class="form-group"><label class="form-label">Mes de inicio</label>
          <input type="month" id="edit-tc-inicio" class="form-input" value="${t.mesInicio||''}">
        </div>
        <div class="form-group"><label class="form-label">Mes de fin (opcional)</label>
          <input type="month" id="edit-tc-fin" class="form-input" value="${t.mesFin||''}">
        </div>
      </div>
      <div class="form-group"><label class="form-label">Cuenta</label>
        <div class="u-row">
          <select id="edit-tc-cuenta" class="form-select u-flex1">
            ${getCuentas().map(c=>`<option ${t.cuenta===c?'selected':''}>${escapeHtml(c)}</option>`).join("")}
            ${t.cuenta && !getCuentas().includes(t.cuenta)?`<option selected>${escapeHtml(t.cuenta)}</option>`:""}
          </select>
          <button type="button" class="btn-sm" onclick="agregarCuentaRapida('edit-tc-cuenta')" title="Agregar cuenta nueva">+ Cta</button>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Moneda</label>
        <select id="edit-tc-moneda-frec" class="form-select" onchange="document.getElementById('edit-tc-aum-prefix').textContent=this.value==='USD'?'USD':'$'">
          <option value="ARS" ${(t.moneda||'ARS')==='ARS'?'selected':''}>🇦🇷 Pesos (ARS)</option>
          <option value="USD" ${t.moneda==='USD'?'selected':''}>🇺🇸 Dólares (USD)</option>
        </select>
        <p style="font-size:10px;color:var(--muted);margin-top:4px">Cambiar la moneda afecta el monto vigente y todos los aumentos del historial.</p>
      </div>
      <div class="inset">
        <div class="seccion-label mb-6">Monto vigente este mes</div>
        <div style="font-size:18px;font-weight:600;color:var(--warning)">${fmtMoneda(montoActual,t.moneda)}</div>
      </div>
      <div style="background:var(--warning-light);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">📈 Registrar aumento de precio</div>
        <p style="font-size:11px;color:var(--muted);margin-bottom:8px">El nuevo monto se aplicará desde el mes elegido en adelante. Los meses anteriores conservan el monto que ya tenían.</p>
        <div class="two-col">
          <div class="form-group"><label class="form-label">Desde el mes</label>
            <input type="month" id="edit-tc-aum-mes" class="form-input" value="${hoyYM}">
          </div>
          <div class="form-group"><label class="form-label">Nuevo monto</label>
            <div class="amount-wrap"><span class="amount-prefix" id="edit-tc-aum-prefix">${t.moneda==='USD'?'USD':'$'}</span>
              <input type="number" id="edit-tc-aum-monto" class="form-input amount-input" placeholder="${montoActual}" inputmode="decimal" step="any">
            </div>
          </div>
        </div>
      </div>
      ${cambios.length?`
        <div class="seccion-label mb-6">Historial de aumentos</div>
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px 12px;margin-bottom:12px">
          ${cambios.map((c,i)=>`
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:4px 0;${i<cambios.length-1?'border-bottom:1px solid var(--border)':''}">
              <span>${mesLbl(c.desde)}: <strong>${fmtMoneda(c.monto,t.moneda)}</strong></span>
              <button class="tx-del" style="color:var(--danger)" onclick="borrarCambio(${i})" title="Eliminar este aumento">×</button>
            </div>
          `).join("")}
        </div>`:""}
      <div style="background:var(--danger-light);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;margin-bottom:6px;color:var(--danger)">🛑 Dar de baja el gasto frecuente</div>
        <p style="font-size:11px;color:var(--muted);margin-bottom:8px">Configurá un "Mes de fin" para que deje de aparecer desde ese mes en adelante. Los meses anteriores se mantienen en el historial.</p>
        <button type="button" class="btn-sm" style="color:var(--danger);width:100%" onclick="darDeBajaFrec(${t.id})">Dar de baja desde el próximo mes</button>
      </div>
      <div class="form-group"><label class="form-label">Nota</label>
        <textarea id="edit-tc-nota" class="form-textarea">${escapeHtml(t.nota)}</textarea>
      </div>
    `;
  }
  // Cuotas: edición simple
  return `
    <div style="display:inline-block;font-size:10px;font-weight:600;padding:3px 9px;border-radius:10px;background:var(--warning-light);color:var(--warning);margin-bottom:10px">CUOTAS · ${t.cuotasTotal}x</div>
    <div class="form-group"><label class="form-label">Descripción</label>
      <input type="text" id="edit-tc-desc" class="form-input" value="${(t.desc||'').replace(/"/g,'&quot;')}">
    </div>
    <div class="two-col">
      <div class="form-group"><label class="form-label">Tarjeta</label>
        <div class="u-row-6">
          <select id="edit-tc-tarj" class="form-select u-flex1">
            ${getTarjetas().map(nm=>`<option ${t.tarjeta===nm?'selected':''}>${escapeHtml(nm)}</option>`).join("")}
            ${t.tarjeta && !getTarjetas().includes(t.tarjeta)?`<option selected>${escapeHtml(t.tarjeta)}</option>`:""}
          </select>
          <button type="button" class="btn-sm" onclick="agregarTarjetaRapida('edit-tc-tarj')" title="Agregar tarjeta nueva">+</button>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Categoría</label>
        <input type="text" id="edit-tc-cat" class="form-input" value="${escapeHtml(t.cat)}">
      </div>
    </div>
    <div class="form-group"><label class="form-label">Moneda</label>
      <select id="edit-tc-moneda" class="form-select" onchange="document.getElementById('edit-tc-prefix').textContent=this.value==='USD'?'USD':'$'">
        <option value="ARS" ${(t.moneda||'ARS')==='ARS'?'selected':''}>🇦🇷 Pesos (ARS)</option>
        <option value="USD" ${t.moneda==='USD'?'selected':''}>🇺🇸 Dólares (USD)</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Monto total</label>
      <div class="amount-wrap"><span class="amount-prefix" id="edit-tc-prefix">${t.moneda==='USD'?'USD':'$'}</span>
        <input type="number" id="edit-tc-total" class="form-input amount-input" value="${t.total||0}" inputmode="decimal" step="any">
      </div>
    </div>
    <div class="two-col">
      <div class="form-group"><label class="form-label">Cuotas totales</label>
        <input type="number" id="edit-tc-cuotas" class="form-input" value="${t.cuotasTotal||1}" min="1">
      </div>
      <div class="form-group"><label class="form-label">1ª cuota en</label>
        <input type="month" id="edit-tc-inicio" class="form-input" value="${t.mesInicio||''}">
      </div>
    </div>
    <div class="form-group"><label class="form-label">Cuenta</label>
      <div class="u-row">
        <select id="edit-tc-cuenta" class="form-select u-flex1">
          ${getCuentas().map(c=>`<option ${t.cuenta===c?'selected':''}>${escapeHtml(c)}</option>`).join("")}
          ${t.cuenta && !getCuentas().includes(t.cuenta)?`<option selected>${escapeHtml(t.cuenta)}</option>`:""}
        </select>
        <button type="button" class="btn-sm" onclick="agregarCuentaRapida('edit-tc-cuenta')" title="Agregar cuenta nueva">+ Cta</button>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Nota</label>
      <textarea id="edit-tc-nota" class="form-textarea">${(t.nota||'').replace(/</g,'&lt;')}</textarea>
    </div>
  `;
}

function borrarCambio(idx){
  const t=tcs.find(x=>x.id===editingTcId);
  if(!t||!Array.isArray(t.cambios)) return;
  t.cambios.splice(idx,1);
  save();
  // Re-renderizar el modal
  document.getElementById("edit-form-content").innerHTML=renderEditTcForm(t);
}

// Cierra un gasto frecuente de tarjeta poniendo mesFin = mes actual.
// Preserva todos los movimientos anteriores (siguen apareciendo en sus meses).
async function darDeBajaFrec(id){
  const t=tcs.find(x=>x.id===id);
  if(!t||!t.frecuente){return;}
  // Usa el mes que el usuario está viendo en la pestaña Tarjetas
  const mesDeBaja = (typeof mesTc==="string" && mesTc) ? mesTc : currentYM();
  if(!await mostrarConfirm(`¿Dar de baja "${t.desc}" desde ${mesLbl(mesDeBaja)} en adelante?\n\nLos meses anteriores se mantienen en el historial.`, {textoOk:"Dar de baja"})){return;}
  // mesFin es el último mes INCLUIDO: dar de baja desde X significa mesFin = X-1
  t.mesFin = addMonths(mesDeBaja, -1);
  save();
  showToast(`Gasto frecuente dado de baja desde ${mesLbl(mesDeBaja)} ✓`);
  closeEditModal();
  renderMovs();
  renderTarjetas();
}

// Versión para GASTO frecuente (movs[], no tcs[])
async function darDeBajaFrecGasto(id){
  const m=movs.find(x=>x.id===id);
  if(!m||!m.frecuente){return;}
  // Usa el mes que el usuario está viendo en la pestaña Movimientos
  const mesDeBaja = (typeof mesActual==="string" && mesActual) ? mesActual : currentYM();
  if(!await mostrarConfirm(`¿Dar de baja este gasto frecuente desde ${mesLbl(mesDeBaja)} en adelante?\n\nLos meses anteriores se mantienen en el historial.`, {textoOk:"Dar de baja"})){return;}
  m.mesFin = addMonths(mesDeBaja, -1);
  save();
  showToast(`Gasto frecuente dado de baja desde ${mesLbl(mesDeBaja)} ✓`);
  closeEditModal();
  renderMovs();
}

// Elimina un cambio del historial de aumentos del gasto frecuente en edición
function borrarCambioFrec(idx){
  const m=movs.find(x=>x.id===editingId);
  if(!m||!Array.isArray(m.cambios)) return;
  m.cambios.splice(idx,1);
  save();
  document.getElementById("edit-form-content").innerHTML=renderEditForm(m);
  if(m.tipo==="Gasto"||m.tipo==="Ingreso") populateEditCatSelect(m.tipo,m.cat,m.subcat);
}

function guardarEditTc(){
  const t=tcs.find(x=>x.id===editingTcId);
  if(!t){closeEditModal();return;}
  const desc=document.getElementById("edit-tc-desc").value.trim();
  if(!desc){showToast("La descripción no puede estar vacía");return;}
  t.desc=desc;
  t.tarjeta=document.getElementById("edit-tc-tarj").value.trim()||t.tarjeta;
  t.cat=document.getElementById("edit-tc-cat").value.trim()||t.cat;
  t.nota=document.getElementById("edit-tc-nota").value.trim();
  const cuentaEl=document.getElementById("edit-tc-cuenta");
  if(cuentaEl) t.cuenta=cuentaEl.value;
  if(t.frecuente){
    const ini=document.getElementById("edit-tc-inicio").value;
    const fin=document.getElementById("edit-tc-fin").value||null;
    if(!ini){showToast("Indicá el mes de inicio");return;}
    if(fin&&fin<ini){showToast("El mes de fin no puede ser antes del inicio");return;}
    t.mesInicio=ini;
    t.mesFin=fin;
    // Guardar moneda
    const monedaFrecEl=document.getElementById("edit-tc-moneda-frec");
    if(monedaFrecEl) t.moneda=monedaFrecEl.value;
    // Procesar aumento si está cargado
    const aumMes=document.getElementById("edit-tc-aum-mes").value;
    const aumMonto=parseFloat(document.getElementById("edit-tc-aum-monto").value)||0;
    if(aumMes&&aumMonto>0){
      if(!Array.isArray(t.cambios)) t.cambios=[];
      // Si ya hay un cambio para ese mes, lo reemplazamos
      const existIdx=t.cambios.findIndex(c=>c.desde===aumMes);
      if(existIdx>=0) t.cambios[existIdx].monto=Math.round(aumMonto*100)/100;
      else t.cambios.push({desde:aumMes, monto:Math.round(aumMonto*100)/100});
    }
  } else {
    const total=parseFloat(document.getElementById("edit-tc-total").value)||0;
    const cuotas=parseInt(document.getElementById("edit-tc-cuotas").value)||1;
    const ini=document.getElementById("edit-tc-inicio").value;
    const monedaEl=document.getElementById("edit-tc-moneda");
    if(total<=0){showToast("Ingresá un monto válido");return;}
    if(!ini){showToast("Indicá el mes de la 1ª cuota");return;}
    t.total=Math.round(total*100)/100;
    t.cuotasTotal=cuotas;
    t.mesInicio=ini;
    if(monedaEl) t.moneda=monedaEl.value;
  }
  save();
  closeEditModal();
  showToast("Tarjeta actualizada ✓");
  renderTarjetas();
  // Restaurar handler original del botón guardar (para movimientos)
  const btnGuardar=document.querySelector("#modal-edit .btn-primary");
  if(btnGuardar) btnGuardar.setAttribute("onclick","guardarEdit()");
  editingTcId=null;
}


// ═══════════════════════════════════════════
// INVERTIDO HOY (acumulado, toda la historia)
// ═══════════════════════════════════════════
// Movimientos mira un mes; esta pestaña mira la cartera entera. Acá va todo lo que venís
// invirtiendo: cuánto sigue puesto hoy, cuánto pasó por ahí en total y qué resultado dejó.
//
// No es lo mismo que "Cartera (acumulado)", que está más abajo: esa muestra el neto de CAJA por
// posición (lo que te dio o te costó), y esta el CAPITAL que sigue adentro. Con un fondo que se
// suscribe y se rescata todo el tiempo, las dos dan números muy distintos y las dos son ciertas.
function renderInvertidoHoy(){
  const card=document.getElementById("card-invertido-hoy");
  const el=document.getElementById("invertido-hoy");
  if(!card||!el) return;

  const todas=movs.filter(m=>m.tipo==="Inversion");
  if(!todas.length){ card.style.display="none"; return; }
  card.style.display="block";

  const capital=capitalInvertido(movs);
  const puestoARS=todas.filter(m=>!isInvSalida(m)&&m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0);
  const sacadoARS=todas.filter(m=>isInvSalida(m)&&m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0);
  const puestoUSD=todas.filter(m=>!isInvSalida(m)).reduce((s,m)=>s+(m.importeUSD||0),0);
  const sacadoUSD=todas.filter(m=>isInvSalida(m)).reduce((s,m)=>s+(m.importeUSD||0),0);
  const gan=resultadoInv(movs).gananciaPorMes;
  const total={ars:0, usd:0};
  Object.keys(gan).forEach(ym=>{ total.ars+=gan[ym].ars; total.usd+=gan[ym].usd; });
  total.ars=Math.round(total.ars*100)/100;
  total.usd=Math.round(total.usd*100)/100;

  let html=`<div class="seccion-label mb-6">Lo que sigue puesto</div>
    <div style="font-size:24px;font-weight:600;color:var(--invest);margin-bottom:2px" data-animar="${capital.ars}" data-animar-fmt="fmtTotal">${fmtTotal(0)}</div>`;
  if(Math.abs(capital.usd)>=0.01){
    html+=`<div style="font-size:13px;font-weight:600;color:var(--invest);margin-bottom:4px">USD ${capital.usd.toFixed(2)}</div>`;
  }

  const mov=[];
  if(puestoARS>0) mov.push(`📤 invertido en total <strong style="color:var(--invest)">${fmtS(puestoARS)}</strong>`);
  if(sacadoARS>0) mov.push(`📥 rescatado <strong style="color:var(--success)">${fmtS(sacadoARS)}</strong>`);
  if(puestoUSD>0) mov.push(`📤 invertido USD <strong style="color:var(--invest)">${puestoUSD.toFixed(2)}</strong>`);
  if(sacadoUSD>0) mov.push(`📥 rescatado USD <strong style="color:var(--success)">${sacadoUSD.toFixed(2)}</strong>`);
  html+=`<div style="font-size:12px;color:var(--muted);margin-top:6px">${mov.join(" · ")}</div>`;

  const res=[];
  if(Math.round(total.ars)!==0){
    const c=total.ars>=0?"var(--success)":"var(--danger)";
    res.push(`<strong style="color:${c}">${total.ars>=0?"+":""}${fmtS(total.ars)}</strong>`);
  }
  if(Math.abs(total.usd)>=0.01){
    const c=total.usd>=0?"var(--success)":"var(--danger)";
    res.push(`<strong style="color:${c}">${total.usd>=0?"+":""}USD ${total.usd.toFixed(2)}</strong>`);
  }
  if(res.length){
    html+=`<div style="font-size:12px;color:var(--muted)">📊 resultado acumulado ${res.join(" · ")}</div>`;
  }
  html+=`<div style="height:14px"></div>`;

  const barras=barrasDeTickers(capitalPorTicker(movs));
  if(barras){
    html+=`<div class="seccion-label mb-6">Por ticker (capital adentro)</div>`+barras;
  } else {
    html+=`<div class="txt-xs txt-muted">Hoy no queda capital invertido: rescataste todo lo que habías puesto.</div>`;
  }
  el.innerHTML=html;
  animarNumerosDe(el);
}
