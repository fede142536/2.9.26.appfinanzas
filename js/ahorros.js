// ═══════════════════════════════════════════
// AHORROS
// ═══════════════════════════════════════════
// Completa los meses en los que no hubo ningún movimiento, entre el primero y el último,
// con monto 0 para que el acumulado los arrastre plano.
// Sin esto el eje X mentía sobre el tiempo: solo se dibujaban los meses CON movimiento,
// repartidos parejo, así que diez meses sin ahorrar ocupaban el mismo ancho que uno y la
// curva parecía un crecimiento sostenido cuando en realidad había una meseta.
function rellenarMesesSinMovimiento(arr){
  if(arr.length<2) return arr;
  const [primerA, primerM]=arr[0].mes.split("-").map(Number);
  const [ultimoA, ultimoM]=arr[arr.length-1].mes.split("-").map(Number);
  const total=(ultimoA-primerA)*12+(ultimoM-primerM);
  // Red de seguridad: con una fecha disparatada cargada por error (un 1970, por ejemplo)
  // esto generaría miles de puntos y colgaría el dibujo. Ante eso, se deja como estaba.
  if(!isFinite(total) || total<0 || total>600) return arr;
  const porMes=Object.fromEntries(arr.map(d=>[d.mes,d]));
  const out=[];
  for(let i=0;i<=total;i++){
    const m=primerM-1+i;
    const ym=`${primerA+Math.floor(m/12)}-${String(m%12+1).padStart(2,"0")}`;
    out.push(porMes[ym] || {mes:ym, monto:0});
  }
  return out;
}

function renderAhorro(){
  // ── 1. MIS AHORROS ──
  // Sumamos depósitos (esAhorro) y restamos retiros (usaAhorro), agrupados por mes
  const depositos=movs.filter(esDepositoAhorro);
  const retiros=movs.filter(esRetiroAhorro);
  const tieneDatosUsuario=depositos.length>0 || retiros.length>0;
  let ahorrosArr;
  let usingUserData=false;
  if(tieneDatosUsuario){
    usingUserData=true;
    const porMes={};
    depositos.forEach(m=>{
      const ym=String(m.fecha||"").slice(0,7);
      if(!ym||ym.length!==7) return;
      porMes[ym]=(porMes[ym]||0)+m.importe;
    });
    retiros.forEach(m=>{
      const ym=String(m.fecha||"").slice(0,7);
      if(!ym||ym.length!==7) return;
      porMes[ym]=(porMes[ym]||0)-m.importe;
    });
    ahorrosArr=Object.entries(porMes)
      .sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([mes,monto])=>({mes,monto:Math.round(monto*100)/100}));
  } else {
    ahorrosArr=FONDO_DATA.map(d=>({mes:d.mes,monto:d.monto}));
  }
  // Completar los meses sin movimiento para que el eje del gráfico sea tiempo real.
  // Va ANTES del acumulado: los meses agregados suman 0, o sea arrastran el saldo plano.
  ahorrosArr=rellenarMesesSinMovimiento(ahorrosArr);

  // Calcular acumulado
  let acum=0;
  ahorrosArr.forEach(d=>{acum+=d.monto;d.acum=Math.round(acum*100)/100;});

  // Título legado: ya no se muestra (la franja de saldo no tiene card-title), pero el id se
  // conserva porque el código lo sigue leyendo/escribiendo (ver #fondo-title en index.html).
  const ahorroTitle=document.getElementById("fondo-title");
  if(ahorroTitle){
    ahorroTitle.textContent=usingUserData?"Mis ahorros":"Fondo de retiro (histórico)";
  }

  const fondoAcum=ahorrosArr.length?ahorrosArr[ahorrosArr.length-1].acum:0;
  const totalDepositado=depositos.reduce((s,m)=>s+m.importe,0);
  const totalRetirado=retiros.reduce((s,m)=>s+m.importe,0);

  // Franja de saldo: reemplaza los tres chips (Disponible/Depositado/Retirado) de antes.
  // Depositado y Retirado se cuentan ahora en #fondo-msg si hubo retiros, igual que ya hacía.
  renderAhorroSaldo(fondoAcum, calcularFondoUSD());

  // Mensaje informativo (sin cambios de contenido ni de cuándo se muestra)
  const fondoMsg=document.getElementById("fondo-msg");
  if(fondoMsg){
    if(!ahorrosArr.length){
      fondoMsg.style.display="block";
      fondoMsg.innerHTML="Cargá un gasto y marcalo como <strong>🏦 Es un ahorro</strong> para verlo acá.";
    } else if(!usingUserData){
      fondoMsg.style.display="block";
      fondoMsg.innerHTML="Datos del histórico importado. Marcá nuevos gastos como ahorro para empezar a alimentar esta vista.";
    } else if(totalRetirado>0){
      fondoMsg.style.display="block";
      fondoMsg.innerHTML=`💸 Llevás <strong>${fmtS(totalRetirado)}</strong> retirados de tus ahorros. Saldo actual: <strong>${fmtS(fondoAcum)}</strong>.`;
    } else {
      fondoMsg.style.display="none";
    }
  }

  // Metas: van primero en el nuevo orden ("la pantalla pasa a abrir con las metas").
  renderMetas();

  // ── GRÁFICO, RANKING Y DÓLARES (card de historial) ──
  // Guardo los datos en una variable global para que setAhorroView pueda re-renderizar
  // sin recalcular todo cada vez
  ahorroState.ahorrosArr=ahorrosArr;
  ahorroState.depositos=depositos;
  ahorroState.retiros=retiros;
  renderAhorroChart();
  renderAhorroRanking();
  renderUSD();
}

// Fondo USD = lo ahorrado al fondo en dólares menos lo retirado de él. Misma fórmula que usa
// renderUSD() para su propio chip "Fondo USD"; se repite acá (en vez de hacer que renderUSD
// la exponga) para no acoplar la franja de saldo al resto de sus cálculos de cash/detalle.
function calcularFondoUSD(){
  const ahorrosUSD=movs
    .filter(m=>esDepositoAhorro(m)&&m.moneda==="USD"&&m.importeOrig)
    .reduce((s,m)=>s+m.importeOrig,0);
  const retirosUSD=movs
    .filter(m=>esRetiroAhorro(m)&&m.moneda==="USD"&&m.importeOrig)
    .reduce((s,m)=>s+m.importeOrig,0);
  return ahorrosUSD-retirosUSD;
}

// Franja de saldo (#fondo-kpis): Disponible en pesos a la izquierda, Fondo USD a la derecha
// (oculto si no hay dólares guardados). Reemplaza a los chips Disponible/Depositado/Retirado.
function renderAhorroSaldo(fondoAcum, fondoUSD){
  const el=document.getElementById("fondo-kpis");
  if(!el) return;
  el.innerHTML=`
    <div class="ahorro-saldo-disp">
      <span class="ahorro-saldo-label">Disponible</span>
      <span class="ahorro-saldo-val" style="color:${fondoAcum>=0?"var(--save)":"var(--danger)"}" data-animar="${fondoAcum}">${fmtTotal(0)}</span>
    </div>
    ${fondoUSD!==0?`<div class="ahorro-saldo-usd">
      <span class="ahorro-saldo-usd-label">Fondo USD</span>
      <span class="ahorro-saldo-usd-val">USD ${fondoUSD.toFixed(2)}</span>
    </div>`:""}`;
  animarNumerosDe(el);
}

// ═══════════════════════════════════════════
// MIS DÓLARES (cash USD billete)
// ═══════════════════════════════════════════
// Calcula y renderiza el saldo USD billete del usuario (sin inversiones):
// - Ingresos USD: suman
// - Gastos USD: restan
// - Ahorros USD: suman al fondo USD
// - Retiros del fondo USD: restan del fondo USD (no afectan el cash gastable)
function renderUSD(){
  const card=document.getElementById("usd-card");
  if(!card) return;

  // Ingresos USD del usuario
  const ingresosUSD=movs
    .filter(m=>m.tipo==="Ingreso"&&m.moneda==="USD"&&m.importeOrig)
    .reduce((s,m)=>s+m.importeOrig,0);
  // TODOS los gastos USD: consumo, depósitos al fondo y compras pagadas con el fondo.
  const gastosUSD=movs
    .filter(m=>esGasto(m)&&m.moneda==="USD"&&m.importeOrig)
    .reduce((s,m)=>s+m.importeOrig,0);
  // Ahorros USD: depósitos al fondo USD
  const ahorrosUSD=movs
    .filter(m=>esDepositoAhorro(m)&&m.moneda==="USD"&&m.importeOrig)
    .reduce((s,m)=>s+m.importeOrig,0);
  // Retiros del fondo USD
  const retirosUSD=movs
    .filter(m=>esRetiroAhorro(m)&&m.moneda==="USD"&&m.importeOrig)
    .reduce((s,m)=>s+m.importeOrig,0);

  // Si no hay ningún movimiento USD, no mostramos la línea de dólares
  if(ingresosUSD===0 && gastosUSD===0 && ahorrosUSD===0 && retirosUSD===0){
    card.style.display="none";
    return;
  }
  card.style.display="grid";

  // Cash disponible = lo que entró menos lo que salió. El depósito al fondo SALE del cash
  // (por eso gastosUSD ahora lo incluye) y el retiro VUELVE al cash, así que se suma.
  // Antes el depósito no restaba de ningún lado pero sí sumaba al fondo, así que el "Total"
  // de abajo (cash + fondo) contaba esa plata dos veces: guardabas USD 100 y el total subía.
  const cashUSD = ingresosUSD - gastosUSD + retirosUSD;
  // Fondo USD: ahorros - retiros
  const fondoUSD = ahorrosUSD - retirosUSD;

  // Línea de dólares, siempre visible dentro de la card de historial (antes era #usd-card
  // completo, una card aparte con detalle siempre desplegado).
  document.getElementById("usd-cell-cash").textContent=`USD ${cashUSD.toFixed(2)}`;
  document.getElementById("usd-cell-fondo").textContent=`USD ${fondoUSD.toFixed(2)}`;
  document.getElementById("usd-cell-total").textContent=`USD ${(cashUSD+fondoUSD).toFixed(2)}`;

  // Lo de abajo alimenta la hoja #modal-usd-detail, que se abre al tocar la línea de dólares.
  const cashColor=cashUSD>=0?"save":"negative";
  const fondoColor=fondoUSD>=0?"save":"negative";
  document.getElementById("usd-kpis").innerHTML=`
    <div class="chip"><div class="chip-label">Cash USD</div><div class="chip-val ${cashColor}">USD ${cashUSD.toFixed(2)}</div></div>
    <div class="chip"><div class="chip-label">Fondo USD</div><div class="chip-val ${fondoColor}">USD ${fondoUSD.toFixed(2)}</div></div>
    <div class="chip"><div class="chip-label">Total</div><div class="chip-val save">USD ${(cashUSD+fondoUSD).toFixed(2)}</div></div>`;

  // Detalle desglosado
  let html=`<div class="seccion-label mb-8">Detalle</div>`;
  const items=[
    {label:"📥 Ingresos USD", val:ingresosUSD, signo:1},
    {label:"📤 Gastos USD (incluye lo guardado)", val:gastosUSD, signo:-1},
    {label:"🏦 Ahorrado al fondo USD", val:ahorrosUSD, signo:1},
    {label:"💸 Retirado del fondo USD", val:retirosUSD, signo:-1}
  ].filter(x=>x.val>0);
  items.forEach(it=>{
    const color=it.signo>0?"var(--success)":"var(--danger)";
    const sign=it.signo>0?"+":"-";
    html+=`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
      <span>${it.label}</span>
      <strong style="color:${color}">${sign}USD ${it.val.toFixed(2)}</strong>
    </div>`;
  });
  document.getElementById("usd-detail").innerHTML=html;
  document.getElementById("usd-msg").innerHTML=`Saldo en dólares billete: cash + lo guardado en el fondo. Las inversiones en USD se ven en la pestaña Inversiones.`;
}
function openUsdDetalle(){
  document.getElementById("modal-usd-detail").classList.add("open");
}
function closeUsdDetalle(){
  document.getElementById("modal-usd-detail").classList.remove("open");
}

// ═══════════════════════════════════════════
// AHORROS — VISTAS Y RANKING POR CATEGORÍA
// ═══════════════════════════════════════════
// Las tres vistas responden tres preguntas distintas: cuánto llevo, cuánto puse cada mes, y
// dónde está guardado. Una preferencia guardada que no esté en esta lista vuelve a "acum" en
// vez de dejar la tarjeta en blanco.
const VISTAS_AHORRO = ["acum","mensual","categoria"];
const ahorroState = {
  view: VISTAS_AHORRO.includes(localStorage.getItem("fahorrov")) ? localStorage.getItem("fahorrov") : "acum",
  ahorrosArr: [],
  depositos: [],
  retiros: []
};

// Cambia la vista del gráfico de ahorros y la guarda como preferencia
function setAhorroView(v){
  ahorroState.view=v;
  guardarPreferencia("fahorrov",v);
  syncAhorroViewButtons();
  renderAhorroChart();
}

// Activa el botón de la vista actual al entrar a Ahorros. Los botones ya no llevan una clase
// propia (".ahorro-view-btn"): son .seg-btn, iguales a los de Movimientos/Tarjetas, así que se
// identifican por su atributo data-view dentro del selector de Ahorros.
function syncAhorroViewButtons(){
  document.querySelectorAll("#ahorro-view-selector [data-view]").forEach(b=>{
    b.classList.toggle("active", b.dataset.view===ahorroState.view);
  });
}

// Arma el HTML de dos partes (rótulo gris + valor destacado) de la línea de lectura, para
// cualquiera de las dos vistas de gráfico. "mensual" en 0/positivo/negativo tienen cada uno su
// propio texto, igual que en el prototipo del handoff.
function lecturaAhorroHTML(view, ym, val){
  let lbl, txt, color;
  if(view==="acum"){
    lbl="Acumulado a "+mesLbl(ym).toLowerCase();
    txt=fmtS(val);
    color="var(--save)";
  } else {
    const mesSolo=MESES[parseInt(ym.split("-")[1],10)-1].toLowerCase();
    if(val===0){ lbl=mesLbl(ym); txt="Sin movimientos"; color="var(--muted)"; }
    else if(val>0){ lbl="Depositado en "+mesSolo; txt="+"+fmtS(val); color="var(--save)"; }
    else { lbl="Retirado en "+mesSolo; txt="−"+fmtS(-val); color="var(--danger)"; }
  }
  return `<span class="ahorro-tip-lbl">${escapeHtml(lbl)}</span><span class="ahorro-tip-val" style="color:${color}">${escapeHtml(txt)}</span>`;
}

// Renderiza el gráfico de ahorros según la vista activa
function renderAhorroChart(){
  syncAhorroViewButtons();
  const canvas=document.getElementById("chart-fondo");
  if(!canvas) return;
  const tipEl=document.getElementById("ahorro-tooltip");

  // "Por categoría" no es un gráfico en el lienzo: es el ranking, que ya sabe separar pesos de
  // dólares y abre el detalle al tocar. Se muestra uno u otro, nunca los dos: tenerlos juntos
  // era mostrar el mismo dato dos veces. El selector y esta misma línea de lectura (en las
  // otras vistas) ya dicen qué se está mirando, así que no hace falta una descripción aparte.
  const esCategoria = ahorroState.view==="categoria";
  const ranking=document.getElementById("ahorro-ranking");
  if(ranking) ranking.style.display = esCategoria ? "" : "none";
  canvas.style.display = esCategoria ? "none" : "";
  if(tipEl) tipEl.style.display = esCategoria ? "none" : "";
  if(esCategoria){
    if(tipEl) tipEl.textContent="";
    limpiarSeleccionLinea();
    renderAhorroRanking();
    return;
  }
  // Se limpia la selección porque acá se llega al cambiar de vista o cuando cambiaron los
  // datos: el punto que habías tocado ya no significa lo mismo en el gráfico nuevo. Al quedar
  // en null, drawInteractiveLine/Bars arrancan mostrando el último mes, no vacío. El redibujo
  // por un tap NO pasa por acá justamente para no perder la selección recién hecha.
  limpiarSeleccionLinea();

  const {ahorrosArr}=ahorroState;
  if(!ahorrosArr.length){
    if(tipEl) tipEl.textContent="";
    const ctx=canvas.getContext("2d");
    canvas.width=canvas.offsetWidth||320;canvas.height=110;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    return;
  }

  const view=ahorroState.view;
  if(view==="acum"){
    // Vista acumulada: curva clásica
    drawInteractiveLine(
      canvas,
      ahorrosArr.map(d=>d.mes),
      ahorrosArr.map(d=>d.acum),
      themeColor('--save'),
      tipEl,
      (ym,val)=>lecturaAhorroHTML("acum",ym,val)
    );
  } else if(view==="mensual"){
    // Vista mes a mes: barras (seleccionado en --save, retiro en --danger, $0 en --border)
    drawInteractiveBars(
      canvas,
      ahorrosArr.map(d=>d.mes),
      ahorrosArr.map(d=>d.monto),
      tipEl,
      (ym,val)=>lecturaAhorroHTML("mensual",ym,val)
    );
  }
}

// Ranking de categorías de ahorro: tarjeta debajo del gráfico
function renderAhorroRanking(){
  const el=document.getElementById("ahorro-ranking");
  if(!el) return;
  const {depositos, retiros}=ahorroState;
  // Con la vista "Por categoría" activa, el ranking es TODO lo que se ve: si se vacía sin decir
  // nada queda un hueco en blanco y parece que se rompió.
  const vacio=`<div class="empty" style="padding:20px"><div class="empty-icon">🏷</div>Todavía no hay ahorros para desglosar por categoría.</div>`;
  if(!depositos.length && !retiros.length){
    el.innerHTML = ahorroState.view==="categoria" ? vacio : "";
    return;
  }

  // Saldo neto por categoría, separado por moneda (ARS y USD nunca se mezclan en un mismo total)
  const porCat={};
  const acumular=(m, campo)=>{
    const c=m.cat||"Sin categoría";
    if(!porCat[c]) porCat[c]={depositadoArs:0,retiradoArs:0,depositadoUsd:0,retiradoUsd:0,count:0};
    if(m.moneda==="USD") porCat[c][campo+"Usd"]+=(m.importeOrig||0);
    else porCat[c][campo+"Ars"]+=(m.importe||0);
    porCat[c].count++;
  };
  depositos.forEach(m=>acumular(m,"depositado"));
  retiros.forEach(m=>acumular(m,"retirado"));
  const items=Object.entries(porCat)
    .map(([cat,d])=>({cat, ...d, saldoArs: d.depositadoArs-d.retiradoArs, saldoUsd: d.depositadoUsd-d.retiradoUsd}))
    .filter(x=>x.saldoArs!==0||x.saldoUsd!==0)
    .sort((a,b)=>Math.abs(b.saldoArs)-Math.abs(a.saldoArs));
  if(!items.length){
    el.innerHTML = ahorroState.view==="categoria" ? vacio : "";
    return;
  }

  // Cada categoría se mide contra las de SU moneda. Antes el % y la barra salían siempre del
  // saldo en pesos, así que una categoría que solo tiene dólares decía "0% del total" con la
  // barra vacía: era el 100% de tus dólares, no el 0% de nada.
  const soloUsd = it => it.saldoArs===0 && it.saldoUsd!==0;
  const escala = moneda => {
    const campo = moneda==="USD" ? "saldoUsd" : "saldoArs";
    const delGrupo = items.filter(it => (moneda==="USD") === soloUsd(it));
    return {
      total: delGrupo.reduce((s,it)=>s+Math.abs(it[campo]),0)||1,
      max:   Math.max(...delGrupo.map(it=>Math.abs(it[campo])), 1)
    };
  };
  const escalaArs=escala("ARS"), escalaUsd=escala("USD");

  // Sin título propio ("🏆 Ranking por categoría" se saca): el selector de arriba ya dice que
  // estás en "Por categoría", repetirlo acá era decir lo mismo dos veces.
  el.innerHTML=items.map(it=>{
    const esUsd=soloUsd(it);
    const {total: totalAbs, max: maxV}=esUsd?escalaUsd:escalaArs;
    const valor=Math.abs(esUsd?it.saldoUsd:it.saldoArs);
    const pct=Math.round(valor/totalAbs*100);
    const c=(esUsd?it.saldoUsd:it.saldoArs)>=0?"var(--save)":"var(--danger)";
    const cUsd=it.saldoUsd>=0?"var(--save)":"var(--danger)";
    const icon=getIcon(it.cat,"🏦");
    const catEsc=attrJS(it.cat);
    return `<div class="ahorro-rank-row" role="button" tabindex="0" onclick="showAhorroCatDetail(${catEsc})">
      <div class="ahorro-rank-cat">${icon} ${escapeHtml(it.cat)}</div>
      <div class="ahorro-rank-val" style="color:${c}">
        ${it.saldoArs!==0?fmtS(it.saldoArs):""}
        ${it.saldoUsd!==0?`<small style="color:${cUsd}">USD ${it.saldoUsd.toFixed(2)}</small>`:""}
      </div>
      <div class="ahorro-rank-bar"><div class="ahorro-rank-bar-fill" style="width:${Math.round(valor/maxV*100)}%;background:${c}"></div></div>
      <div class="ahorro-rank-meta">
        <span>${pct}% de ${esUsd?"tus dólares":"tus pesos"} · ${it.count} ${it.count===1?"movimiento":"movimientos"}</span>
        <span>${it.depositadoArs>0?`+${fmtAbbr(it.depositadoArs)}`:""}${it.retiradoArs>0?` -${fmtAbbr(it.retiradoArs)}`:""}</span>
      </div>
    </div>`;
  }).join("");
}

// ── DETALLE DE CATEGORÍA DE AHORRO (Ahorros → Ranking → tocar una categoría) ──
// Muestra todos los depósitos y retiros de esa categoría, con edición y eliminación.
function showAhorroCatDetail(cat){
  const {depositos, retiros}=ahorroState;
  const movsCat=[...depositos.filter(m=>(m.cat||"Sin categoría")===cat), ...retiros.filter(m=>(m.cat||"Sin categoría")===cat)]
    .sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));
  const icon=getIcon(cat,"🏦");
  document.getElementById("ahorrocat-detail-title").textContent=`${icon} ${cat}`;
  if(!movsCat.length){
    document.getElementById("ahorrocat-detail-content").innerHTML=`<p class="txt-md txt-muted">Sin movimientos.</p>`;
    document.getElementById("modal-ahorrocat-detail").classList.add("open");
    return;
  }
  // Totales separados por moneda: un depósito/retiro en USD guarda su monto en importeOrig, no en importe
  const montoDe=m=>m.moneda==="USD"?(m.importeOrig||0):(m.importe||0);
  const depositadoArs=movsCat.filter(m=>m.esAhorro&&m.moneda!=="USD").reduce((s,m)=>s+montoDe(m),0);
  const retiradoArs=movsCat.filter(m=>m.usaAhorro&&m.moneda!=="USD").reduce((s,m)=>s+montoDe(m),0);
  const depositadoUsd=movsCat.filter(m=>m.esAhorro&&m.moneda==="USD").reduce((s,m)=>s+montoDe(m),0);
  const retiradoUsd=movsCat.filter(m=>m.usaAhorro&&m.moneda==="USD").reduce((s,m)=>s+montoDe(m),0);
  const saldoArs=depositadoArs-retiradoArs;
  const saldoUsd=depositadoUsd-retiradoUsd;
  const colorSaldo=saldoArs>=0?"var(--save)":"var(--danger)";
  const colorSaldoUsd=saldoUsd>=0?"var(--save)":"var(--danger)";
  let html=`<div class="inset">
    <div class="seccion-label">Saldo neto</div>
    ${saldoArs!==0||depositadoArs>0||retiradoArs>0?`<div style="font-size:20px;font-weight:600;color:${colorSaldo};margin-top:3px">${fmtSignoGrande(saldoArs)}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:3px">Depositado: <span style="color:var(--save)">${fmtS(depositadoArs)}</span> · Retirado: <span style="color:var(--danger)">${fmtS(retiradoArs)}</span></div>`:""}
    ${saldoUsd!==0||depositadoUsd>0||retiradoUsd>0?`<div style="font-size:${saldoArs!==0?'15px':'20px'};font-weight:600;color:${colorSaldoUsd};margin-top:8px">USD ${saldoUsd>=0?'+':''}${saldoUsd.toFixed(2)}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:3px">Depositado: <span style="color:var(--save)">USD ${depositadoUsd.toFixed(2)}</span> · Retirado: <span style="color:var(--danger)">USD ${retiradoUsd.toFixed(2)}</span></div>`:""}
    <div style="font-size:12px;color:var(--muted);margin-top:6px">${movsCat.length} ${movsCat.length===1?"movimiento":"movimientos"}</div>
  </div>`;
  html+=movsCat.map(m=>{
    const esRetiro=!!m.usaAhorro;
    const esUSD=m.moneda==="USD";
    const signo=esRetiro?"-":"+";
    const color=esRetiro?"var(--danger)":"var(--save)";
    const montoTxt=esUSD?`USD ${(m.importeOrig||0).toFixed(2)}`:fmtS(m.importe||0);
    const badge=esRetiro
      ?`<span class="badge badge-danger">RETIRO</span>`
      :`<span class="badge badge-save">DEPÓSITO</span>`;
    const badgeMoneda=esUSD?`<span class="badge badge-accent">USD</span>`:"";
    const fecha=(m.fecha||"").split("-").reverse().join("/");
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
      <div class="u-flex1 u-min0">
        <div class="txt-md txt-strong">${escapeHtml(m.subcat||m.cat)} ${badge} ${badgeMoneda}</div>
        <div class="txt-xs txt-muted">${fecha}${m.nota?" · "+escapeHtml(m.nota):""}</div>
      </div>
      <div style="text-align:right;display:flex;align-items:center;gap:8px;flex-shrink:0">
        <div style="font-size:14px;font-weight:600;color:${color}">${signo}${montoTxt}</div>
        <button class="tx-edit" onclick="closeAhorroCatDetail();openEditModal(${m.id})" title="Editar">✎</button>
        <button class="tx-del" onclick="borrarMovDesdeAhorroCat(${m.id},${attrJS(cat)},this)" title="Eliminar">×</button>
      </div>
    </div>`;
  }).join("");
  document.getElementById("ahorrocat-detail-content").innerHTML=html;
  document.getElementById("modal-ahorrocat-detail").classList.add("open");
}
function closeAhorroCatDetail(){
  document.getElementById("modal-ahorrocat-detail").classList.remove("open");
}
// Elimina un depósito/retiro desde el detalle de categoría de ahorro (doble-toque de confirmación).
function borrarMovDesdeAhorroCat(id, cat, btn){
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
  renderMovs();
  renderAhorro();
  // Si todavía quedan movimientos de esta categoría, refrescar el modal; si no, cerrarlo.
  const {depositos, retiros}=ahorroState;
  const quedan=[...depositos, ...retiros].some(m=>(m.cat||"Sin categoría")===cat);
  if(quedan) showAhorroCatDetail(cat);
  else closeAhorroCatDetail();
}

