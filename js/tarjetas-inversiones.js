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

// ═══════════════════════════════════════════
// LÍNEA DE TIEMPO DE MESES (pestaña Tarjetas)
// ═══════════════════════════════════════════
// Reemplaza la franja .month-nav y la proyección futura que tenía "Cuotas pendientes" (una
// caja por mes, tocar para desglosar): ahora cualquier mes de la tira —pasado, presente o
// futuro— se selecciona tocándolo (ver irAMesTc), y el desglose de cualquier mes se ve
// simplemente parado en él, en Balance del mes y Compras de este mes.

// Rango a dibujar: arranca 2 meses antes de currentYM() y llega hasta el último mes de
// horizonteCuotas; si navegaste con las flechas más allá de ese rango, se estira para incluir
// mesTc (igual que decía el handoff).
function rangoTcTimeline(){
  const hoy=currentYM();
  let desde=addMonths(hoy,-2);
  let hasta=addMonths(hoy, horizonteCuotas(hoy));
  if(mesTc<desde) desde=mesTc;
  if(mesTc>hasta) hasta=mesTc;
  return {desde,hasta};
}

function abrevMes3(ym){
  return MESES[parseInt(ym.split("-")[1])-1].slice(0,3);
}

function renderTcTimeline(){
  const el=document.getElementById("tc-timeline");
  if(!el) return;
  const {desde,hasta}=rangoTcTimeline();
  const hoyYM=currentYM();
  const datos=[];
  for(let ym=desde; ym<=hasta; ym=addMonths(ym,1)){
    const movs=getTcMovsEnMes(ym);
    datos.push({
      ym,
      ars: movs.filter(m=>m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0),
      usd: movs.some(m=>m.moneda==="USD"),
      incompleto: movs.some(m=>numeroRoto(m.importe))
    });
  }
  // La altura de la barra se calcula solo con ARS (el punto USD es un indicador aparte).
  const max=Math.max(1, ...datos.map(d=>d.ars||0));
  el.innerHTML=datos.map(d=>{
    const sel=d.ym===mesTc, pasado=d.ym<hoyYM;
    const alto=Math.max(4, Math.round((d.ars||0)/max*62));
    const barColor = sel ? "var(--warning)" : pasado ? "var(--border)" : "color-mix(in srgb,var(--warning) 32%,var(--surface))";
    const trama = d.incompleto ? ";background-image:repeating-linear-gradient(45deg,rgba(0,0,0,.2) 0 3px,transparent 3px 6px)" : "";
    const colBg = sel ? "var(--warning-light)" : "transparent";
    const lblStyle = sel ? "color:var(--warning);font-weight:700" : "";
    const totalTxt = d.incompleto ? "monto incompleto" : fmtTotal(d.ars);
    return `<button type="button" class="tc-col" style="background:${colBg}" aria-pressed="${sel}"
        aria-label="${escapeHtml(mesLbl(d.ym))}: ${escapeHtml(totalTxt)}" onclick="irAMesTc(${attrJS(d.ym)})">
      ${d.usd?'<span class="tc-col-usd"></span>':""}
      <span class="tc-col-bar" style="height:${alto}px;background:${barColor}${trama}"></span>
      <span class="tc-col-lbl" style="${lblStyle}">${abrevMes3(d.ym)}<br>'${d.ym.slice(2,4)}</span>
    </button>`;
  }).join("");
  // Scroll manual a la columna seleccionada (scrollIntoView también movería la página entera).
  const colSel=el.querySelector('.tc-col[aria-pressed="true"]');
  if(colSel) el.scrollLeft = colSel.offsetLeft - 60;
}

// Única otra forma de cambiar mesTc además de cambiarMesTc(delta): tocar una columna de la
// línea de tiempo salta directo a ese mes en vez de sumar de a uno, y anima en la dirección
// real del salto (no siempre "hacia adelante").
function irAMesTc(ym){
  if(ym===mesTc) return;
  const signo = ym>mesTc ? 1 : -1;
  mesTc=ym;
  renderTarjetas();
  animarCambioDeMes(signo, document.getElementById("tc-balance"), document.getElementById("tc-pendientes"));
}

// ═══════════════════════════════════════════
// COMPRAS DE ESTE MES (#tc-pendientes)
// ═══════════════════════════════════════════
// Antes esta card proyectaba los meses SIGUIENTES (una caja por mes, tocar para desglosar);
// esa navegación ahora vive en la línea de tiempo. Acá se ve el detalle del mes seleccionado
// —cada compra con su avance, tocable para editarla— más una línea de cierre con lo que queda
// después de este mes.
function renderTcPendientes(){
  const el=document.getElementById("tc-pendientes");
  if(!el) return;

  const movsMes=getTcMovsEnMes(mesTc);
  const ars=movsMes.filter(m=>m.moneda!=="USD").sort((a,b)=>b.importe-a.importe);
  const usd=movsMes.filter(m=>m.moneda==="USD").sort((a,b)=>b.importe-a.importe);
  const ordenado=[...ars, ...usd];

  let html=`<div class="seccion-label" style="padding:14px 20px 6px;font-size:12px;font-weight:600">Compras de este mes</div>`;
  if(!ordenado.length){
    html+=`<div class="card" style="margin:0 16px"><p style="font-size:13px;color:var(--muted);text-align:center;padding:24px;margin:0">Sin gastos en ${escapeHtml(mesLbl(mesTc))}</p></div>`;
  } else {
    // Tocar la fila abre el mismo modal de edición que usa Movimientos: hoy esta pantalla no
    // tenía ningún acceso para corregir una compra con tarjeta.
    html+=`<div class="card" style="margin:0 16px;padding:0;overflow:hidden">`+ordenado.map((m,i)=>{
      const icon=getIcon(m.cat,"💳");
      const tag=m.frecuente?"🔁 Mensual fijo":`Cuota ${m.nCuota} de ${m.cuotasTotal}`;
      const barra=m.frecuente?"":`<div class="tc-row-progreso"><div class="tc-row-progreso-fill" style="width:${Math.max(0,Math.round(m.nCuota/m.cuotasTotal*100))}%"></div></div>`;
      const monto=m.moneda==="USD"?`USD ${(m.importe||0).toFixed(2)}`:fmtS(m.importe);
      const restantes=m.cuotasTotal-m.nCuota;
      const finYm=addMonths(mesTc,restantes);
      const finTxt=m.frecuente?"":(restantes<=0?"última cuota":`termina ${abrevMes3(finYm).toLowerCase()} ${finYm.slice(2,4)}`);
      return `<div class="tc-row"${i>0?' style="border-top:1px solid var(--border)"':""} onclick="openEditTcModal(${m.id})">
        <div class="tc-row-icon">${icon}</div>
        <div class="tc-row-mid">
          <div class="tc-row-desc">${escapeHtml(m.desc||"")}</div>
          <div class="tc-row-sub"><span>${escapeHtml(m.tarjeta||"Sin tarjeta")} · ${tag}</span>${barra}</div>
        </div>
        <div class="tc-row-right">
          <div class="tc-row-monto">${monto}</div>
          ${finTxt?`<div class="tc-row-fin">${finTxt}</div>`:""}
        </div>
      </div>`;
    }).join("")+`</div>`;
  }

  // Línea de cierre: lo que queda por pagar DESPUÉS de este mes (que ya está detallado arriba).
  // mesesConCuotasPendientes sigue siendo inclusiva del mes que se le pasa, sin cambios.
  const meses=mesesConCuotasPendientes(addMonths(mesTc,1));
  if(!meses.length){
    html+=`<div class="tc-cierre">No quedan cuotas después de este mes.</div>`;
  } else if(meses.some(m=>m.incompleto)){
    html+=`<div class="tc-cierre">Hay una compra sin monto, así que el total no se puede calcular. Está en el aviso del Dashboard.</div>`;
  } else {
    const totalARS=meses.reduce((s,m)=>s+m.totalARS,0);
    const totalUSD=meses.reduce((s,m)=>s+m.totalUSD,0);
    const ultimo=meses[meses.length-1].ym;
    html+=`<div class="tc-cierre">Después de ${escapeHtml(mesLbl(mesTc))} quedan <strong style="color:var(--warning)">${fmtTotal(totalARS)}</strong>${totalUSD>0?` + <strong style="color:var(--accent)">USD ${totalUSD.toFixed(2)}</strong>`:""} en ${meses.length} ${meses.length===1?"mes":"meses"}. La última cuota es en ${escapeHtml(mesLbl(ultimo))}.</div>`;
  }
  el.innerHTML=html;
}

// ═══════════════════════════════════════════
// TARJETAS
// ═══════════════════════════════════════════
// Vista de las barras de "Balance del mes": por tarjeta o por categoría, nunca las dos juntas
// (antes se mostraban siempre las dos, una debajo de la otra). Se recuerda entre sesiones
// porque es una preferencia de visualización, no un filtro de datos — igual idea que tcMesAbierto
// antes, pero persistida.
let tcVistaBarras = (function(){
  try{ return localStorage.getItem("enola-tc-vista")==="categoria" ? "categoria" : "tarjeta"; }
  catch(e){ return "tarjeta"; }
})();
function setTcVistaBarras(v){
  tcVistaBarras = v;
  try{ localStorage.setItem("enola-tc-vista", v); }catch(e){}
  renderTarjetas();
}

// Una fila de "Por tarjeta"/"Por categoría": nombre+monto arriba, pista de progreso debajo.
function filaBarraTc(nombreHtml, moneda, val, max){
  const fmt=moneda==="USD"?`USD ${val.toFixed(2)}`:fmtS(val);
  const badge=moneda==="USD"?` <span class="badge badge-accent">USD</span>`:"";
  const pct=Math.max(0, Math.round(val/max*100));
  return `<div class="tc-bar-row">
    <div class="tc-bar-top"><span>${nombreHtml}${badge}</span><span>${fmt}</span></div>
    <div class="tc-bar-track"><div class="tc-bar-fill" style="width:${pct}%"></div></div>
  </div>`;
}

function cambiarMesTc(delta){
  mesTc = addMonths(mesTc, delta);
  renderTarjetas();
  animarCambioDeMes(delta, document.getElementById("tc-balance"), document.getElementById("tc-pendientes"));
}

function renderTarjetas(){
  const ymSel = mesTc;
  const hoyYM = currentYM();
  document.getElementById("tc-mes-label").textContent=mesLbl(ymSel);

  renderTcTimeline();

  // ── BALANCE DEL MES SELECCIONADO ──
  const movsMes = getTcMovsEnMes(ymSel);
  const totalMesARS = movsMes.filter(m=>m.moneda!=="USD").reduce((s,m)=>s+m.importe,0);
  const totalMesUSD = movsMes.filter(m=>m.moneda==="USD").reduce((s,m)=>s+m.importe,0);
  const cantidadMes = movsMes.length;
  const nFrec = movsMes.filter(m=>m.frecuente).length;
  const nCuotas = cantidadMes - nFrec;
  // Subtotales por tarjeta (Visa, Master, etc.) y por categoría del mes — separados por
  // moneda, porque pesos y dólares no se suman entre sí.
  const porTarjeta = {};
  const porCategoria = {};
  movsMes.forEach(m=>{
    const moneda=m.moneda||"ARS";
    const key=`${m.tarjeta}|${moneda}`;
    porTarjeta[key] = (porTarjeta[key]||0) + m.importe;
    const cat=m.cat||"Sin categoría";
    const keyCat=`${cat}|${moneda}`;
    porCategoria[keyCat] = (porCategoria[keyCat]||0) + m.importe;
  });

  const balanceEl=document.getElementById("tc-balance");
  if(balanceEl){
    const esMesActual = ymSel===hoyYM;
    let subtitulo;
    if(!cantidadMes){
      subtitulo="Sin gastos con tarjeta";
    } else {
      const partes=[];
      if(totalMesUSD>0) partes.push(`+ USD ${totalMesUSD.toFixed(2)}`);
      if(nCuotas>0) partes.push(`${nCuotas} en cuotas`);
      if(nFrec>0) partes.push(`${nFrec} fijos`);
      subtitulo=partes.join(" · ");
    }
    let html=`<div style="padding:18px 20px 4px;display:flex;flex-direction:column;align-items:center;gap:2px">
      <div class="seccion-label">${esMesActual?"A pagar este mes":"A pagar en "+escapeHtml(mesLbl(ymSel))}</div>
      <div style="font-size:34px;font-weight:700;letter-spacing:-1.2px;color:var(--warning)" data-animar="${totalMesARS}">${fmtTotal(0)}</div>
      <div style="font-size:12px;color:var(--muted)">${escapeHtml(subtitulo)}</div>
    </div>`;

    if(cantidadMes>0){
      // Selector Por tarjeta/Por categoría: reusa .seg-filter de Movimientos (mismo aspecto;
      // el handoff pide 14px de margen arriba en vez de 16px, diferencia mínima que no
      // justifica una clase aparte).
      html+=`<div class="seg-filter" style="margin-top:14px">
        <button class="seg-btn${tcVistaBarras==="tarjeta"?" active":""}" onclick="setTcVistaBarras('tarjeta')">Por tarjeta</button>
        <button class="seg-btn${tcVistaBarras==="categoria"?" active":""}" onclick="setTcVistaBarras('categoria')">Por categoría</button>
      </div>`;

      const vistaCategoria=tcVistaBarras==="categoria";
      const entries=Object.entries(vistaCategoria?porCategoria:porTarjeta).sort((a,b)=>b[1]-a[1]);
      // Un solo máximo para las dos monedas hacía que, con un gasto en USD, su barra quedara
      // invisible al lado de las de pesos: cada moneda se escala contra su propio máximo.
      const maxPorMoneda={};
      entries.forEach(([key,val])=>{
        const moneda=key.slice(key.lastIndexOf("|")+1);
        maxPorMoneda[moneda]=Math.max(maxPorMoneda[moneda]||0, val);
      });
      html+=`<div class="tc-bars">`+entries.map(([key,val])=>{
        const sep=key.lastIndexOf("|");
        const nombre=key.slice(0,sep), moneda=key.slice(sep+1);
        const icono=vistaCategoria?getIcon(nombre,"💳"):"💳";
        return filaBarraTc(`${icono} ${escapeHtml(nombre)}`, moneda, val, maxPorMoneda[moneda]||1);
      }).join("")+`</div>`;
    }

    balanceEl.innerHTML=html;
    animarNumerosDe(balanceEl);
  }

  renderTcPendientes();
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

// ═══════════════════════════════════════════
// DUPLICADOS EN INVERSIONES
// ═══════════════════════════════════════════
// Se ofrecen para borrar solo los EXACTOS: mismo ticker, misma fecha, misma categoría y
// subcategoría, y el mismo importe (en pesos y en dólares, redondeado al centavo). Con esas
// cinco cosas iguales a la vez, la chance de que sean dos operaciones reales y distintas es
// prácticamente cero — nadie compra el mismo ticker, el mismo día, por el mismo monto exacto,
// dos veces. Es el patrón que deja cargar a mano algo que en realidad ya estaba importado, o
// importar el mismo archivo dos veces con un importador que no lo reconoce.
function claveInvExacta(m){
  return [m.ticker||"", String(m.fecha||"").slice(0,10), m.cat||"", m.subcat||"",
          Math.round((m.importe||0)*100), Math.round((m.importeUSD||0)*100)].join("|");
}

// Grupos de 2 o más movimientos de inversión que comparten esa clave. Cada grupo va ordenado
// por id (más viejo primero), para que "cuál se queda" sea siempre el mismo sin importar en
// qué orden estén guardados en `movs`.
function duplicadosExactosInversion(lista){
  const porClave={};
  (lista||[]).filter(m=>m && m.tipo==="Inversion").forEach(m=>{
    const k=claveInvExacta(m);
    (porClave[k]=porClave[k]||[]).push(m);
  });
  return Object.values(porClave)
    .filter(g=>g.length>1)
    .map(g=>g.slice().sort((a,b)=>(a.id||0)-(b.id||0)));
}

// Pares que se PARECEN pero no son iguales: mismo ticker, fecha a pocos días y monto a menos
// de 2% de diferencia. A propósito NO se ofrecen para borrar solos —el bruto y el neto de un
// broker pueden diferir un poco, y dos operaciones reales pueden coincidir de casualidad—,
// pero vale la pena que el usuario los mire con sus propios ojos.
const INV_SIM_DIAS=3, INV_SIM_PCT=0.02;
function montoDeInversion(m){
  return (m.importeUSD||0)>0 ? m.importeUSD : (m.importe||0);
}
function similaresInversion(lista){
  const invs=(lista||[]).filter(m=>m && m.tipo==="Inversion");
  const yaExactos=new Set();
  duplicadosExactosInversion(lista).forEach(g=>g.forEach(m=>yaExactos.add(m.id)));
  const out=[];
  for(let i=0;i<invs.length;i++){
    for(let j=i+1;j<invs.length;j++){
      const a=invs[i], b=invs[j];
      if(yaExactos.has(a.id) && yaExactos.has(b.id)) continue;   // ya van en el otro grupo
      if((a.ticker||"")!==(b.ticker||"")) continue;
      const dias=Math.abs(Date.parse(String(a.fecha||"").slice(0,10)) - Date.parse(String(b.fecha||"").slice(0,10)))/86400000;
      if(!(dias>=0 && dias<=INV_SIM_DIAS)) continue;
      const montoA=montoDeInversion(a), montoB=montoDeInversion(b);
      if(!montoA || !montoB) continue;
      const rel=Math.abs(montoA-montoB)/Math.max(Math.abs(montoA), Math.abs(montoB));
      if(rel>INV_SIM_PCT) continue;
      out.push([a,b]);
    }
  }
  return out;
}

// ═══════════════════════════════════════════
// DUPLICADOS EXACTOS: GASTOS E INGRESOS
// ═══════════════════════════════════════════
// Mismo criterio que arriba, aplicado al resto de los movimientos: un doble toque en
// "Guardar" —el freno de guardar() en form-cargar.js no existía hasta que se detectaron estos
// duplicados en Inversiones— crea el mismo duplicado exacto sea cual sea el tipo. La clave es
// exactamente lo que arma guardar() a partir del formulario (tipo, fecha, categoría,
// subcategoría, cuenta, moneda, importe en las dos monedas y la nota): dos toques sobre el
// mismo clic leen el mismo formulario y arman la clave idéntica.
//
// A propósito NO hay una versión "similares" para Gasto/Ingreso como la de Inversiones: dos
// compras de un monto parecido en la misma categoría y en días cercanos son moneda corriente
// en la vida real (dos changos de supermercado, por ejemplo), y avisar de esos pares sería
// puro ruido. Con Inversiones alcanzaba con el ticker para que la sugerencia significara algo;
// acá no hay un dato equivalente que reduzca tanto el universo.
function claveGastoIngresoExacta(m){
  return ["mov", m.tipo, String(m.fecha||"").slice(0,10), m.cat||"", m.subcat||"",
          m.cuenta||"", m.moneda||"", Math.round((m.importe||0)*100),
          Math.round((m.importeOrig||0)*100), (m.nota||"").trim()].join("|");
}

function duplicadosExactosGastoIngreso(lista){
  const porClave={};
  (lista||[]).filter(m=>m && (m.tipo==="Gasto"||m.tipo==="Ingreso")).forEach(m=>{
    const k=claveGastoIngresoExacta(m);
    (porClave[k]=porClave[k]||[]).push(m);
  });
  return Object.values(porClave)
    .filter(g=>g.length>1)
    .map(g=>g.slice().sort((a,b)=>(a.id||0)-(b.id||0)));
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
// Suma de impacto en cash flow (entra/sale del bolsillo)
function sumInvCash(arr){
  return arr.reduce((s,m)=>s+(m.importe||0)*invSignoCash(m),0);
}

function renderInv(){
  const ymSel=mesInv;
  document.getElementById("inv-mes-label").textContent=mesLbl(ymSel);

  // Movimientos de inversión del mes seleccionado
  const invsMes=movs.filter(m=>{
    if(m.tipo!=="Inversion") return false;
    return String(m.fecha||"").slice(0,7)===ymSel;
  }).sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));

  // Totales del mes (NETO desde perspectiva del CASH: rescates suman, compras restan)
  // Esto refleja el efecto real en el bolsillo del usuario
  const totalARS=sumInvCash(invsMes);
  const totalUSD=invsMes.reduce((s,m)=>s+(m.importeUSD||0)*invSignoCash(m),0);
  const cantMes=invsMes.length;
  // Rescates/cupones = INGRESO (entra plata). Compras/suscripciones = GASTO (sale plata)
  const ingresos=invsMes.filter(m=>isInvSalida(m));   // las "salidas del portfolio" son ingresos al bolsillo
  const gastosInv=invsMes.filter(m=>!isInvSalida(m)); // las "entradas al portfolio" son gastos del bolsillo
  const totalIngresos=ingresos.reduce((s,m)=>s+(m.importe||0),0);
  const totalGastos=gastosInv.reduce((s,m)=>s+(m.importe||0),0);
  const tiposMes=new Set(invsMes.map(m=>m.cat));

  // ── CHIPS ──
  const colorNeto=totalARS>=0?"positive":"negative";
  document.getElementById("inv-summary").innerHTML=`
    <div class="chip"><div class="chip-label">Balance ARS</div><div class="chip-val ${colorNeto}">${fmtTotal(totalARS)}</div></div>
    <div class="chip"><div class="chip-label">Balance USD</div><div class="chip-val ${colorNeto}">${totalUSD!==0?"USD "+totalUSD.toFixed(2):"—"}</div></div>
    <div class="chip"><div class="chip-label">Movimientos</div><div class="chip-val">${cantMes}</div></div>`;

  // ── BALANCE DEL MES (desglose por categoría y por ticker) ──
  const balanceEl=document.getElementById("inv-balance");
  if(!cantMes){
    balanceEl.innerHTML=`<p style="font-size:13px;color:var(--muted);text-align:center;padding:14px 0">Sin movimientos en ${mesLbl(ymSel)}</p>`;
  } else {
    const lblNeto=totalARS>=0?"Ingreso neto":"Gasto neto";
    let html=`<div class="seccion-label mb-6">${lblNeto} en ${mesLbl(ymSel)}</div>
      <div style="font-size:24px;font-weight:600;color:var(--${totalARS>=0?'success':'danger'});margin-bottom:6px">${fmtTotal(totalARS)}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px">
        ${cantMes} ${cantMes===1?"movimiento":"movimientos"} · ${tiposMes.size} ${tiposMes.size===1?"tipo":"tipos"}
        ${totalIngresos>0?` · 📥 Ingresos: <strong style="color:var(--success)">${fmtS(totalIngresos)}</strong>`:""}
        ${totalGastos>0?` · 📤 Gastos: <strong style="color:var(--danger)">${fmtS(totalGastos)}</strong>`:""}
      </div>`;

    // Desglose por categoría (perspectiva cash)
    const porCat={};
    invsMes.forEach(m=>{
      porCat[m.cat]=(porCat[m.cat]||0)+(m.importe||0)*invSignoCash(m);
    });
    const catEntries=Object.entries(porCat).filter(([_,v])=>v!==0).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    if(catEntries.length){
      html+=`<div class="seccion-label mb-6">Por categoría (balance)</div>`;
      const maxV=Math.max(...catEntries.map(([_,v])=>Math.abs(v)));
      html+=catEntries.map(([cat,val])=>{
        const c=val>=0?"var(--success)":"var(--danger)";
        return `<div class="bar-row" style="margin-bottom:6px">
          <div class="bar-label">◈ ${escapeHtml(cat)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(Math.abs(val)/maxV*100)}%;background:${c}"></div></div>
          <div class="bar-val" style="color:${c}">${fmtS(val)}</div>
        </div>`;
      }).join("");
    }

    // Desglose por ticker (NETO)
    const porTicker={};
    invsMes.forEach(m=>{
      const t=m.ticker||"Sin ticker";
      porTicker[t]=(porTicker[t]||0)+(m.importe||0)*invSignoCash(m);
    });
    const tickerEntries=Object.entries(porTicker).filter(([_,v])=>v!==0).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    if(tickerEntries.length>1){
      html+=`<div class="seccion-label mt-14 mb-6">Por ticker (balance)</div>`;
      const maxV=Math.max(...tickerEntries.map(([_,v])=>Math.abs(v)));
      html+=tickerEntries.map(([ticker,val])=>{
        const c=val>=0?"var(--success)":"var(--danger)";
        return `<div class="bar-row" style="margin-bottom:6px">
          <div class="bar-label">${escapeHtml(ticker)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(Math.abs(val)/maxV*100)}%;background:${c}"></div></div>
          <div class="bar-val" style="color:${c}">${fmtS(val)}</div>
        </div>`;
      }).join("");
    }
    balanceEl.innerHTML=html;
    animarNumerosDe(balanceEl);
  }

  // ── LISTA DE MOVIMIENTOS DEL MES (con editar/eliminar) ──
  // Perspectiva CASH: rescate = ingreso (verde, +), suscripción = gasto (rojo, -)
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
      const badge=esIngreso
        ?`<span class="badge badge-success">📥 INGRESO</span>`
        :`<span class="badge badge-danger">📤 GASTO</span>`;
      const amtColor=esIngreso?"var(--success)":"var(--danger)";
      return `<div class="tx-item">
        <div class="tx-icon ${esIngreso?'ingreso':'gasto'}">${esIngreso?"📥":"📤"}</div>
        <div class="tx-info">
          <div class="tx-cat">${escapeHtml(m.cat)}<span class="inv-badge">${escapeHtml(m.ticker||"?")}</span>${badge}</div>
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

  // ── CARTERA ACUMULADA (todas las inversiones, agrupadas por ticker) ──
  // Perspectiva CASH: lo que neto te dio o te costó cada posición
  const carteraEl=document.getElementById("inv-cartera");
  const allInv=movs.filter(m=>m.tipo==="Inversion");
  if(!allInv.length){
    carteraEl.innerHTML=`<p style="font-size:13px;color:var(--muted);text-align:center;padding:8px 0">Sin inversiones cargadas todavía</p>`;
  } else {
    const cartera={};
    allInv.forEach(m=>{
      const t=m.ticker||"Sin ticker";
      const sg=invSignoCash(m);
      if(!cartera[t]) cartera[t]={ticker:t, ars:0, usd:0, cat:m.cat, count:0};
      cartera[t].ars+=(m.importe||0)*sg;
      cartera[t].usd+=(m.importeUSD||0)*sg;
      cartera[t].count++;
    });
    const items=Object.values(cartera).sort((a,b)=>Math.abs(b.ars)-Math.abs(a.ars));
    let html=`<div class="seccion-label mb-8">${items.length} ${items.length===1?"posición":"posiciones"} · balance acumulado</div>`;
    html+=items.map(p=>{
      const arsColor=p.ars>=0?"var(--success)":"var(--danger)";
      const tickerEsc=attrJS(p.ticker);
      return `<div role="button" tabindex="0" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="showInstrumentoDetail(${tickerEsc})">
        <div class="u-flex1 u-min0">
          <div class="txt-md txt-strong">${escapeHtml(p.ticker)}</div>
          <div class="txt-xs txt-muted">${escapeHtml(p.cat)} · ${p.count} ${p.count===1?"mov":"movs"}</div>
        </div>
        <div style="text-align:right">
          ${p.ars!==0?`<div style="font-size:13px;font-weight:600;color:${arsColor}">${fmtS(p.ars)}</div>`:""}
          ${p.usd!==0?`<div style="font-size:11px;color:${p.usd>=0?'var(--muted)':'var(--danger)'}">USD ${p.usd.toFixed(2)}</div>`:""}
        </div>
      </div>`;
    }).join("");
    carteraEl.innerHTML=html;
  }

  // ── HISTÓRICO TOTAL ──
  renderInvHistorico();
}

// Renderiza el card de histórico total: KPIs, gráfico mensual y top tickers
function renderInvHistorico(){
  const allInv=movs.filter(m=>m.tipo==="Inversion");
  const kpisEl=document.getElementById("inv-historico-kpis");
  const canvas=document.getElementById("chart-inv-historico");
  const topEl=document.getElementById("inv-top-tickers");

  if(!allInv.length){
    kpisEl.innerHTML=`<div class="chip u-flex1"><div class="chip-label" style="text-align:center">Sin inversiones cargadas</div></div>`;
    if(chartInvHistoricoInstance){ chartInvHistoricoInstance.destroy(); chartInvHistoricoInstance=null; }
    topEl.innerHTML="";
    return;
  }

  // KPIs totales acumulados (perspectiva CASH: rescates - compras = balance del bolsillo)
  const totalARS=sumInvCash(allInv);
  const totalUSD=allInv.reduce((s,m)=>s+(m.importeUSD||0)*invSignoCash(m),0);
  const totalIngresosARS=allInv.filter(m=>isInvSalida(m)).reduce((s,m)=>s+(m.importe||0),0);
  const totalGastosARS=allInv.filter(m=>!isInvSalida(m)).reduce((s,m)=>s+(m.importe||0),0);
  const colorNeto=totalARS>=0?"positive":"negative";
  kpisEl.innerHTML=`
    <div class="chip"><div class="chip-label">Balance</div><div class="chip-val ${colorNeto}">${fmtTotal(totalARS)}</div></div>
    <div class="chip"><div class="chip-label">Ingresos</div><div class="chip-val positive">${fmtTotal(totalIngresosARS)}</div></div>
    <div class="chip"><div class="chip-label">Gastos</div><div class="chip-val negative">${fmtTotal(totalGastosARS)}</div></div>`;

  // Agrupado por mes (curva acumulada en perspectiva cash)
  const porMes={};
  allInv.forEach(m=>{
    const ym=String(m.fecha||"").slice(0,7);
    if(!ym||ym.length!==7) return;
    porMes[ym]=(porMes[ym]||0)+(m.importe||0)*invSignoCash(m);
  });
  const mesesOrdenados=Object.keys(porMes).sort();
  if(mesesOrdenados.length){
    const labels=mesesOrdenados.map(ym=>{
      const [y,m]=ym.split("-");
      return m+"/"+y.slice(2);
    });
    // Acumulado mes a mes (curva del balance cash)
    let acum=0;
    const values=mesesOrdenados.map(ym=>{
      acum+=porMes[ym];
      return Math.round(acum*100)/100;
    });
    renderChartInvHistoricoBI(labels, values);
  }

  // Top 5 tickers por monto neto (perspectiva cash)
  const porTicker={};
  allInv.forEach(m=>{
    const t=m.ticker||"Sin ticker";
    const sg=invSignoCash(m);
    if(!porTicker[t]) porTicker[t]={ars:0,usd:0,count:0,cat:m.cat};
    porTicker[t].ars+=(m.importe||0)*sg;
    porTicker[t].usd+=(m.importeUSD||0)*sg;
    porTicker[t].count++;
  });
  const topItems=Object.entries(porTicker)
    .map(([ticker,d])=>({ticker,...d}))
    .filter(x=>Math.abs(x.ars)>0)
    .sort((a,b)=>Math.abs(b.ars)-Math.abs(a.ars))
    .slice(0,5);
  if(topItems.length){
    const maxV=Math.max(...topItems.map(t=>Math.abs(t.ars)));
    let html=`<div class="seccion-label mb-6">Top tickers (balance)</div>`;
    html+=topItems.map(p=>{
      const c=p.ars>=0?"var(--success)":"var(--danger)";
      return `<div class="bar-row" style="margin-bottom:6px">
        <div class="bar-label">${escapeHtml(p.ticker)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(Math.abs(p.ars)/maxV*100)}%;background:${c}"></div></div>
        <div class="bar-val" style="color:${c}">${fmtAbbr(p.ars)}</div>
      </div>`;
    }).join("");
    topEl.innerHTML=html;
  } else {
    topEl.innerHTML="";
  }
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

