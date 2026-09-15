// ═══════════════════════════════════════════
// DASHBOARD CON CHARTS
// ═══════════════════════════════════════════
function renderDash(){
  // Build year list from hist + live movs
  const histYears = [...new Set(HIST_MONTHLY.map(d=>parseInt(d.mes.slice(0,4))))];
  const liveYears = [...new Set(movs.map(m=>parseInt(String(m.fecha||"").slice(0,4))).filter(y=>y>2000))];
  const years = [...new Set([...histYears,...liveYears])].sort();
  // Default to latest year
  if(!years.includes(dashYear)) dashYear = years[years.length-1];
  document.getElementById("year-tabs").innerHTML=years.map(y=>
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
// ═══════════════════════════════════════════
// ANALÍTICA: ajuste por inflación (comparativa interanual)
// ═══════════════════════════════════════════

// Índices de inflación mensual (IPC nacional, INDEC) — variación % respecto al mes anterior.
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
  let factor=1, ym=ymOrigen;
  let guard=0;
  while(ym<ymDestino && guard<600){
    guard++;
    ym=addMonths(ym,1);
    const infl=INFLACION_MENSUAL_ARS[ym];
    if(infl) factor*=(1+infl/100);
  }
  return Math.round(monto*factor*100)/100;
}

function getDashData(year){
  // Merge: historical hardcoded data + live imported movs
  const yrStr = String(year);
  // Regla de balance:
  // - INGRESOS = ingresos puros + retiros del ahorro (usaAhorro) + rescates de inversión
  // - GASTOS = gastos puros + compras/suscripciones de inversión (sale cash, queda expuesto a riesgo de mercado)
  // - El ahorro (depósito) sigue siendo neutral: es la misma plata líquida, solo cambia de "cajón".
  const meses12=["01","02","03","04","05","06","07","08","09","10","11","12"];
  const liveByMes = {};
  let hayDatosLive = false;
  meses12.forEach(mm=>{
    const ym = yrStr+"-"+mm;
    const movsDelMes = getMesMov(ym);
    if(movsDelMes.length) hayDatosLive = true;
    liveByMes[ym] = {mes:ym, ingreso:0, gasto:0};
    movsDelMes.forEach(m=>{
      if(m.moneda==="USD") return; // No mezclar USD con totales ARS
      if(m.tipo==="Ingreso"){
        liveByMes[ym].ingreso += (m.importe||0);
      } else if(esGasto(m)){
        // Todo gasto resta (consumo, depósito al fondo y compra pagada con ahorros).
        liveByMes[ym].gasto += (m.importe||0);
        // Y si fue pagado con ahorros, el retiro además devuelve esa plata a la mano:
        // las dos puntas se cancelan y el fondo baja. Antes solo se contaba la entrada.
        if(esRetiroAhorro(m)) liveByMes[ym].ingreso += (m.importe||0);
      } else if(m.tipo==="Inversion"){
        if(isInvSalida(m)){
          // Rescate/venta → suma como ingreso (entra cash)
          liveByMes[ym].ingreso += (m.importe||0);
        } else {
          // Suscripción/compra → suma como gasto (sale cash al mercado)
          liveByMes[ym].gasto += (m.importe||0);
        }
      }
    });
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
  // Ingresos por categoría: ingresos puros + retiros (agrupados como "De ahorros") + rescates (agrupados como "Inversiones (rescates)")
  let catData = {};
  let catIngreso = {};
  if(hayDatosLive){
    meses12.forEach(mm=>{
      const ym = yrStr+"-"+mm;
      getMesMov(ym).forEach(m=>{
        if(m.moneda==="USD") return;
        if(esGasto(m)){
          // Todo gasto entra en su categoría, incluidos los pagados con ahorros.
          catData[m.cat] = (catData[m.cat]||0) + (m.importe||0);
          // El retiro además aparece como ingreso, agrupado bajo "De ahorros".
          if(esRetiroAhorro(m)) catIngreso["De ahorros"] = (catIngreso["De ahorros"]||0) + (m.importe||0);
        } else if(m.tipo==="Ingreso"){
          catIngreso[m.cat] = (catIngreso[m.cat]||0) + (m.importe||0);
        } else if(m.tipo==="Inversion"){
          if(isInvSalida(m)){
            // Rescates → ingreso, categoría agrupada
            catIngreso["Inversiones (rescates)"] = (catIngreso["Inversiones (rescates)"]||0) + (m.importe||0);
          } else {
            // Compras/suscripciones → gasto, categoría agrupada
            catData["Inversiones (compras)"] = (catData["Inversiones (compras)"]||0) + (m.importe||0);
          }
        }
      });
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
  document.getElementById("dash-detail").innerHTML="Tocá una columna para ver el detalle";
  document.getElementById("dash-balance-detail").innerHTML="Tocá un punto para ver el balance del mes";

  renderChartMensualBI(yearData);
  renderChartBalanceBI(yearData);

  const sorted=Object.entries(catData).sort((a,b)=>b[1]-a[1]);
  const maxVal=sorted[0]?sorted[0][1]:1;
  // Datos del año anterior para comparativa
  const yearPrev=String(parseInt(dashYear)-1);
  const {cats: catDataPrev}=getDashData(yearPrev);
  const hayGastosAnioAnterior=Object.keys(catDataPrev).length>0;
  document.getElementById("dash-bars-gasto").innerHTML=sorted.length
    ? sorted.slice(0,10).map(([cat,val])=>{
        // Deflactamos el año anterior a valor presente (ancla: mitad de cada año) antes de
        // comparar, así el % no confunde inflación con gasto real — ver INFLACION_MENSUAL_ARS.
        const valPrev=deflactarARS(catDataPrev[cat]||0, yearPrev+"-07", dashYear+"-07");
        const comp=compAnioAnterior(val, valPrev, hayGastosAnioAnterior, false);
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
  document.getElementById("dash-bars-ingreso").innerHTML=sortedIng.length
    ? sortedIng.slice(0,10).map(([cat,val])=>{
        const valPrev=deflactarARS(catIngresoPrev[cat]||0, yearPrev+"-07", dashYear+"-07");
        // En ingresos subir es bueno, al revés que en gastos.
        const comp=compAnioAnterior(val, valPrev, hayIngresosAnioAnterior, true);
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
function compAnioAnterior(val, valPrev, hayAnioAnterior, subirEsBueno){
  if(valPrev>0){
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
    if(m.tipo==="Ingreso") porCuenta[c].ing+=(m.importe||0);
    else if(esGasto(m)){
      porCuenta[c].gas+=(m.importe||0);                      // todo gasto resta
      if(esRetiroAhorro(m)) porCuenta[c].ing+=(m.importe||0); // y el retiro además entra
    } else if(m.tipo==="Inversion"){
      if(isInvSalida(m)){
        // Rescate/venta → ingreso (entra cash)
        porCuenta[c].ing+=(m.importe||0);
      } else {
        // Suscripción/compra → gasto (sale cash)
        porCuenta[c].gas+=(m.importe||0);
      }
    }
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

// Renderiza el flujo USD billete del año seleccionado en el dashboard
function renderDashUSD(){
  const card=document.getElementById("dash-usd-card");
  const el=document.getElementById("dash-usd");
  if(!card||!el) return;
  const yrStr=String(dashYear);
  // Movimientos USD "billete" del año (Ingreso/Gasto, sin inversión)
  const movsUSD=movs.filter(m=>{
    if(!m.fecha||!String(m.fecha).startsWith(yrStr)) return false;
    if(m.tipo==="Inversion") return false;
    return m.moneda==="USD" && (m.importeOrig||0)>0;
  });
  // Inversiones en USD del año: compra/suscripción = sale plata, rescate/venta = entra plata
  const invUSD=movs.filter(m=>m.tipo==="Inversion" && String(m.fecha||"").startsWith(yrStr) && (m.importeUSD||0)>0);
  const invEntrada=invUSD.filter(m=>isInvSalida(m)).reduce((s,m)=>s+m.importeUSD,0);
  const invSalida=invUSD.filter(m=>!isInvSalida(m)).reduce((s,m)=>s+m.importeUSD,0);
  // Gastos de tarjeta en USD del año (cuotas y frecuentes, expandidos mes a mes)
  const meses12=["01","02","03","04","05","06","07","08","09","10","11","12"];
  let tcUSD=0, tcUSDcount=0;
  meses12.forEach(mm=>{
    getTcMovsEnMes(yrStr+"-"+mm).forEach(t=>{
      if(t.moneda==="USD"){ tcUSD+=(t.importe||0); tcUSDcount++; }
    });
  });

  const totalMovimientos=movsUSD.length+invUSD.length+tcUSDcount;
  if(!totalMovimientos){card.style.display="none";return;}
  card.style.display="block";

  // Acumular flujos del año
  const ing=movsUSD.filter(m=>m.tipo==="Ingreso").reduce((s,m)=>s+m.importeOrig,0);
  const gas=movsUSD.filter(esGasto).reduce((s,m)=>s+m.importeOrig,0);
  const aho=movsUSD.filter(esDepositoAhorro).reduce((s,m)=>s+m.importeOrig,0);
  const ret=movsUSD.filter(esRetiroAhorro).reduce((s,m)=>s+m.importeOrig,0);

  // Saldo neto del año en USD: billete + inversiones + tarjeta (antes solo contaba lo primero)
  const netoYear = ing - gas + aho - ret + invEntrada - invSalida - tcUSD;
  const netoColor=netoYear>=0?"var(--success)":"var(--danger)";

  let html=`<div class="inset">
    <div class="seccion-label">Saldo neto USD ${yrStr}</div>
    <div style="font-size:22px;font-weight:600;color:${netoColor};margin-top:3px">${netoYear>=0?"+":""}USD ${netoYear.toFixed(2)}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:3px">${totalMovimientos} ${totalMovimientos===1?"movimiento":"movimientos"} en USD</div>
  </div>`;

  const items=[
    {label:"📥 Ingresos", val:ing, color:"var(--success)", sign:"+"},
    {label:"📤 Gastos", val:gas, color:"var(--danger)", sign:"-"},
    {label:"🏦 Ahorrado al fondo USD", val:aho, color:"var(--save)", sign:"+"},
    {label:"💸 Retirado del fondo USD", val:ret, color:"var(--save)", sign:"-"},
    {label:"📈 Rescates de inversión", val:invEntrada, color:"var(--success)", sign:"+"},
    {label:"📉 Compras de inversión", val:invSalida, color:"var(--danger)", sign:"-"},
    {label:"💳 Gastos con tarjeta", val:tcUSD, color:"var(--danger)", sign:"-"}
  ].filter(x=>x.val>0);

  if(items.length){
    items.forEach(it=>{
      html+=`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span>${it.label}</span>
        <strong style="color:${it.color}">${it.sign}USD ${it.val.toFixed(2)}</strong>
      </div>`;
    });
  }
  el.innerHTML=html;
}

// Detalle de categoría desde el dashboard (al tocar una barra)
// tipo: "Gasto" (default) o "Ingreso"
function showCatDetail(cat, tipo){
  tipo=tipo||"Gasto";
  const esIngreso=tipo==="Ingreso";
  const color=esIngreso?"var(--success)":"var(--danger)";
  // Las categorías "De ahorros", "Inversiones (rescates)" e "Inversiones (compras)" son agrupaciones
  // creadas por el Dashboard (no son m.cat reales), así que se filtran distinto.
  let movsCat;
  if(cat==="De ahorros"){
    movsCat=movs.filter(m=>esRetiroAhorro(m) && String(m.fecha||"").slice(0,4)===String(dashYear));
  } else if(cat==="Inversiones (rescates)"){
    movsCat=movs.filter(m=>m.tipo==="Inversion" && isInvSalida(m) && String(m.fecha||"").slice(0,4)===String(dashYear));
  } else if(cat==="Inversiones (compras)"){
    movsCat=movs.filter(m=>m.tipo==="Inversion" && !isInvSalida(m) && String(m.fecha||"").slice(0,4)===String(dashYear));
  } else {
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
  const total=movsCat.reduce((s,m)=>s+(m.importe||0),0);
  const iconCat=cat==="Inversiones (rescates)"||cat==="Inversiones (compras)"?"◈":(cat==="De ahorros"?"🏦":(getIcon(cat)));
  document.getElementById("cat-detail-title").textContent=`${iconCat} ${cat} · ${dashYear}`;
  let html=`<div class="inset">
    <div class="seccion-label">Total ${dashYear} · ${esIngreso?"Ingresos":"Gastos"}</div>
    <div style="font-size:22px;font-weight:600;color:${color};margin-top:3px">${fmtS(total||(esIngreso?0:(HIST_CAT_YEAR[String(dashYear)]||{})[cat]||0))}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:3px">${movsCat.length} ${movsCat.length===1?"movimiento":"movimientos"}${total===0&&!esIngreso?" (datos del histórico)":""}</div>
  </div>`;
  // Agrupado por mes
  const porMes={};
  movsCat.forEach(m=>{
    const ym=String(m.fecha||"").slice(0,7);
    porMes[ym]=(porMes[ym]||0)+(m.importe||0);
  });
  const meses=Object.keys(porMes).sort();
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

// ── DETALLE DE INSTRUMENTO (Cartera → tocar un ticker) ──
// Muestra todos los movimientos de inversión de ese ticker/fondo, con opción de editar o eliminar cada uno.
function showInstrumentoDetail(ticker){
  const movsTicker=movs.filter(m=>m.tipo==="Inversion" && (m.ticker||"Sin ticker")===ticker)
    .sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));
  document.getElementById("instrumento-detail-title").textContent=`📊 ${ticker}`;
  if(!movsTicker.length){
    document.getElementById("instrumento-detail-content").innerHTML=`<p class="txt-md txt-muted">Sin movimientos para este instrumento.</p>`;
    document.getElementById("modal-instrumento-detail").classList.add("open");
    return;
  }
  // Totales acumulados (misma lógica de cash flow que la cartera)
  let totalArs=0, totalUsd=0;
  movsTicker.forEach(m=>{
    const sg=invSignoCash(m);
    totalArs+=(m.importe||0)*sg;
    totalUsd+=(m.importeUSD||0)*sg;
  });
  const colorTotal=totalArs>=0?"var(--success)":"var(--danger)";
  let html=`<div class="inset">
    <div class="seccion-label">Balance acumulado</div>
    <div style="font-size:20px;font-weight:600;color:${colorTotal};margin-top:3px">${fmtSignoGrande(totalArs)}</div>
    ${totalUsd!==0?`<div class="txt-md txt-muted">USD ${totalUsd.toFixed(2)}</div>`:""}
    <div style="font-size:12px;color:var(--muted);margin-top:3px">${movsTicker.length} ${movsTicker.length===1?"movimiento":"movimientos"}</div>
  </div>`;
  html+=movsTicker.map(m=>{
    const esIngreso=isInvSalida(m);
    const color=esIngreso?"var(--success)":"var(--danger)";
    const sign=esIngreso?"+":"-";
    const fecha=(m.fecha||"").split("-").reverse().join("/");
    const montoTxt = (m.importeUSD||0)>0
      ? `${sign}USD ${(Math.round(m.importeUSD*100)/100).toFixed(2)}`
      : `${sign}${fmtS(m.importe||0)}`;
    const badge=esIngreso
      ?`<span class="badge badge-success">📥 INGRESO</span>`
      :`<span class="badge badge-danger">📤 GASTO</span>`;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
      <div class="u-flex1 u-min0">
        <div class="txt-md txt-strong">${escapeHtml(m.subcat||m.cat)} ${badge}</div>
        <div class="txt-xs txt-muted">${fecha}${m.cuenta?" · "+escapeHtml(m.cuenta):""}${m.nota?" · "+escapeHtml(m.nota):""}</div>
      </div>
      <div style="text-align:right;display:flex;align-items:center;gap:8px;flex-shrink:0">
        <div style="font-size:14px;font-weight:600;color:${color}">${montoTxt}</div>
        <button class="tx-edit" onclick="closeInstrumentoDetail();openEditModal(${m.id})" title="Editar">✎</button>
        <button class="tx-del" onclick="borrarMovDesdeInstrumento(${m.id},${attrJS(ticker)},this)" title="Eliminar">×</button>
      </div>
    </div>`;
  }).join("");
  document.getElementById("instrumento-detail-content").innerHTML=html;
  document.getElementById("modal-instrumento-detail").classList.add("open");
}
function closeInstrumentoDetail(){
  document.getElementById("modal-instrumento-detail").classList.remove("open");
}
// Borra un movimiento de inversión desde el modal de detalle, con doble-toque de confirmación,
// y refresca tanto el modal (si sigue habiendo movimientos) como la pantalla de Inversiones detrás.
function borrarMovDesdeInstrumento(id, ticker, btn){
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
  showToast("Movimiento eliminado");
  renderInv();
  // Si todavía quedan movimientos de este ticker, refrescar el modal; si no, cerrarlo.
  const quedan=movs.some(m=>m.tipo==="Inversion" && (m.ticker||"Sin ticker")===ticker);
  if(quedan) showInstrumentoDetail(ticker);
  else closeInstrumentoDetail();
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
// CHART.JS — Dashboard (Ingresos vs Gastos, Balance mensual)
// ═══════════════════════════════════════════
// Instancias guardadas para poder destruirlas antes de re-crear (Chart.js tira error
// "Canvas is already in use" si no se destruye la instancia anterior sobre el mismo canvas).
let chartMensualInstance=null;
let chartBalanceInstance=null;
let chartInvHistoricoInstance=null;

// Gráfico de barras Ingresos vs Gastos, con tooltip nativo de Chart.js y clic en una
// columna para mostrar el detalle del mes en #dash-detail (mismo comportamiento de antes).
function renderChartMensualBI(yearData){
  const canvas=document.getElementById("chart-mensual");
  if(!canvas || typeof Chart==="undefined") return;
  if(chartMensualInstance){ chartMensualInstance.destroy(); chartMensualInstance=null; }
  const labels=yearData.map(d=>d.mes.slice(5));
  const muted=themeColor('--muted'), border=themeColor('--border');
  chartMensualInstance=new Chart(canvas.getContext("2d"), {
    type:"bar",
    data:{
      labels,
      datasets:[
        {label:"Ingresos", data:yearData.map(d=>d.ingreso), backgroundColor:themeColor('--success'), borderRadius:4, maxBarThickness:22},
        {label:"Gastos", data:yearData.map(d=>d.gasto), backgroundColor:themeColor('--danger'), borderRadius:4, maxBarThickness:22}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
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
        const balColor=d.balance>=0?"var(--success)":"var(--danger)";
        document.getElementById("dash-detail").innerHTML=`
          <div style="display:flex;justify-content:space-around;align-items:center;text-align:center;flex-wrap:wrap;gap:6px">
            <div><div class="seccion-label txt-micro">${mesLbl(d.mes)}</div></div>
            <div><div class="txt-micro txt-muted">Ingresos</div><div style="font-size:13px;font-weight:600;color:var(--success)">${fmtS(d.ingreso)}</div></div>
            <div><div class="txt-micro txt-muted">Gastos</div><div style="font-size:13px;font-weight:600;color:var(--danger)">${fmtS(d.gasto)}</div></div>
            <div><div class="txt-micro txt-muted">Balance</div><div style="font-size:13px;font-weight:600;color:${balColor}">${fmtS(d.balance)}</div></div>
          </div>`;
      }
    }
  });
}

// Gráfico de línea del balance mensual (con relleno), color del punto/línea según sea
// positivo o negativo, y clic en un punto para ver el detalle en #dash-balance-detail.
function renderChartBalanceBI(yearData){
  const canvas=document.getElementById("chart-balance");
  if(!canvas || typeof Chart==="undefined") return;
  if(chartBalanceInstance){ chartBalanceInstance.destroy(); chartBalanceInstance=null; }
  const labels=yearData.map(d=>d.mes.slice(5));
  const values=yearData.map(d=>d.balance);
  const successColor=themeColor('--success'), dangerColor=themeColor('--danger');
  const muted=themeColor('--muted'), border=themeColor('--border');
  const pointColors=values.map(v=>v>=0?successColor:dangerColor);
  const lineColor=(values[values.length-1]||0)>=0?successColor:dangerColor;
  chartBalanceInstance=new Chart(canvas.getContext("2d"), {
    type:"line",
    data:{
      labels,
      datasets:[{
        data:values,
        borderColor:lineColor,
        backgroundColor:themeColorAlpha('--accent',0.08),
        fill:true, tension:0.35, borderWidth:2.5,
        pointBackgroundColor:pointColors, pointBorderColor:pointColors, pointRadius:3
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:ctx=>`Balance: ${fmtS(ctx.parsed.y)}`}}
      },
      scales:{
        x:{grid:{display:false}, ticks:{color:muted, font:{size:9}, maxTicksLimit:6}},
        y:{grid:{color:border}, ticks:{color:muted, font:{size:9}, callback:v=>fmtAbbr(v)}}
      },
      onClick:(evt, elements)=>{
        if(!elements.length) return;
        const d=yearData[elements[0].index];
        if(!d) return;
        const color=d.balance>=0?"var(--success)":"var(--danger)";
        document.getElementById("dash-balance-detail").innerHTML=`
          <div style="display:flex;justify-content:space-around;align-items:center;text-align:center;flex-wrap:wrap;gap:6px">
            <div><div class="seccion-label txt-micro">${mesLbl(d.mes)}</div></div>
            <div><div class="txt-micro txt-muted">Balance</div><div style="font-size:14px;font-weight:600;color:${color}">${fmtS(d.balance)}</div></div>
          </div>`;
      }
    }
  });
}

// Gráfico de área del histórico acumulado de inversiones (pestaña Inversiones)
function renderChartInvHistoricoBI(labels, values){
  const canvas=document.getElementById("chart-inv-historico");
  if(!canvas || typeof Chart==="undefined") return;
  if(chartInvHistoricoInstance){ chartInvHistoricoInstance.destroy(); chartInvHistoricoInstance=null; }
  const investColor=themeColor('--invest');
  const muted=themeColor('--muted'), border=themeColor('--border');
  chartInvHistoricoInstance=new Chart(canvas.getContext("2d"), {
    type:"line",
    data:{
      labels,
      datasets:[{
        data:values,
        borderColor:investColor,
        backgroundColor:themeColorAlpha('--invest',0.15),
        fill:true, tension:0.35, borderWidth:2.5, pointRadius:0
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:ctx=>fmtS(ctx.parsed.y)}}
      },
      scales:{
        x:{grid:{display:false}, ticks:{color:muted, font:{size:9}, maxTicksLimit:6}},
        y:{grid:{color:border}, ticks:{color:muted, font:{size:9}, callback:v=>fmtAbbr(v)}}
      }
    }
  });
}

