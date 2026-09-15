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
  const depositos=movs.filter(m=>m.tipo==="Gasto"&&m.esAhorro);
  const retiros=movs.filter(m=>m.tipo==="Gasto"&&m.usaAhorro);
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

  // Actualizar título según fuente de datos
  const ahorroTitle=document.getElementById("fondo-title");
  if(ahorroTitle){
    ahorroTitle.textContent=usingUserData?"Mis ahorros":"Fondo de retiro (histórico)";
  }

  const fondoAcum=ahorrosArr.length?ahorrosArr[ahorrosArr.length-1].acum:0;
  const totalDepositado=depositos.reduce((s,m)=>s+m.importe,0);
  const totalRetirado=retiros.reduce((s,m)=>s+m.importe,0);
  const cantMovs=depositos.length+retiros.length;
  document.getElementById("fondo-kpis").innerHTML=`
    <div class="chip"><div class="chip-label">Disponible</div><div class="chip-val ${fondoAcum>=0?"save":"negative"}">${fmtS(fondoAcum)}</div></div>
    <div class="chip"><div class="chip-label">Depositado</div><div class="chip-val positive">${fmtS(totalDepositado)}</div></div>
    <div class="chip"><div class="chip-label">Retirado</div><div class="chip-val negative">${fmtS(totalRetirado)}</div></div>`;

  // Mensaje informativo
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

  // ── GRÁFICO Y RANKING DE AHORROS ──
  // Guardo los datos en una variable global para que setAhorroView pueda re-renderizar
  // sin recalcular todo cada vez
  ahorroState.ahorrosArr=ahorrosArr;
  ahorroState.depositos=depositos;
  ahorroState.retiros=retiros;
  renderAhorroChart();
  renderAhorroRanking();

  renderMetas();
  renderUSD();
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
  // Gastos USD normales (no ahorros ni retiros)
  const gastosUSD=movs
    .filter(m=>m.tipo==="Gasto"&&m.moneda==="USD"&&m.importeOrig&&!m.esAhorro&&!m.usaAhorro)
    .reduce((s,m)=>s+m.importeOrig,0);
  // Ahorros USD: depósitos al fondo USD
  const ahorrosUSD=movs
    .filter(m=>m.tipo==="Gasto"&&m.moneda==="USD"&&m.importeOrig&&m.esAhorro)
    .reduce((s,m)=>s+m.importeOrig,0);
  // Retiros del fondo USD
  const retirosUSD=movs
    .filter(m=>m.tipo==="Gasto"&&m.moneda==="USD"&&m.importeOrig&&m.usaAhorro)
    .reduce((s,m)=>s+m.importeOrig,0);

  // Si no hay ningún movimiento USD, no mostramos la card
  if(ingresosUSD===0 && gastosUSD===0 && ahorrosUSD===0 && retirosUSD===0){
    card.style.display="none";
    return;
  }
  card.style.display="block";

  // Cash disponible: ingresos - gastos
  const cashUSD = ingresosUSD - gastosUSD;
  // Fondo USD: ahorros - retiros
  const fondoUSD = ahorrosUSD - retirosUSD;

  const cashColor=cashUSD>=0?"save":"negative";
  const fondoColor=fondoUSD>=0?"save":"negative";
  document.getElementById("usd-kpis").innerHTML=`
    <div class="chip"><div class="chip-label">Cash USD</div><div class="chip-val ${cashColor}">USD ${cashUSD.toFixed(2)}</div></div>
    <div class="chip"><div class="chip-label">Fondo USD</div><div class="chip-val ${fondoColor}">USD ${fondoUSD.toFixed(2)}</div></div>
    <div class="chip"><div class="chip-label">Total</div><div class="chip-val save">USD ${(cashUSD+fondoUSD).toFixed(2)}</div></div>`;

  // Detalle desglosado
  let html=`<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Detalle</div>`;
  const items=[
    {label:"📥 Ingresos USD", val:ingresosUSD, signo:1},
    {label:"📤 Gastos USD", val:gastosUSD, signo:-1},
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

// ═══════════════════════════════════════════
// AHORROS — VISTAS Y RANKING POR CATEGORÍA
// ═══════════════════════════════════════════
const ahorroState = {
  view: localStorage.getItem("fahorrov")||"acum",
  ahorrosArr: [],
  depositos: [],
  retiros: []
};

// Cambia la vista del gráfico de ahorros y la guarda como preferencia
function setAhorroView(v){
  ahorroState.view=v;
  localStorage.setItem("fahorrov",v);
  document.querySelectorAll(".ahorro-view-btn").forEach(b=>{
    b.classList.toggle("active", b.dataset.view===v);
  });
  renderAhorroChart();
}

// Activa el botón de la vista actual al entrar a Ahorros
function syncAhorroViewButtons(){
  document.querySelectorAll(".ahorro-view-btn").forEach(b=>{
    b.classList.toggle("active", b.dataset.view===ahorroState.view);
  });
}

// Renderiza el gráfico de ahorros según la vista activa
function renderAhorroChart(){
  syncAhorroViewButtons();
  const canvas=document.getElementById("chart-fondo");
  if(!canvas) return;
  const tipEl=document.getElementById("ahorro-tooltip");
  // Se limpia el detalle y la selección porque acá se llega al cambiar de vista o cuando
  // cambiaron los datos: el punto que habías tocado ya no significa lo mismo en el gráfico
  // nuevo. El redibujo por un tap NO pasa por acá justamente para no borrar lo recién escrito.
  if(tipEl) tipEl.textContent="";
  limpiarSeleccionLinea();

  // Qué estás mirando, en una línea. Cada vista responde una pregunta distinta y sin esto
  // hay que deducirlo del nombre del botón.
  const descEl=document.getElementById("ahorro-view-desc");
  if(descEl){
    descEl.textContent={
      acum:      "Cuánto llevás ahorrado en total, mes a mes. El último punto es lo que tenés disponible hoy.",
      mensual:   "Cuánto pusiste o sacaste en cada mes por separado. Verde es depósito, rojo es retiro.",
      categoria: "Cuánto tenés guardado hoy en cada tipo de ahorro."
    }[ahorroState.view] || "";
  }

  const {ahorrosArr, depositos, retiros}=ahorroState;
  if(!ahorrosArr.length){
    const ctx=canvas.getContext("2d");
    canvas.width=canvas.offsetWidth||320;canvas.height=180;
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
      (ym,val)=>`${mesLbl(ym)}: ${fmtS(val)}`
    );
  } else if(view==="mensual"){
    // Vista mes a mes: barras (depósitos en verde, retiros en rojo)
    drawInteractiveBars(
      canvas,
      ahorrosArr.map(d=>d.mes),
      ahorrosArr.map(d=>d.monto),
      tipEl,
      (ym,val)=>{
        const lbl=val>=0?"Depositado":"Retirado";
        return `${mesLbl(ym)}: ${lbl} ${fmtS(Math.abs(val))}`;
      }
    );
  } else if(view==="categoria"){
    // Vista por categoría: barras horizontales con porcentaje
    // Calculamos el saldo neto por categoría: depósitos - retiros
    const porCat={};
    depositos.forEach(m=>{
      const c=m.cat||"Sin categoría";
      porCat[c]=(porCat[c]||0)+m.importe;
    });
    retiros.forEach(m=>{
      const c=m.cat||"Sin categoría";
      porCat[c]=(porCat[c]||0)-m.importe;
    });
    const entries=Object.entries(porCat).filter(([_,v])=>v!==0).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    drawInteractiveCatBars(canvas, entries, tipEl);
  }
}

// Ranking de categorías de ahorro: tarjeta debajo del gráfico
function renderAhorroRanking(){
  const el=document.getElementById("ahorro-ranking");
  if(!el) return;
  const {depositos, retiros}=ahorroState;
  if(!depositos.length && !retiros.length){el.innerHTML="";return;}

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
  if(!items.length){el.innerHTML="";return;}

  const totalAbs=items.reduce((s,it)=>s+Math.abs(it.saldoArs),0)||1;
  const maxV=Math.max(...items.map(it=>Math.abs(it.saldoArs)),1);

  let html=`<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">🏆 Ranking por categoría</div>`;
  html+=items.map(it=>{
    const pct=totalAbs>0?Math.round(Math.abs(it.saldoArs)/totalAbs*100):0;
    const c=it.saldoArs>=0?"var(--save)":"var(--danger)";
    const cUsd=it.saldoUsd>=0?"var(--save)":"var(--danger)";
    const icon=getIcon(it.cat,"🏦");
    const catEsc=attrJS(it.cat);
    return `<div role="button" tabindex="0" style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border);cursor:pointer" onclick="showAhorroCatDetail(${catEsc})">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
        <div style="font-size:13px;font-weight:600">${icon} ${escapeHtml(it.cat)}</div>
        <div style="text-align:right">
          ${it.saldoArs!==0?`<div style="font-size:13px;font-weight:600;color:${c}">${fmtS(it.saldoArs)}</div>`:""}
          ${it.saldoUsd!==0?`<div style="font-size:${it.saldoArs!==0?'11px':'13px'};font-weight:600;color:${cUsd}">USD ${it.saldoUsd.toFixed(2)}</div>`:""}
        </div>
      </div>
      <div style="background:var(--bg);height:6px;border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${maxV>0?Math.round(Math.abs(it.saldoArs)/maxV*100):0}%;background:${c}"></div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:3px;display:flex;justify-content:space-between">
        <span>${pct}% del total · ${it.count} ${it.count===1?"movimiento":"movimientos"}</span>
        <span>${it.depositadoArs>0?`+${fmtAbbr(it.depositadoArs)}`:""}${it.retiradoArs>0?` -${fmtAbbr(it.retiradoArs)}`:""}</span>
      </div>
    </div>`;
  }).join("");
  el.innerHTML=html;
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
    document.getElementById("ahorrocat-detail-content").innerHTML=`<p style="font-size:13px;color:var(--muted)">Sin movimientos.</p>`;
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
  let html=`<div style="background:var(--bg);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px">
    <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Saldo neto</div>
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
      ?`<span style="font-size:9px;background:var(--danger-light);color:var(--danger);padding:1px 6px;border-radius:8px;font-weight:500">RETIRO</span>`
      :`<span style="font-size:9px;background:var(--save-light);color:var(--save);padding:1px 6px;border-radius:8px;font-weight:500">DEPÓSITO</span>`;
    const badgeMoneda=esUSD?`<span style="font-size:9px;background:var(--accent-light);color:var(--accent);padding:1px 6px;border-radius:8px;font-weight:500">USD</span>`:"";
    const fecha=(m.fecha||"").split("-").reverse().join("/");
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${escapeHtml(m.subcat||m.cat)} ${badge} ${badgeMoneda}</div>
        <div style="font-size:11px;color:var(--muted)">${fecha}${m.nota?" · "+escapeHtml(m.nota):""}</div>
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

