// ═══════════════════════════════════════════
// DASHBOARD CON CHARTS
// ═══════════════════════════════════════════
// Punto de entrada de la pestaña: pinta el resumen narrativo (siempre) y, si "Ver el año
// completo" está abierto, también ese tablero — por ejemplo cuando Chart.js termina de cargar
// tarde (ver el listener de window.load en main.js) y hay que repintar lo que esté a la vista.
function renderDash(){
  renderDashResumen();
  const yearFull=document.getElementById("dash-year-full");
  if(yearFull && yearFull.style.display!=="none") renderDashYearCompleto();
}

// Arma el tablero de siempre: pestañas de año, alertas, gráfico, categorías, cuentas, USD.
// Separado de openDashYearCompleto() para poder repintarlo sin reabrir la subpágina (ver
// renderDash arriba).
function renderDashYearCompleto(){
  renderAlertas();
  const histYears = [...new Set(HIST_MONTHLY.map(d=>parseInt(d.mes.slice(0,4))))];
  const liveYears = [...new Set(movs.map(m=>parseInt(String(m.fecha||"").slice(0,4))).filter(y=>y>2000))];
  const years = [...new Set([...histYears,...liveYears])].sort();
  if(!years.includes(dashYear)) dashYear = years[years.length-1];
  const tabsEl=document.getElementById("year-tabs");
  if(tabsEl) tabsEl.innerHTML=years.map(y=>
    `<div role="button" tabindex="0" class="year-tab${y===dashYear?" active":""}" onclick="setDashYear(${y},this)">${y}</div>`
  ).join("");
  renderDashYear();
}
function setDashYear(y,el){
  dashYear=y;
  document.querySelectorAll(".year-tab").forEach(t=>t.classList.remove("active"));
  el.classList.add("active");
  renderDashYear();
}
// "Ver el año completo" se arma recién al abrirse (no en cada renderDash): así el canvas de
// Chart.js no mide 0×0 por estar con display:none cuando se crea el gráfico.
function openDashYearCompleto(){
  document.getElementById("dash-resumen").style.display="none";
  document.getElementById("dash-year-full").style.display="block";
  renderDashYearCompleto();
}
function closeDashYearCompleto(){
  document.getElementById("dash-year-full").style.display="none";
  document.getElementById("dash-resumen").style.display="block";
}

// ═══════════════════════════════════════════
// DASHBOARD NARRATIVO (handoff: opción 2a, "el mes contado en frases")
// ═══════════════════════════════════════════
// Mes que se está mirando en el resumen narrativo. Separado de dashYear (el año de "Ver el año
// completo"): son dos navegaciones independientes, una por mes y otra por año.
let dashMes = currentYM();
// Índice de la tarjeta de hallazgo abierta (null = ninguna). Una sola a la vez; cambiar de mes
// las cierra todas.
let dashInsightAbierto = null;

// Primer mes con algún movimiento cargado: marca hasta dónde se puede retroceder con ‹.
// Sin esto, "‹" dejaría ir a un 1900 vacío para siempre.
function primerMesConDatos(){
  let min=null;
  movs.forEach(m=>{
    const ym=String(m.fecha||"").slice(0,7);
    if(ym.length===7 && (!min || ym<min)) min=ym;
  });
  return min;
}

function cambiarDashMes(delta){
  const hoyYM=currentYM();
  const nuevo=addMonths(dashMes, delta);
  if(nuevo>hoyYM) return; // no se puede ir al futuro
  const primero=primerMesConDatos();
  if(delta<0 && primero && nuevo<primero) return; // nada que mostrar más atrás
  dashMes=nuevo;
  dashInsightAbierto=null;
  renderDashResumen();
  animarCambioDeMes(delta, document.getElementById("dash-insights-lista"));
}

// Promedio de un año, excluyendo el mes en curso si es el que se está mirando (está
// incompleto: contarlo distorsionaría el promedio contra el que se lo compara).
function mesesBaseDelAnio(monthlyArr, ymExcluir){
  const esActual = ymExcluir===currentYM();
  return (monthlyArr||[]).filter(d => (d.ingreso>0 || d.gasto>0) && !(esActual && d.mes===ymExcluir));
}

// Gasto de cada categoría, mes a mes, dentro de un año — misma expansión de frecuentes que usa
// getDashData (getMesMov), para que el promedio por categoría no subestime un gasto fijo que
// tiene un solo registro guardado pero cae en muchos meses.
function categoriasPorMesDelAnio(year){
  const meses12=["01","02","03","04","05","06","07","08","09","10","11","12"];
  const hastaYM=currentYM();
  const out={};
  meses12.forEach(mm=>{
    const ym=year+"-"+mm;
    if(ym>hastaYM) return;
    const porCat={};
    getMesMov(ym).forEach(m=>{
      if(m.moneda==="USD") return;
      if(esConsumo(m)) porCat[m.cat]=(porCat[m.cat]||0)+(m.importe||0);
    });
    out[ym]=porCat;
  });
  return out;
}

// Para cada categoría con gasto en `ym`, su monto del mes contra el promedio de esa misma
// categoría en el resto del año (excluyendo `ym` si es el mes en curso). Sin promedio previo
// (categoría nueva este año) no hay con qué comparar, así que queda afuera.
function desviacionCategoriasDelMes(ym){
  const year=ym.slice(0,4);
  const porMes=categoriasPorMesDelAnio(year);
  const esActual = ym===currentYM();
  const sumaCat={}, countCat={};
  Object.keys(porMes).forEach(m=>{
    if(m===ym && esActual) return;
    Object.entries(porMes[m]).forEach(([cat,val])=>{
      sumaCat[cat]=(sumaCat[cat]||0)+val;
      countCat[cat]=(countCat[cat]||0)+1;
    });
  });
  const delMes=porMes[ym]||{};
  return Object.entries(delMes).map(([cat,val])=>{
    if(!countCat[cat]) return null;
    const avg=sumaCat[cat]/countCat[cat];
    if(avg<=0) return null;
    return {cat, val, avg, ratio: val/avg};
  }).filter(Boolean);
}

// Arma una fila de barra "Mes vs Promedio" para una tarjeta de hallazgo.
function filaInsight(label, val, max, color){
  return {label, val: fmtAbbr(val), w: max>0 ? Math.round(Math.abs(val)/max*100) : 0, color};
}

// El motor de frases: arma las tarjetas de hallazgo del mes, en el orden del handoff. Cada
// regla decide sola si corresponde mostrarse; `null` la saca de la lista.
function construirInsights(ym, mesData, monthlyAnio){
  const Mes=mesLbl(ym).split(" ")[0];
  const base=mesesBaseDelAnio(monthlyAnio, ym);
  const hayProm=base.length>=2;
  const promBal=hayProm ? base.reduce((s,d)=>s+d.balance,0)/base.length : null;
  const promGas=hayProm ? base.reduce((s,d)=>s+d.gasto,0)/base.length : null;

  // Arma el cierre de la frase ("en línea con tu promedio" / "N% más|menos que X") para las
  // reglas 1 y 2. Sin promedio suficiente, no hay cierre: solo el monto.
  function cierre(val, prom, fraseNormal){
    if(!hayProm || !prom) return ".";
    const pct=Math.round((val-prom)/Math.abs(prom)*100);
    if(Math.abs(pct)<=3) return ": en línea con tu promedio.";
    return `: ${Math.abs(pct)}% ${pct>0?"más":"menos"} ${fraseNormal}`;
  }

  const out=[];

  // 1. Balance del mes
  {
    const val=mesData.balance;
    const bueno=val>=0;
    const max=Math.max(Math.abs(val), Math.abs(promBal||0));
    out.push({
      icon:"💰", bg:"var(--success-light)",
      a: bueno?"Te quedaron ":"Te faltaron ",
      b: fmtTotal(Math.abs(val)),
      bc: bueno?"var(--success)":"var(--danger)",
      c: ` en ${Mes}`+cierre(val, promBal, "que en un mes normal."),
      rows: hayProm ? [
        filaInsight(Mes, val, max, bueno?"var(--success)":"var(--danger)"),
        filaInsight("Promedio", promBal, max, `color-mix(in srgb,${bueno?"var(--success)":"var(--danger)"} 40%,var(--surface))`)
      ] : []
    });
  }

  // 2. Gastos del mes
  {
    const val=mesData.gasto;
    const max=Math.max(val, promGas||0);
    out.push({
      icon:"📤", bg:"var(--danger-light)",
      a:"Gastaste ", b: fmtTotal(val), bc:"var(--text)",
      c: cierre(val, promGas, "que tu promedio."),
      rows: hayProm ? [
        filaInsight(Mes, val, max, "var(--danger)"),
        filaInsight("Promedio", promGas, max, "color-mix(in srgb,var(--danger) 40%,var(--surface))")
      ] : []
    });
  }

  // 3 y 4. La categoría que más se desvió para arriba / para abajo (solo con promedio propio)
  if(hayProm){
    const desv=desviacionCategoriasDelMes(ym).sort((a,b)=>b.ratio-a.ratio);
    if(desv.length){
      const arriba=desv[0], abajo=desv[desv.length-1];
      if(arriba.ratio>=1.1){
        const max=Math.max(arriba.val, arriba.avg);
        out.push({
          icon:getIcon(arriba.cat,"🏷"), bg:"var(--danger-light)",
          a:`En ${arriba.cat} `, b:`gastaste ${Math.round((arriba.ratio-1)*100)}% más`, bc:"var(--danger)",
          c:" que lo habitual.",
          rows:[filaInsight(Mes, arriba.val, max, "var(--danger)"), filaInsight("Promedio", arriba.avg, max, "color-mix(in srgb,var(--danger) 40%,var(--surface))")],
          action:"Ver gastos de "+arriba.cat, actionFn:()=>irAGastosDeCategoria(ym, arriba.cat)
        });
      }
      // No hace falta descartar que sea la misma categoría que "arriba": un ratio no puede ser
      // a la vez ≥1.1 y ≤0.9, así que las dos reglas nunca eligen la misma.
      if(abajo.ratio<=0.9){
        const max=Math.max(abajo.val, abajo.avg);
        out.push({
          icon:getIcon(abajo.cat,"🏷"), bg:"var(--success-light)",
          a:`En ${abajo.cat} `, b:`gastaste ${Math.round((1-abajo.ratio)*100)}% menos`, bc:"var(--success)",
          c:" que lo habitual.",
          rows:[filaInsight(Mes, abajo.val, max, "var(--success)"), filaInsight("Promedio", abajo.avg, max, "color-mix(in srgb,var(--success) 40%,var(--surface))")]
        });
      }
    }
  }

  // 5. Mejor mes del año (con al menos 3 meses con datos, el mes mirado incluido)
  {
    const year=ym.slice(0,4);
    const conDatos=(monthlyAnio||[]).filter(d=>d.ingreso>0 || d.gasto>0);
    if(conDatos.length>=3){
      const top3=conDatos.slice().sort((a,b)=>b.balance-a.balance).slice(0,3);
      const mejor=top3[0];
      out.push({
        icon:"🏆", bg:"var(--warning-light)",
        a:`Tu mejor mes de ${year} fue `, b: mesLbl(mejor.mes).split(" ")[0], bc:"var(--text)",
        c:`: te quedaron ${fmtTotal(mejor.balance)}.`,
        rows: top3.map(d=>filaInsight(mesLbl(d.mes).split(" ")[0], d.balance, top3[0].balance, "var(--success)"))
      });
    }
  }

  // 6+. Los avisos de siempre (renderAlertas), uno por tarjeta — solo tienen sentido parado en
  // el mes en curso: alertasDelMomento() siempre mira "hoy", no el mes que se esté navegando.
  if(ym===currentYM()){
    alertasDelMomento(movs, tcs, currentYMD()).forEach(al=>{
      out.push({
        icon:al.icono, bg:"var(--warning-light)",
        a:"", b:al.titulo, bc:"var(--warning)", c:"",
        rows:[], detalle:al.detalle,
        action:"Ir a Movimientos", actionFn:irAMovimientos
      });
    });
  }

  return out;
}

function irAGastosDeCategoria(ym, cat){
  mesActual=ym;
  filtroTarjeta="";
  filtro="Gasto";
  filtroCategoria=cat;
  showPage('mov', document.querySelector('.nav-btn[onclick*="\'mov\'"]'));
  renderMovs();
}
function irAMovimientos(){
  mesActual=currentYM();
  filtroTarjeta=""; filtroCategoria=""; filtro="Todos";
  showPage('mov', document.querySelector('.nav-btn[onclick*="\'mov\'"]'));
  renderMovs();
}

function construirInsightHTML(it, i){
  const bodyRows=(it.rows||[]).map(r=>`
    <div class="dash-insight-row">
      <span class="dash-insight-row-label">${escapeHtml(r.label)}</span>
      <div class="dash-insight-row-track"><div class="dash-insight-row-fill" data-w="${r.w}" style="width:0%;background:${r.color}"></div></div>
      <span class="dash-insight-row-val">${r.val}</span>
    </div>`).join("");
  const detalleHTML = it.detalle ? `<div class="dash-insight-detalle">${escapeHtml(it.detalle)}</div>` : "";
  const accionHTML = it.action ? `<span class="dash-insight-action" onclick="event.stopPropagation();dashInsightAccion(${i})">${escapeHtml(it.action)} ›</span>` : "";
  return `<div class="dash-insight-card" role="button" tabindex="0" aria-expanded="false" onclick="toggleDashInsight(${i})">
    <div class="dash-insight-top">
      <span class="dash-insight-icon" style="background:${it.bg}">${it.icon}</span>
      <span class="dash-insight-frase">${escapeHtml(it.a)}<strong style="color:${it.bc}">${escapeHtml(it.b)}</strong>${escapeHtml(it.c)}</span>
      <span class="dash-insight-chev">▾</span>
    </div>
    <div class="dash-insight-body-wrap">
      <div class="dash-insight-body">${bodyRows}${detalleHTML}${accionHTML}</div>
    </div>
  </div>`;
}

// Las acciones de las tarjetas viven acá, indexadas por posición en la lista actual: el HTML
// generado no puede guardar una función directamente en un atributo onclick.
let dashInsightsActuales=[];
function dashInsightAccion(i){
  const it=dashInsightsActuales[i];
  if(it && it.actionFn) it.actionFn();
}

// Togglea UNA tarjeta sin re-renderizar la lista entera: así grid-template-rows anima de
// verdad (0fr→1fr) y las barras crecen desde 0, en vez de aparecer ya abiertas de un render
// nuevo que no tiene estado previo del que partir.
function toggleDashInsight(i){
  dashInsightAbierto = (dashInsightAbierto===i) ? null : i;
  document.querySelectorAll("#dash-insights-lista .dash-insight-card").forEach((card,idx)=>{
    const abierta=idx===dashInsightAbierto;
    card.setAttribute("aria-expanded", String(abierta));
    const wrap=card.querySelector(".dash-insight-body-wrap");
    if(wrap) wrap.style.gridTemplateRows = abierta ? "1fr" : "0fr";
    const chev=card.querySelector(".dash-insight-chev");
    if(chev) chev.textContent = abierta ? "▴" : "▾";
    card.querySelectorAll(".dash-insight-row-fill").forEach(f=>{
      f.style.width = abierta ? (f.dataset.w||"0")+"%" : "0%";
    });
  });
}

function renderDashResumen(){
  const ym=dashMes;
  const hoyYM=currentYM();
  const year=ym.slice(0,4);

  const lblEl=document.getElementById("dash-mes-label");
  if(lblEl) lblEl.textContent=mesLbl(ym);
  const primero=primerMesConDatos();
  const btnPrev=document.getElementById("dash-mes-prev");
  const btnNext=document.getElementById("dash-mes-next");
  if(btnPrev) btnPrev.style.color = (primero && addMonths(ym,-1)<primero) ? "var(--border)" : "var(--muted)";
  if(btnNext) btnNext.style.color = (ym>=hoyYM) ? "var(--border)" : "var(--muted)";

  const {monthly}=getDashData(year);
  const mesData=monthly.find(d=>d.mes===ym);
  const headlineEl=document.getElementById("dash-headline");
  const subEl=document.getElementById("dash-headline-sub");
  const listaEl=document.getElementById("dash-insights-lista");
  if(!mesData){
    if(headlineEl) headlineEl.textContent=`No hay movimientos cargados en ${mesLbl(ym)}.`;
    if(subEl) subEl.textContent="";
    if(listaEl) listaEl.innerHTML=`<a href="#" class="dash-year-link" onclick="event.preventDefault();openDashYearCompleto()">Ver el año completo ›</a>`;
    dashInsightsActuales=[];
    return;
  }

  const esActual = ym===hoyYM;
  const bal=mesData.balance;
  const Mes=mesLbl(ym).split(" ")[0];
  if(headlineEl) headlineEl.textContent = bal>=0
    ? `${Mes} ${esActual?"viene":"cerró"} en positivo: te quedaron ${fmtAbbr(bal)}.`
    : `${Mes} ${esActual?"viene":"cerró"} en negativo: gastaste ${fmtAbbr(-bal)} más de lo que entró.`;
  if(subEl) subEl.textContent=`Entraron ${fmtAbbr(mesData.ingreso)} · salieron ${fmtAbbr(mesData.gasto)}`;

  dashInsightsActuales=construirInsights(ym, mesData, monthly);
  dashInsightAbierto=null;
  if(listaEl){
    listaEl.innerHTML=dashInsightsActuales.map((it,i)=>construirInsightHTML(it,i)).join("")
      + `<a href="#" class="dash-year-link" onclick="event.preventDefault();openDashYearCompleto()">Ver el año completo ›</a>`;
  }
}

// ═══════════════════════════════════════════
// ANALÍTICA: ajuste por inflación (comparativa interanual)
// ═══════════════════════════════════════════

// Índices de inflación mensual (IPC nacional, INDEC) — variación % respecto al mes anterior.
// Esta tabla es solo el PISO: la serie de verdad se baja o se pega desde Configuración y se
// guarda aparte (ver js/inflacion.js). tablaInflacion() pone la descargada por encima de
// esta, así que borrar la descargada deja la app como estaba y nunca peor.
// ⚠️ DICCIONARIO INCOMPLETO A PROPÓSITO: solo se cargaron los puntos que se pudieron verificar
// con fuentes públicas al momento de escribir esto (sept. 2026). Para que el ajuste por
// inflación sea preciso, hay que completar el resto mes a mes con datos oficiales del INDEC
// (https://www.indec.gob.ar/) o un mirror confiable como https://ipc.com.ar/.
// Los meses sin dato se tratan como 0% (no se ajustan) — mejor subestimar la inflación real
// que inventar un número y mostrar una comparativa falsa en una app de plata real.
const INFLACION_MENSUAL_ARS = {
  "2025-06": 1.6,
  "2025-12": 2.8,
  "2026-03": 3.4,
  "2026-07": 2.11
  // completar con el resto de los meses (fuente: INDEC IPC nacional, variación mensual)
};

// Deflacta (ajusta a valor presente) un monto histórico en ARS de ymOrigen a ymDestino,
// encadenando —no sumando— la inflación mensual mes a mes entre ambas fechas.
function deflactarARS(monto, ymOrigen, ymDestino){
  if(!monto || !ymOrigen || !ymDestino || ymOrigen>=ymDestino) return monto;
  // Se resuelve UNA vez y no dentro del while: tablaInflacion() fusiona dos objetos.
  const tabla=tablaInflacion();
  let factor=1, ym=ymOrigen;
  let guard=0;
  while(ym<ymDestino && guard<600){
    guard++;
    ym=addMonths(ym,1);
    const infl=tabla[ym];
    if(infl) factor*=(1+infl/100);
  }
  return Math.round(monto*factor*100)/100;
}

// deflactarARS() trata cada mes SIN dato como 0% de inflación, así que con la tabla
// incompleta (hoy solo hay 4 meses cargados) el resultado no subestima un poco: se queda
// muy corto. Ejemplo real, un año con inflación real del 100%: la app mostraba "▲ 84%" para
// un gasto que en términos reales fue IDÉNTICO al del año pasado.
// Esta función dice si el tramo ymOrigen→ymDestino tiene TODOS los meses cargados. Se usa
// para no mostrar ningún porcentaje cuando el ajuste no es confiable — es mejor no decir
// nada que mostrar un número que parece preciso y no lo es.
function inflacionCompleta(ymOrigen, ymDestino){
  if(!ymOrigen || !ymDestino || ymOrigen>=ymDestino) return true;
  const tabla=tablaInflacion();
  let ym=ymOrigen, guard=0;
  while(ym<ymDestino && guard<600){
    guard++;
    ym=addMonths(ym,1);
    if(tabla[ym]===undefined) return false;
  }
  return true;
}

function getDashData(year){
  // Merge: historical hardcoded data + live imported movs
  const yrStr = String(year);
  // Regla de balance — la misma que totalesDePlata() en estado-categorias.js:
  // - INGRESOS = ingresos puros + la ganancia de inversión reconocida en el mes
  // - GASTOS   = consumo. Los depósitos al fondo quedan afuera (guardar no es gastar); los
  //              retiros quedan adentro (gastar del fondo sí es consumo).
  // - Las inversiones NO son ingreso ni gasto: son la misma plata cambiando de lugar. Contarlas
  //   enteras hacía que un mes con un rescate grande figurara como el mejor del año.
  const meses12=["01","02","03","04","05","06","07","08","09","10","11","12"];
  const liveByMes = {};
  let hayDatosLive = false;
  // Los gastos frecuentes se proyectan a los meses que vienen, pero los ingresos de un mes que
  // todavía no pasó no están cargados. Contar esos meses es garantía de error: sumaban tres meses
  // de gastos contra cero ingresos y daban vuelta el signo del año (2026 pasaba de +$1,84M a
  // −$1,54M). Un mes que no ocurrió no entra en el balance del año.
  const hastaYM = currentYM();
  meses12.forEach(mm=>{
    const ym = yrStr+"-"+mm;
    if(ym > hastaYM) return;
    const movsDelMes = getMesMov(ym);
    if(movsDelMes.length) hayDatosLive = true;
    liveByMes[ym] = {mes:ym, ingreso:0, gasto:0};
    movsDelMes.forEach(m=>{
      if(m.moneda==="USD") return; // No mezclar USD con totales ARS
      if(m.tipo==="Ingreso"){
        liveByMes[ym].ingreso += (m.importe||0);
      } else if(esConsumo(m)){
        // Consumo. Lo que fue a parar al fondo no entra: sigue siendo tuyo.
        liveByMes[ym].gasto += (m.importe||0);
      }
      // Las inversiones no caen en ninguna de las dos: solo su resultado, que se suma abajo.
    });
    const g=gananciaInvDelMes(ym).ars;
    if(g>0) liveByMes[ym].ingreso += g;
    else if(g<0) liveByMes[ym].gasto += -g;
  });

  // Merge with hist: live takes priority si hay datos del año
  let merged;
  if(hayDatosLive){
    merged = Object.values(liveByMes).map(d=>({
      mes:d.mes,
      ingreso:Math.round(d.ingreso*100)/100,
      gasto:Math.round(d.gasto*100)/100,
      balance:Math.round((d.ingreso-d.gasto)*100)/100
    })).sort((a,b)=>a.mes.localeCompare(b.mes));
  } else {
    // Fall back a hardcoded (vacío en versión actual)
    merged = HIST_MONTHLY.filter(d=>d.mes.startsWith(yrStr));
  }

  // Desglose por categoría usando los mismos movs expandidos
  // Gastos por categoría: gastos puros + compras/suscripciones de inversión (agrupadas)
  // Ingresos por categoría: ingresos puros + la ganancia de inversión, agrupada como "Resultado inversiones"
  let catData = {};
  let catIngreso = {};
  if(hayDatosLive){
    meses12.forEach(mm=>{
      const ym = yrStr+"-"+mm;
      getMesMov(ym).forEach(m=>{
        if(m.moneda==="USD") return;
        if(esConsumo(m)){
          // El consumo entra en su categoría, incluido lo pagado con ahorros. Lo que fue al
          // fondo no: guardar plata no es un gasto, y mezclarlo acá haría que "Ahorro" apareciera
          // como una de tus mayores categorías de gasto.
          catData[m.cat] = (catData[m.cat]||0) + (m.importe||0);
        } else if(m.tipo==="Ingreso"){
          catIngreso[m.cat] = (catIngreso[m.cat]||0) + (m.importe||0);
        }
        // Las inversiones ya no arman categorías propias de ingreso y gasto: lo que aparece es
        // su resultado, abajo, porque los flujos brutos eran la misma plata yendo y viniendo.
      });
      const g=gananciaInvDelMes(ym).ars;
      if(g>0) catIngreso["Resultado inversiones"] = (catIngreso["Resultado inversiones"]||0) + g;
      else if(g<0) catData["Pérdida en inversiones"] = (catData["Pérdida en inversiones"]||0) + (-g);
    });
    Object.keys(catData).forEach(k=>catData[k]=Math.round(catData[k]*100)/100);
    Object.keys(catIngreso).forEach(k=>catIngreso[k]=Math.round(catIngreso[k]*100)/100);
  } else {
    catData = HIST_CAT_YEAR[yrStr]||{};
  }

  return {monthly: merged, cats: catData, catsIngreso: catIngreso};
}

function renderDashYear(){
  const catData2 = getDashData(dashYear);
  const {monthly: yearData, cats: catData} = catData2;
  const totalIng=yearData.reduce((s,d)=>s+d.ingreso,0);
  const totalGas=yearData.reduce((s,d)=>s+d.gasto,0);
  const bal=totalIng-totalGas;

  document.getElementById("dash-kpis").innerHTML=`
    <div class="chip"><div class="chip-label">Ingresos</div><div class="chip-val positive" id="chip-dash-ing">${fmtTotal(0)}</div></div>
    <div class="chip"><div class="chip-label">Gastos</div><div class="chip-val negative" id="chip-dash-gas">${fmtTotal(0)}</div></div>
    <div class="chip"><div class="chip-label">Balance</div><div class="chip-val ${bal>=0?"positive":"negative"}" id="chip-dash-bal">${fmtTotal(0)}</div></div>`;
  animarNumero(document.getElementById("chip-dash-ing"), totalIng, 700, fmtTotal);
  animarNumero(document.getElementById("chip-dash-gas"), totalGas, 700, fmtTotal);
  animarNumero(document.getElementById("chip-dash-bal"), bal, 700, fmtTotal);

  // Reset detalles al cambiar de año
  document.getElementById("dash-detail").innerHTML="Tocá un mes para ver el detalle";
  const promEl=document.getElementById("dash-promedio");
  if(promEl) promEl.innerHTML=promedioMensualHTML(yearData);

  renderChartMensualBI(yearData);

  const sorted=Object.entries(catData).sort((a,b)=>b[1]-a[1]);
  const maxVal=sorted[0]?sorted[0][1]:1;
  // Datos del año anterior para comparativa
  const yearPrev=String(parseInt(dashYear)-1);
  const {cats: catDataPrev}=getDashData(yearPrev);
  const hayGastosAnioAnterior=Object.keys(catDataPrev).length>0;
  // Un solo cálculo para las 10 categorías: el tramo a deflactar es siempre el mismo
  // (mitad de un año a mitad del otro), así que alcanza o falta dato para todas por igual.
  const inflacionOk=inflacionCompleta(yearPrev+"-07", dashYear+"-07");
  document.getElementById("dash-bars-gasto").innerHTML=sorted.length
    ? sorted.slice(0,10).map(([cat,val])=>{
        // Deflactamos el año anterior a valor presente (ancla: mitad de cada año) antes de
        // comparar, así el % no confunde inflación con gasto real — ver INFLACION_MENSUAL_ARS.
        const valPrev=deflactarARS(catDataPrev[cat]||0, yearPrev+"-07", dashYear+"-07");
        const comp=compAnioAnterior(val, valPrev, hayGastosAnioAnterior, false, inflacionOk);
        return `<div role="button" tabindex="0" class="bar-row" style="cursor:pointer" onclick="showCatDetail(${attrJS(cat)})">
          <div class="bar-label">${getIcon(cat,"")} ${escapeHtml(cat)}${comp}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(val/maxVal*100)}%;background:#a32d2d"></div></div>
          <div class="bar-val">${fmtAbbr(val)}</div>
        </div>`;
      }).join("")
    : `<p class="txt-md txt-muted">Sin datos para ${dashYear}</p>`;
  // ── INGRESOS POR CATEGORÍA (mismo estilo que gastos) ──
  const sortedIng=Object.entries(catData2.catsIngreso||{}).sort((a,b)=>b[1]-a[1]);
  const maxValIng=sortedIng[0]?sortedIng[0][1]:1;
  const catIngresoPrev=getDashData(yearPrev).catsIngreso||{};
  const hayIngresosAnioAnterior=Object.keys(catIngresoPrev).length>0;
  // Mismo tramo que arriba: mismo resultado. Se recalcula (es barato) para no acoplar
  // esta sección a una variable de la de gastos.
  const inflacionOkIng=inflacionCompleta(yearPrev+"-07", dashYear+"-07");
  document.getElementById("dash-bars-ingreso").innerHTML=sortedIng.length
    ? sortedIng.slice(0,10).map(([cat,val])=>{
        const valPrev=deflactarARS(catIngresoPrev[cat]||0, yearPrev+"-07", dashYear+"-07");
        // En ingresos subir es bueno, al revés que en gastos.
        const comp=compAnioAnterior(val, valPrev, hayIngresosAnioAnterior, true, inflacionOkIng);
        return `<div role="button" tabindex="0" class="bar-row" style="cursor:pointer" onclick="showCatDetail(${attrJS(cat)},'Ingreso')">
          <div class="bar-label">${getIcon(cat,"")} ${escapeHtml(cat)}${comp}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(val/maxValIng*100)}%;background:#2d7a3a"></div></div>
          <div class="bar-val">${fmtAbbr(val)}</div>
        </div>`;
      }).join("")
    : `<p class="txt-md txt-muted">Sin ingresos para ${dashYear}</p>`;
  renderDashCuentas();
}

// Arma la comparativa contra el año anterior que va al lado de la categoría.
// "nuevo" solo tiene sentido si HAY un año anterior con datos: durante el primer año de uso
// salía en todas las categorías a la vez, así que no informaba nada — solo hacía ruido.
// `bueno` dice de qué color pintar una suba: en gastos subir es malo, en ingresos es bueno.
// `datosInflacionCompletos` viene de inflacionCompleta(): si falta algún mes en la tabla de
// INFLACION_MENSUAL_ARS, el valor deflactado subestima la inflación real y el % que saldría
// de compararlo puede estar muy lejos de la realidad (visto: "▲ 84%" para un gasto que en
// términos reales fue igual al del año pasado). Mejor no mostrar nada que mostrar un número
// que parece preciso y no lo es.
function compAnioAnterior(val, valPrev, hayAnioAnterior, subirEsBueno, datosInflacionCompletos){
  if(valPrev>0){
    if(!datosInflacionCompletos) return "";
    const pct=Math.round((val-valPrev)/valPrev*100);
    if(Math.abs(pct)<5) return "";   // ruido: no vale la pena mostrarlo
    const sube=pct>0;
    const color=(sube===!!subirEsBueno)?"var(--success)":"var(--danger)";
    return `<span class="comp-anio" style="color:${color}">${sube?"▲":"▼"} ${Math.abs(pct)}%</span>`;
  }
  if(val>0 && hayAnioAnterior) return `<span class="comp-anio txt-muted">nuevo</span>`;
  return "";
}

// Renderiza el flujo por cuenta del año actual del dashboard
function renderDashCuentas(){
  const el=document.getElementById("dash-cuentas");
  if(!el) return;
  // Construir la lista de movimientos del año usando getMesMov mes a mes.
  // Eso respeta mesInicio/mesFin de los frecuentes (un frecuente dado de baja NO cuenta).
  const meses12=["01","02","03","04","05","06","07","08","09","10","11","12"];
  const movsAnio=[];
  meses12.forEach(mm=>{
    const ym=String(dashYear)+"-"+mm;
    movsAnio.push(...getMesMov(ym));
  });
  if(!movsAnio.length){
    el.innerHTML=`<p class="txt-md txt-muted">Sin datos para ${dashYear}.</p>`;
    return;
  }
  // Agrupar por cuenta (excluir USD del cálculo ARS para no mezclar monedas)
  const porCuenta={};
  movsAnio.forEach(m=>{
    if(m.moneda==="USD") return; // los USD se ven en otra card
    const c=m.cuenta||"Sin cuenta";
    if(!porCuenta[c]) porCuenta[c]={ing:0,gas:0,count:0};
    // Misma regla que el balance: guardar no es gastar, y una inversión no es ingreso ni gasto.
    if(m.tipo==="Ingreso") porCuenta[c].ing+=(m.importe||0);
    else if(esConsumo(m)) porCuenta[c].gas+=(m.importe||0);
    porCuenta[c].count++;
  });
  const cuentas=Object.entries(porCuenta)
    .map(([c,d])=>({cuenta:c, ...d, balance: d.ing-d.gas}))
    .filter(c=>c.count>0)
    .sort((a,b)=>Math.abs(b.balance)-Math.abs(a.balance));
  if(!cuentas.length){
    el.innerHTML=`<p class="txt-md txt-muted">Sin movimientos con cuenta asignada.</p>`;
    return;
  }
  el.innerHTML=cuentas.map(c=>{
    const balColor=c.balance>=0?"var(--success)":"var(--danger)";
    const sign=c.balance>=0?"+":"";
    const cuentaEsc=attrJS(c.cuenta);
    return `<div role="button" tabindex="0" style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="showCuentaDetail(${cuentaEsc})">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div class="txt-md txt-strong">💳 ${escapeHtml(c.cuenta)}</div>
        <div style="font-size:13px;font-weight:600;color:${balColor}">${sign}${fmtS(c.balance)}</div>
      </div>
      <div class="txt-xs txt-muted">
        Ingresos: <span style="color:var(--success)">${fmtAbbr(c.ing)}</span>
        · Gastos: <span style="color:var(--danger)">${fmtAbbr(c.gas)}</span>
        · ${c.count} movs
      </div>
    </div>`;
  }).join("");
  renderDashUSD();
}

// ═══════════════════════════════════════════
// FLUJO USD DEL AÑO
// ═══════════════════════════════════════════
// Junta TODO lo que movés en dólares en un año: billete (Ingreso/Gasto), inversiones y
// gastos de tarjeta en USD. Función pura (no toca el DOM) para poder probarla: la cuenta
// de acá es la que antes daba mal.
//
// La regla de la plata es la misma que en el resto de la app (totalesDePlata):
//   neto = ingresos + retiros del fondo − gastos − compras de inversión + rescates − tarjeta
// `gastos` ya incluye los depósitos al fondo Y las compras pagadas con plata del fondo,
// porque los dos son esGasto(). Por eso los retiros se SUMAN de vuelta: si no, una compra
// pagada con dólares del fondo se descontaba dos veces (era el bug: una compra de USD 500
// hacía figurar un saldo de USD −1000).
function resumenUSDdelAnio(lista, anio){
  const yrStr=String(anio);
  const delAnio=(lista||[]).filter(m=>String(m.fecha||"").startsWith(yrStr));

  // ── Billete: Ingreso/Gasto cargados en USD ──
  const movsUSD=delAnio.filter(m=>m.tipo!=="Inversion" && m.moneda==="USD" && (m.importeOrig||0)>0);
  const ing=movsUSD.filter(m=>m.tipo==="Ingreso").reduce((s,m)=>s+m.importeOrig,0);
  const aho=movsUSD.filter(esDepositoAhorro).reduce((s,m)=>s+m.importeOrig,0);
  const ret=movsUSD.filter(esRetiroAhorro).reduce((s,m)=>s+m.importeOrig,0);
  const gasTotal=movsUSD.filter(esGasto).reduce((s,m)=>s+m.importeOrig,0);
  // Gasto "común": ni depósito al fondo ni compra pagada con plata del fondo. Se separa para
  // que las líneas del desglose no se pisen entre ellas y sumen exactamente el neto.
  const gasComun=gasTotal-aho-ret;

  // ── Inversiones en USD ──
  const invUSD=delAnio.filter(m=>m.tipo==="Inversion" && (m.importeUSD||0)>0);
  const invEntrada=invUSD.filter(m=>isInvSalida(m)).reduce((s,m)=>s+m.importeUSD,0);
  const invSalida=invUSD.filter(m=>!isInvSalida(m)).reduce((s,m)=>s+m.importeUSD,0);

  // ── Tarjeta en USD (cuotas y gastos fijos, expandidos mes a mes) ──
  const tcMovs=[];
  for(let i=1;i<=12;i++){
    const ym=yrStr+"-"+String(i).padStart(2,"0");
    getTcMovsEnMes(ym).forEach(t=>{ if(t.moneda==="USD") tcMovs.push(t); });
  }
  const tcUSD=tcMovs.reduce((s,t)=>s+(t.importe||0),0);

  // ── La lista de movimientos, que es lo que permite auditar el número ──
  // `efecto`: +1 entra a tu mano, -1 sale, 0 no cambia nada (una compra pagada con dólares
  // del fondo: salen del fondo y se gastan en el mismo acto).
  const movimientos=[];
  movsUSD.forEach(m=>{
    let etiqueta, efecto;
    if(m.tipo==="Ingreso"){ etiqueta="Ingreso"; efecto=1; }
    else if(esDepositoAhorro(m)){ etiqueta="Al fondo de ahorro"; efecto=-1; }
    else if(esRetiroAhorro(m)){ etiqueta="Pagado con el fondo"; efecto=0; }
    else { etiqueta="Gasto"; efecto=-1; }
    movimientos.push({fecha:m.fecha, desc:m.nota||m.cat||"(sin descripción)", cat:m.cat,
                      etiqueta, efecto, monto:m.importeOrig});
  });
  invUSD.forEach(m=>{
    const entra=isInvSalida(m);
    movimientos.push({fecha:m.fecha, desc:m.nota||m.subcat||m.cat||"Inversión", cat:m.cat,
                      etiqueta: entra?"Rescate":"Compra de inversión", efecto: entra?1:-1,
                      monto:m.importeUSD});
  });
  tcMovs.forEach(t=>{
    const tag=t.frecuente?"Tarjeta · mensual fijo":`Tarjeta · cuota ${t.nCuota}/${t.cuotasTotal}`;
    movimientos.push({fecha:t.fecha, desc:t.desc||"(sin descripción)", cat:t.cat,
                      etiqueta:tag, efecto:-1, monto:t.importe||0});
  });
  movimientos.sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));

  return {
    ing, gasComun, aho, ret, gasTotal, invEntrada, invSalida, tcUSD,
    neto: Math.round((ing + ret + invEntrada - gasTotal - invSalida - tcUSD)*100)/100,
    movimientos
  };
}

// Si la lista de movimientos USD está abierta. Vive afuera del render porque cada toque
// vuelve a dibujar la card entera.
let usdListaAbierta=false;
function toggleUsdLista(){ usdListaAbierta=!usdListaAbierta; renderDashUSD(); }

// Renderiza el flujo USD del año seleccionado en el dashboard
function renderDashUSD(){
  const card=document.getElementById("dash-usd-card");
  const el=document.getElementById("dash-usd");
  if(!card||!el) return;
  const r=resumenUSDdelAnio(movs, dashYear);
  if(!r.movimientos.length){card.style.display="none";return;}
  card.style.display="block";

  const netoColor=r.neto>=0?"var(--success)":"var(--danger)";
  let html=`<div class="inset">
    <div class="seccion-label">Saldo neto USD ${dashYear}</div>
    <div style="font-size:22px;font-weight:600;color:${netoColor};margin-top:3px">${r.neto>=0?"+":""}USD ${r.neto.toFixed(2)}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:3px">Lo que te entró menos lo que se te fue de la mano</div>
  </div>`;

  // Cada línea es una porción DISTINTA de la plata: las seis suman exactamente el neto de
  // arriba. Antes "Gastos" incluía lo ahorrado y lo pagado con el fondo, así que los mismos
  // dólares aparecían en dos renglones.
  const items=[
    {label:"📥 Ingresos",                val:r.ing,        color:"var(--success)", sign:"+"},
    {label:"📈 Rescates de inversión",   val:r.invEntrada, color:"var(--success)", sign:"+"},
    {label:"📤 Gastos",                  val:r.gasComun,   color:"var(--danger)",  sign:"-"},
    {label:"🏦 Pasado al fondo de ahorro",val:r.aho,       color:"var(--save)",    sign:"-"},
    {label:"📉 Compras de inversión",    val:r.invSalida,  color:"var(--danger)",  sign:"-"},
    {label:"💳 Gastos con tarjeta",      val:r.tcUSD,      color:"var(--danger)",  sign:"-"}
  ].filter(x=>x.val>0);
  items.forEach(it=>{
    html+=`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
      <span>${it.label}</span>
      <strong style="color:${it.color}">${it.sign}USD ${it.val.toFixed(2)}</strong>
    </div>`;
  });

  // Las compras pagadas con dólares del fondo no mueven el saldo a mano (salen del fondo y
  // se gastan en el mismo acto), así que no van arriba — pero sí son plata que se fue, y
  // callarlas sería peor que mostrarlas.
  if(r.ret>0){
    html+=`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
      <span>💸 Pagado con dólares del fondo</span>
      <strong style="color:var(--save)">USD ${r.ret.toFixed(2)}</strong>
    </div>
    <div class="txt-micro txt-muted" style="margin-top:4px">No suma ni resta al saldo de arriba: esos dólares salieron del fondo y se gastaron en el mismo movimiento.</div>`;
  }

  // ── La lista, que es lo que permite ver de dónde sale cada número ──
  const n=r.movimientos.length;
  html+=`<div role="button" tabindex="0" class="mt-14" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:8px 0"
       aria-expanded="${usdListaAbierta}" onclick="toggleUsdLista()">
    <span class="seccion-label">Ver los ${n} ${n===1?"movimiento":"movimientos"} en USD</span>
    <span class="txt-sm txt-muted">${usdListaAbierta?"▲":"▼"}</span>
  </div>`;
  if(usdListaAbierta){
    html+=r.movimientos.map(m=>{
      const signo=m.efecto>0?"+":(m.efecto<0?"-":"");
      const color=m.efecto>0?"var(--success)":(m.efecto<0?"var(--danger)":"var(--muted)");
      const fecha=String(m.fecha||"").split("-").reverse().join("/");
      return `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <div class="u-min0">
          <div class="txt-md">${escapeHtml(m.desc)}</div>
          <div class="txt-micro txt-muted">${escapeHtml(fecha)} · ${escapeHtml(m.etiqueta)}</div>
        </div>
        <strong class="txt-md" style="color:${color};white-space:nowrap">${signo}USD ${m.monto.toFixed(2)}</strong>
      </div>`;
    }).join("");
  }

  el.innerHTML=html;
}

// Detalle de categoría desde el dashboard (al tocar una barra)
// tipo: "Gasto" (default) o "Ingreso"
// ═══════════════════════════════════════════
// DETALLE DE "RESULTADO INVERSIONES"
// ═══════════════════════════════════════════
// Esta categoría no es un m.cat real: la arma el Dashboard con la ganancia reconocida del año.
// Necesita su propia pantalla porque sumar sus movimientos como si fueran ingresos da cualquier
// cosa: con los datos reales, la barra decía $179K y el detalle $15.424.748 — se sumaban las
// suscripciones Y los rescates, todos en positivo, como si poner plata y sacarla fueran las dos
// un ingreso. "FCI Suscripción $5,2M" junto a "FCI Rescate capital $5,2M" no dice nada.
//
// Acá: arriba la ganancia (el mismo número que la barra), el mes a mes de esa ganancia, y el
// movimiento de capital CON SIGNO — lo que pusiste en negativo, lo que sacaste en positivo.
function detalleResultadoInversiones(cat){
  const anio=String(dashYear);
  const delAnio=movs.filter(m=>m.tipo==="Inversion" && String(m.fecha||"").slice(0,4)===anio);
  const gan=gananciaInvEntre(anio+"-01", anio+"-12");
  const tabla=resultadoInv().gananciaPorMes;

  const puesto=delAnio.filter(m=>!isInvSalida(m)).reduce((s,m)=>s+(m.importe||0),0);
  const sacado=delAnio.filter(m=>isInvSalida(m)).reduce((s,m)=>s+(m.importe||0),0);
  const colorGan=gan.ars>=0?"var(--success)":"var(--danger)";

  document.getElementById("cat-detail-title").textContent=`◈ ${cat} · ${anio}`;
  let html=`<div class="inset">
    <div class="seccion-label">Ganancia reconocida ${anio}</div>
    <div style="font-size:22px;font-weight:600;color:${colorGan};margin-top:3px">${gan.ars>=0?"+":""}${fmtS(gan.ars)}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:3px">sobre ${fmtAbbr(puesto)} puestos en ${delAnio.length} ${delAnio.length===1?"operación":"operaciones"}</div>
  </div>`;
  if(Math.abs(gan.usd)>=0.01){
    html+=`<div class="txt-xs txt-muted" style="margin-top:6px">Y ${gan.usd>=0?"+":""}USD ${gan.usd.toFixed(2)} en dólares, que se cuenta aparte.</div>`;
  }

  // Mes a mes de la GANANCIA, no del flujo: un mes en que solo pusiste plata no ganó nada, y
  // mostrarlo con una barra larga haría pensar lo contrario.
  const meses=Object.keys(tabla).filter(ym=>ym.slice(0,4)===anio && Math.round(tabla[ym].ars)!==0).sort();
  if(meses.length){
    const maxM=Math.max(...meses.map(ym=>Math.abs(tabla[ym].ars)));
    html+=`<div class="seccion-label mt-14 mb-6">Ganancia por mes</div>`;
    meses.forEach(ym=>{
      const v=tabla[ym].ars;
      const c=v>=0?"var(--success)":"var(--danger)";
      html+=`<div class="bar-row" style="margin-bottom:5px">
        <div class="bar-label" style="font-size:12px">${mesLbl(ym)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(Math.abs(v)/maxM*100)}%;background:${c}"></div></div>
        <div class="bar-val" style="color:${c}">${v>=0?"+":""}${fmtAbbr(v)}</div>
      </div>`;
    });
  } else {
    html+=`<p class="txt-xs txt-muted" style="margin-top:10px">Todavía no se reconoció ninguna ganancia en ${anio}: la plata que pusiste sigue invertida.</p>`;
  }

  // Movimiento de capital, con signo. Poner plata sale, sacarla entra: mostrarlos con el mismo
  // signo era lo que hacía que el desglose no dijera nada.
  const porSub={};
  delAnio.forEach(m=>{
    const key=m.subcat||"(sin subcategoría)";
    porSub[key]=(porSub[key]||0)+(m.importe||0)*(isInvSalida(m)?1:-1);
  });
  const subs=Object.entries(porSub).filter(([,v])=>Math.round(v)!==0)
                                   .sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  if(subs.length){
    html+=`<div class="seccion-label mt-14 mb-6">Movimiento de capital</div>`;
    const maxS=Math.abs(subs[0][1])||1;
    subs.forEach(([sub,v])=>{
      const c=v>=0?"var(--success)":"var(--invest)";
      html+=`<div class="bar-row" style="margin-bottom:5px">
        <div class="bar-label" style="font-size:12px">${escapeHtml(sub)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(Math.abs(v)/maxS*100)}%;background:${c}"></div></div>
        <div class="bar-val" style="color:${c}">${v>=0?"+":""}${fmtAbbr(v)}</div>
      </div>`;
    });
    html+=`<div class="txt-xs txt-muted" style="margin-top:8px;line-height:1.45">
      En negativo lo que pusiste (${fmtAbbr(puesto)}), en positivo lo que sacaste (${fmtAbbr(sacado)}).
      Casi todo se compensa: es la misma plata yendo y volviendo. Lo que queda es la ganancia de arriba.</div>`;
  }
  document.getElementById("cat-detail-content").innerHTML=html;
  document.getElementById("modal-cat-detail").classList.add("open");
}

// Total, agrupado por mes y promedio mensual de una lista YA FILTRADA de movimientos de una
// categoría. Mismo criterio que promedioMensualHTML() del gráfico principal: el promedio solo
// cuenta los meses en los que la categoría tuvo AL MENOS un movimiento — un mes en el que no
// gastaste nada en "Auto" no es un mes de $0 en Auto, es un mes en el que no tocaste esa
// categoría, y contarlo diluiría el promedio sin decir nada real.
function promedioDeCategoria(movsCat){
  const porMes={};
  (movsCat||[]).forEach(m=>{
    const ym=String(m.fecha||"").slice(0,7);
    porMes[ym]=(porMes[ym]||0)+(m.importe||0);
  });
  const meses=Object.keys(porMes).sort();
  const total=Object.values(porMes).reduce((s,v)=>s+v,0);
  return {porMes, meses, total, promedio: meses.length ? total/meses.length : 0};
}

function showCatDetail(cat, tipo){
  tipo=tipo||"Gasto";
  if(cat==="Resultado inversiones" || cat==="Pérdida en inversiones"){
    detalleResultadoInversiones(cat);
    return;
  }
  const esIngreso=tipo==="Ingreso";
  const color=esIngreso?"var(--success)":"var(--danger)";
  let movsCat;
  {
    movsCat=movs.filter(m=>{
      if(esIngreso){
        if(m.tipo!=="Ingreso") return false;
      } else {
        if(!esGasto(m)) return false;
      }
      if(m.cat!==cat) return false;
      return String(m.fecha||"").slice(0,4)===String(dashYear);
    });
  }
  movsCat=movsCat.sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));
  const iconCat=getIcon(cat);
  const {porMes, meses, total, promedio}=promedioDeCategoria(movsCat);
  document.getElementById("cat-detail-title").textContent=`${iconCat} ${cat} · ${dashYear}`;
  let html=`<div class="inset">
    <div class="seccion-label">Total ${dashYear} · ${esIngreso?"Ingresos":"Gastos"}</div>
    <div style="font-size:22px;font-weight:600;color:${color};margin-top:3px">${fmtS(total||(esIngreso?0:(HIST_CAT_YEAR[String(dashYear)]||{})[cat]||0))}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:3px">${movsCat.length} ${movsCat.length===1?"movimiento":"movimientos"}${total===0&&!esIngreso?" (datos del histórico)":""}</div>
    ${meses.length?`<div style="font-size:12px;color:var(--muted);margin-top:6px">Promedio mensual (${meses.length} ${meses.length===1?"mes":"meses"}): <strong style="color:${color}">${fmtS(promedio)}</strong></div>`:""}
  </div>`;
  if(meses.length){
    const maxM=Math.max(...Object.values(porMes));
    html+=`<div class="seccion-label mb-6">Por mes</div>`;
    meses.forEach(ym=>{
      const v=porMes[ym];
      html+=`<div class="bar-row" style="margin-bottom:5px">
        <div class="bar-label" style="font-size:12px">${mesLbl(ym)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/maxM*100)}%;background:${color}"></div></div>
        <div class="bar-val">${fmtAbbr(v)}</div>
      </div>`;
    });
  }
  // Subcategorías top (para Inversion, m.subcat suele ser algo como "FCI Suscripción")
  const porSub={};
  movsCat.forEach(m=>{
    const s=m.subcat||"(sin subcategoría)";
    porSub[s]=(porSub[s]||0)+(m.importe||0);
  });
  const subs=Object.entries(porSub).sort((a,b)=>b[1]-a[1]);
  if(subs.length){
    html+=`<div class="seccion-label mt-14 mb-6">Subcategorías</div>`;
    const maxS=subs[0][1];
    subs.forEach(([s,v])=>{
      html+=`<div class="bar-row" style="margin-bottom:5px">
        <div class="bar-label" style="font-size:12px">${escapeHtml(s)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/maxS*100)}%;background:var(--accent)"></div></div>
        <div class="bar-val">${fmtAbbr(v)}</div>
      </div>`;
    });
  }
  if(!movsCat.length){
    html+=`<p style="font-size:12px;color:var(--muted);margin-top:10px">No hay movimientos cargados con esta categoría en ${dashYear}.</p>`;
  }
  document.getElementById("cat-detail-content").innerHTML=html;
  document.getElementById("modal-cat-detail").classList.add("open");
}
function closeCatDetail(){
  document.getElementById("modal-cat-detail").classList.remove("open");
}

// ── HOJA DE DETALLE DE POSICIÓN (Cartera → tocar un ticker) ──
// Perspectiva CARTERA (invSigno): "Invertido" es lo que neto tenés puesto, no un balance de
// cash flow. Reemplaza el viejo modal de detalle (handoff opción 1c, punto 5).
function showInstrumentoDetail(ticker){
  const movsTicker=movs.filter(m=>m.tipo==="Inversion" && (m.ticker||"Sin ticker")===ticker)
    .sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));
  const contentEl=document.getElementById("instrumento-detail-content");
  if(!movsTicker.length){
    contentEl.innerHTML=`<p class="txt-md txt-muted">Sin movimientos para este instrumento.</p>`;
    document.getElementById("modal-instrumento-detail").classList.add("open");
    return;
  }
  const cat=movsTicker[0].cat, cuenta=movsTicker[0].cuenta;
  let ars=0, usd=0;
  movsTicker.forEach(m=>{ ars+=(m.importe||0)*invSigno(m); usd+=(m.importeUSD||0)*invSigno(m); });
  const valorTxt = usd!==0 ? fmtUsdInv(usd) : fmtS(ars);
  const sumaTxt=arr=>{
    const a=arr.reduce((s,m)=>s+(m.importe||0),0), u=arr.reduce((s,m)=>s+(m.importeUSD||0),0);
    return [a?fmtS(a):"", u?fmtUsdInv(u):""].filter(Boolean).join(" y ")||"—";
  };
  const puso=movsTicker.filter(m=>!isInvSalida(m)), cobro=movsTicker.filter(isInvSalida);

  let html=`<div style="display:flex;align-items:center;gap:12px">
    <span style="width:44px;height:44px;border-radius:50%;background:var(--invest-light);display:flex;align-items:center;justify-content:center;font-size:20px">${getIcon(cat,"📦")}</span>
    <div style="flex:1;display:flex;flex-direction:column;gap:1px;min-width:0">
      <span style="font-size:17px;font-weight:700;letter-spacing:.3px">${escapeHtml(ticker)}</span>
      <span style="font-size:12px;color:var(--muted)">${escapeHtml(cat)}${cuenta?" · "+escapeHtml(cuenta):""}</span>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0">
      <span style="font-size:11px;color:var(--muted)">Invertido</span>
      <span style="font-size:17px;font-weight:700;color:var(--invest)">${valorTxt}</span>
    </div>
  </div>
  <div style="display:flex;gap:16px;font-size:12px;padding:10px 12px;background:var(--bg);border-radius:10px">
    <span><span style="color:var(--muted)">Pusiste </span><strong>${sumaTxt(puso)}</strong></span>
    <span><span style="color:var(--muted)">Cobraste </span><strong style="color:var(--success)">${sumaTxt(cobro)}</strong></span>
  </div>
  <div style="display:flex;flex-direction:column">`+
  movsTicker.map((m,i)=>{
    const sale=isInvSalida(m);
    return `<div style="display:flex;align-items:center;gap:12px;min-height:50px;${i?"border-top:1px solid var(--border)":""};cursor:pointer" onclick="closeInstrumentoDetail();openEditModal(${m.id})">
      <span style="width:30px;height:30px;border-radius:50%;background:${sale?"var(--success-light)":"var(--invest-light)"};color:${sale?"var(--success)":"var(--invest)"};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${sale?"↓":"↑"}</span>
      <div style="flex:1;display:flex;flex-direction:column;gap:1px;min-width:0">
        <span style="font-size:13.5px;font-weight:600">${escapeHtml(m.subcat||m.cat)}</span>
        <span style="font-size:11.5px;color:var(--muted)">${fdyInv(m.fecha)}</span>
      </div>
      <span style="font-size:13.5px;font-weight:600;color:${sale?"var(--success)":"var(--text)"}">${invMontoTxt(m)}</span>
    </div>`;
  }).join("")+
  `</div>
  <div style="display:flex;gap:8px">
    <button type="button" style="flex:1;height:44px;border:1px solid var(--border);border-radius:12px;background:var(--bg);color:var(--text);font-size:13px;font-weight:600;cursor:pointer" onclick="irACargarInversion(${attrJS(ticker)},'cobro')">Cargar cobro</button>
    <button type="button" style="flex:1;height:44px;border:none;border-radius:12px;background:var(--invest);color:#fff;font-size:13px;font-weight:600;cursor:pointer" onclick="irACargarInversion(${attrJS(ticker)},'compra')">Sumar compra</button>
  </div>`;
  contentEl.innerHTML=html;
  document.getElementById("modal-instrumento-detail").classList.add("open");
}
function closeInstrumentoDetail(){
  document.getElementById("modal-instrumento-detail").classList.remove("open");
}
// "Cargar cobro"/"Sumar compra" de la hoja de detalle: abre Cargar en tipo Inversión con
// categoría, ticker y cuenta precargados, y la primera operación de salida (cobro) o de
// entrada (compra) de esa categoría ya seleccionada en "Operación".
function irACargarInversion(ticker, modo){
  const pos=movs.filter(m=>m.tipo==="Inversion" && (m.ticker||"Sin ticker")===ticker);
  if(!pos.length) return;
  const cat=pos[0].cat, cuenta=pos[0].cuenta;
  const esCobro=modo==="cobro";
  const subs=getCats("Inversion")[cat]||[];
  const subcat = subs.find(s=>isInvSalida({subcat:s,cat})===esCobro)
    || (pos.find(m=>isInvSalida(m)===esCobro)||{}).subcat
    || subs[0];
  closeInstrumentoDetail();
  showPage("cargar");
  setTipo("Inversion");
  const catSel=document.getElementById("inv-cat");
  if(catSel) catSel.value=cat;
  buildInvCatChips();
  updateInvSubcats();
  const subSel=document.getElementById("inv-subcat");
  if(subSel && subcat) subSel.value=subcat;
  const tickerEl=document.getElementById("inv-ticker");
  if(tickerEl) tickerEl.value=ticker;
  buildTickerRecientes();
  const cuentaSel=document.getElementById("inv-cuenta");
  if(cuentaSel && cuenta) cuentaSel.value=cuenta;
}

// ── DETALLE DE CUENTA (Dashboard → Saldo por cuenta → tocar una cuenta) ──
// Devuelve todos los movimientos (Ingreso/Gasto/Inversion, sin USD) de esa cuenta en el año del dashboard,
// expandiendo gastos frecuentes mes a mes igual que renderDashCuentas.
function getMovsCuentaEnAnio(cuentaNombre, year){
  const meses12=["01","02","03","04","05","06","07","08","09","10","11","12"];
  const res=[];
  meses12.forEach(mm=>{
    const ym=String(year)+"-"+mm;
    getMesMov(ym).forEach(m=>{
      if(m.moneda==="USD") return;
      const c=m.cuenta||"Sin cuenta";
      if(c===cuentaNombre) res.push(m);
    });
  });
  return res;
}

function showCuentaDetail(cuentaNombre){
  const movsCuenta=getMovsCuentaEnAnio(cuentaNombre, dashYear)
    .sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));
  document.getElementById("cuenta-detail-title").textContent=`💳 ${cuentaNombre} · ${dashYear}`;
  if(!movsCuenta.length){
    document.getElementById("cuenta-detail-content").innerHTML=`<p class="txt-md txt-muted">Sin movimientos para esta cuenta en ${dashYear}.</p>`;
    document.getElementById("modal-cuenta-detail").classList.add("open");
    return;
  }
  // Totales (misma convención que renderDashCuentas: retiros y rescates suman, compras/depósitos restan o son neutros)
  let ing=0, gas=0;
  movsCuenta.forEach(m=>{
    if(m.tipo==="Ingreso") ing+=(m.importe||0);
    else if(m.tipo==="Gasto"){
      gas+=(m.importe||0);                                  // todo gasto resta
      if(esRetiroAhorro(m)) ing+=(m.importe||0);            // y el retiro además entra
    } else if(m.tipo==="Inversion"){
      if(isInvSalida(m)) ing+=(m.importe||0); else gas+=(m.importe||0);
    }
  });
  const balance=ing-gas;
  const balColor=balance>=0?"var(--success)":"var(--danger)";
  let html=`<div class="inset">
    <div class="seccion-label">Balance ${dashYear}</div>
    <div style="font-size:20px;font-weight:600;color:${balColor};margin-top:3px">${fmtSignoGrande(balance)}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:3px">Ingresos: <span style="color:var(--success)">${fmtS(ing)}</span> · Gastos: <span style="color:var(--danger)">${fmtS(gas)}</span> · ${movsCuenta.length} ${movsCuenta.length===1?"movimiento":"movimientos"}</div>
  </div>`;
  html+=movsCuenta.map(m=>{
    let signo, color, badge="";
    if(m.tipo==="Ingreso"){
      signo="+"; color="var(--success)";
    } else if(m.tipo==="Gasto"){
      if(esRetiroAhorro(m)){
        // Es una compra: se muestra con "-", igual que en la lista de Movimientos. El badge
        // aclara de dónde salió la plata. Antes decía "+" y contradecía a la otra pantalla.
        signo="-"; color="var(--save)";
        badge=`<span class="badge badge-save">DE AHORROS</span>`;
      } else if(m.esAhorro){
        signo="-"; color="var(--save)";
        badge=`<span class="badge badge-save">AHORRO</span>`;
      } else {
        signo="-"; color="var(--danger)";
        if(m.frecuente) badge=`<span class="badge badge-warning">🔁 FRECUENTE</span>`;
      }
    } else if(m.tipo==="Inversion"){
      const esIngreso=isInvSalida(m);
      signo=esIngreso?"+":"-";
      color=esIngreso?"var(--success)":"var(--danger)";
      badge=esIngreso
        ?`<span class="badge badge-success">📥 INGRESO</span>`
        :`<span class="badge badge-danger">📤 GASTO</span>`;
    }
    const fecha=(m.fecha||"").split("-").reverse().join("/");
    const titulo=m.tipo==="Inversion"?(m.ticker||m.cat):m.cat;
    const subInfo=m.tipo==="Inversion"?(m.subcat||""):(m.subcat||"");
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
      <div class="u-flex1 u-min0">
        <div class="txt-md txt-strong">${escapeHtml(titulo)} ${badge}</div>
        <div class="txt-xs txt-muted">${subInfo?escapeHtml(subInfo)+" · ":""}${fecha}${m.nota?" · "+escapeHtml(m.nota):""}</div>
      </div>
      <div style="text-align:right;display:flex;align-items:center;gap:8px;flex-shrink:0">
        <div style="font-size:14px;font-weight:600;color:${color}">${signo}${fmtS(m.importe||0)}</div>
        <button class="tx-edit" onclick="closeCuentaDetail();openEditModal(${m.id})" title="Editar">✎</button>
        <button class="tx-del" onclick="borrarMovDesdeCuenta(${m.id},${attrJS(cuentaNombre)},this)" title="Eliminar">×</button>
      </div>
    </div>`;
  }).join("");
  document.getElementById("cuenta-detail-content").innerHTML=html;
  document.getElementById("modal-cuenta-detail").classList.add("open");
}
function closeCuentaDetail(){
  document.getElementById("modal-cuenta-detail").classList.remove("open");
}
// Elimina (o da de baja, si es frecuente) un movimiento desde el detalle de cuenta.
// Reusa la misma mecánica de confirmación que ya existe para frecuentes en Movimientos.
async function borrarMovDesdeCuenta(id, cuentaNombre, btn){
  const m=movs.find(x=>x.id===id);
  if(!m) return;
  if(m.tipo==="Gasto" && m.frecuente){
    const mesDeBaja=mesActual;
    if(await mostrarConfirm(`Este es un gasto frecuente mensual.\n\n¿Querés darlo de baja desde ${mesLbl(mesDeBaja)}? (los meses anteriores se mantienen)\n\nCancelar = eliminarlo por completo, incluyendo todos los meses anteriores.`, {textoOk:"Dar de baja", textoCancelar:"Eliminar todo"})){
      m.mesFin=addMonths(mesDeBaja,-1);
      save();
      showToast(`Gasto frecuente dado de baja desde ${mesLbl(mesDeBaja)} ✓`);
    } else {
      if(!await mostrarConfirm("⚠️ Vas a eliminar el gasto frecuente y todos sus meses (incluyendo el historial). ¿Confirmás?", {textoOk:"Eliminar todo", peligroso:true})) return;
      movs=movs.filter(x=>x.id!==id);
      save();
      showToast("Gasto frecuente eliminado");
    }
  } else {
    // Doble-toque de confirmación, igual que en el resto de la app
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
    movs=movs.filter(x=>x.id!==id);
    save();
    showToast("Movimiento eliminado");
  }
  renderMovs();
  renderDashCuentas();
  const quedan=getMovsCuentaEnAnio(cuentaNombre, dashYear).length>0;
  if(quedan) showCuentaDetail(cuentaNombre);
  else closeCuentaDetail();
}

// Dibuja una barra con las esquinas redondeadas del lado "exterior" (arriba si sale del cero hacia
// arriba, abajo si es una barra negativa que baja desde el cero). corners: "top" (default) o "bottom".
// Lee el valor actual de una variable CSS (respeta claro/oscuro). Los gráficos en <canvas> no
// pueden usar var(--x) directamente como los elementos HTML, así que lo resuelven acá en tiempo
// de dibujo — por eso cada draw*Chart llama a esto en vez de hardcodear colores de un solo tema.
function themeColor(varName){
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}
// Igual que themeColor pero devuelve rgba() con alpha, para rellenos semitransparentes (áreas de gráficos)
function themeColorAlpha(varName, alpha){
  const hex=themeColor(varName).replace('#','');
  const r=parseInt(hex.substring(0,2),16), g=parseInt(hex.substring(2,4),16), b=parseInt(hex.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
// Mezcla dos variables de tema en el porcentaje dado (equivalente a color-mix(), pero resuelto a
// mano: ctx.fillStyle de un canvas no siempre interpreta color-mix()/var(), así que se calcula
// el rgb() final acá, igual que ya hace themeColorAlpha con el alpha).
function themeColorMix(varName, pct, baseVarName){
  const a=themeColor(varName).replace('#',''), b=themeColor(baseVarName).replace('#','');
  const canal=(i)=>{
    const va=parseInt(a.substring(i,i+2),16), vb=parseInt(b.substring(i,i+2),16);
    return Math.round(va*pct/100 + vb*(1-pct/100));
  };
  return `rgb(${canal(0)},${canal(2)},${canal(4)})`;
}
function drawBarRounded(ctx, x, y, w, h, r, corners){
  if(h<=0) return;
  corners=corners||"top";
  r=Math.min(r, w/2, h);
  const radii = corners==="top" ? [r,r,0,0] : [0,0,r,r];
  ctx.beginPath();
  if(ctx.roundRect){
    ctx.roundRect(x, y, w, h, radii);
  } else if(corners==="top"){
    ctx.moveTo(x, y+h);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h);
    ctx.closePath();
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x+w, y);
    ctx.lineTo(x+w, y+h-r);
    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.closePath();
  }
  ctx.fill();
}
// Igual que drawBarRounded pero para barras HORIZONTALES (crecen hacia la derecha).
// corners: "right" (redondea solo el extremo, default) o "full" (pill completo, para el track de fondo)
function drawBarRoundedH(ctx, x, y, w, h, r, corners){
  if(w<=0) return;
  corners=corners||"right";
  r=Math.min(r, h/2, Math.abs(w)/2);
  const radii = corners==="full" ? [r,r,r,r] : [0,r,r,0];
  ctx.beginPath();
  if(ctx.roundRect){
    ctx.roundRect(x, y, w, h, radii);
  } else if(corners==="full"){
    ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
  } else {
    ctx.moveTo(x,y);ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x,y+h);ctx.closePath();
  }
  ctx.fill();
}
// ═══════════════════════════════════════════
// CHART.JS — Dashboard (Ingresos, gastos y balance)
// ═══════════════════════════════════════════
// Animación de los gráficos. Chart.js ya anima por defecto, pero el @media de movimiento
// reducido es CSS y no llega al canvas: sin esto, quien pidió menos movimiento igual veía las
// barras dibujarse. Se declara explícita para poder apagarla, y de paso para fijar la curva en
// vez de depender del default de la librería.
function animacionDeGrafico(){
  if(typeof prefiereMenosMovimiento==="function" && prefiereMenosMovimiento()) return false;
  return {duration:700, easing:"easeOutQuart"};
}

// Instancias guardadas para poder destruirlas antes de re-crear (Chart.js tira error
// "Canvas is already in use" si no se destruye la instancia anterior sobre el mismo canvas).
let chartMensualInstance=null;

// Ingresos, gastos y balance en un solo gráfico.
//
// Antes esto eran dos tarjetas separadas: las barras de ingresos/gastos y, abajo, una línea
// con el balance. Como el balance es exactamente ingreso − gasto, está en la misma unidad
// (pesos) y sobre los mismos meses, ponerlo encima de las barras deja leer de un vistazo
// "cuánto entró, cuánto salió y qué quedó" sin saltar entre dos gráficos ni comparar dos
// escalas distintas. Es un solo eje Y para las tres series — nunca dos escalas superpuestas,
// porque eso inventa relaciones que los datos no tienen.
//
// La leyenda ahora se muestra siempre: con tres series, distinguirlas sólo por color deja
// afuera a quien no distingue verde de rojo.
// El recuadro de arriba del gráfico (mes · ingresos · gastos · balance): la misma función la
// llena al tocar una barra y también apenas se dibuja el gráfico, con el último mes del año
// elegido — así siempre hay un número real ahí en vez de una instrucción ("Tocá un mes...")
// que se queda para siempre si nadie toca nada.
// Promedio mensual de ingresos y gastos del año elegido: pone en contexto los totales de
// arriba (los chips de Ingresos/Gastos/Balance) — "$1,7M de gasto en el año" dice poco si no
// sabés a cuántos meses corresponde. Solo promedia meses CON datos, mismo criterio que
// comparativaMes() en analisis.js: "un mes sin movimientos no es un mes de $0, es un mes que
// no cargaste, y meterlo en el promedio lo hunde".
function promedioMensualHTML(yearData){
  const conDatos=(yearData||[]).filter(d=>d.ingreso>0 || d.gasto>0);
  if(!conDatos.length) return "";
  const n=conDatos.length;
  const promIng=conDatos.reduce((s,d)=>s+d.ingreso,0)/n;
  const promGas=conDatos.reduce((s,d)=>s+d.gasto,0)/n;
  return `Promedio mensual (${n} ${n===1?"mes":"meses"}): <span style="color:var(--success);font-weight:600">${fmtTotal(promIng)}</span> ingresos · <span style="color:var(--danger);font-weight:600">${fmtTotal(promGas)}</span> gastos`;
}

function detalleMesHTML(d){
  const balColor=d.balance>=0?"var(--success)":"var(--danger)";
  return `<div style="display:flex;justify-content:space-around;align-items:center;text-align:center;flex-wrap:wrap;gap:6px">
      <div><div class="seccion-label txt-micro">${mesLbl(d.mes)}</div></div>
      <div><div class="txt-micro txt-muted">Ingresos</div><div style="font-size:13px;font-weight:600;color:var(--success)">${fmtS(d.ingreso)}</div></div>
      <div><div class="txt-micro txt-muted">Gastos</div><div style="font-size:13px;font-weight:600;color:var(--danger)">${fmtS(d.gasto)}</div></div>
      <div><div class="txt-micro txt-muted">Balance</div><div style="font-size:13px;font-weight:600;color:${balColor}">${fmtS(d.balance)}</div></div>
    </div>`;
}

function renderChartMensualBI(yearData){
  const canvas=document.getElementById("chart-mensual");
  if(!canvas || typeof Chart==="undefined") return;
  // El mes más reciente del año elegido: el último de la lista, porque getDashData() ya corta
  // en el mes actual y no agrega meses futuros vacíos. Sin esto, el recuadro se quedaba en
  // "Tocá un mes para ver el detalle" hasta que alguien tocaba una barra, que en la práctica
  // casi nadie hacía: era la única pieza en blanco de toda la pantalla.
  const detEl=document.getElementById("dash-detail");
  if(detEl && yearData.length) detEl.innerHTML=detalleMesHTML(yearData[yearData.length-1]);
  if(chartMensualInstance){ chartMensualInstance.destroy(); chartMensualInstance=null; }
  const labels=yearData.map(d=>d.mes.slice(5));
  const muted=themeColor('--muted'), border=themeColor('--border');
  const accent=themeColor('--accent'), surface=themeColor('--surface');
  chartMensualInstance=new Chart(canvas.getContext("2d"), {
    type:"bar",
    data:{
      labels,
      datasets:[
        {label:"Ingresos", data:yearData.map(d=>d.ingreso), backgroundColor:themeColor('--success'), borderRadius:4, maxBarThickness:22, order:2},
        {label:"Gastos", data:yearData.map(d=>d.gasto), backgroundColor:themeColor('--danger'), borderRadius:4, maxBarThickness:22, order:2},
        // order menor = se dibuja encima de las barras.
        {label:"Balance", data:yearData.map(d=>d.balance), type:"line", order:1,
         borderColor:accent, backgroundColor:accent, borderWidth:2, tension:0.35,
         pointRadius:3, pointHoverRadius:5,
         // Anillo del color de la tarjeta para que el punto se despegue de la barra que tenga detrás.
         pointBackgroundColor:accent, pointBorderColor:surface, pointBorderWidth:2}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      animation:animacionDeGrafico(),
      // Con "index" el tooltip y el clic toman el mes entero: no hay que acertarle justo a una
      // barra de 22px en el celular, y el tooltip muestra las tres cifras juntas.
      interaction:{mode:"index", intersect:false},
      plugins:{
        legend:{display:true, position:"bottom",
          labels:{color:muted, boxWidth:8, boxHeight:8, usePointStyle:true, pointStyle:"circle", padding:12, font:{size:10}}},
        tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${fmtS(ctx.parsed.y)}`}}
      },
      scales:{
        x:{grid:{display:false}, ticks:{color:muted, font:{size:9}}},
        y:{grid:{color:border}, ticks:{color:muted, font:{size:9}, callback:v=>fmtAbbr(v)}}
      },
      onClick:(evt, elements)=>{
        if(!elements.length) return;
        const d=yearData[elements[0].index];
        if(!d) return;
        document.getElementById("dash-detail").innerHTML=detalleMesHTML(d);
      }
    }
  });
}

