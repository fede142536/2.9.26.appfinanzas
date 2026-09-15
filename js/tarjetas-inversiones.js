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
// TARJETAS
// ═══════════════════════════════════════════
function cambiarMesTc(delta){
  mesTc = addMonths(mesTc, delta);
  renderTarjetas();
}

function renderTarjetas(){
  const ymSel = mesTc;
  const hoyYM = currentYM();
  document.getElementById("tc-mes-label").textContent=mesLbl(ymSel);

  // Activas/Completadas se calculan respecto a HOY (no al mes seleccionado)
  // porque indican el estado real de la tarjeta, no si tenía actividad ese mes.
  const activas = tcs.filter(t=>{
    if(t.frecuente){
      return !t.mesFin || t.mesFin>=hoyYM;
    }
    return t.mesInicio && addMonths(t.mesInicio, t.cuotasTotal-1) >= hoyYM;
  });
  const completas = tcs.filter(t=>{
    if(t.frecuente){
      return t.mesFin && t.mesFin<hoyYM;
    }
    return !t.mesInicio || addMonths(t.mesInicio, t.cuotasTotal-1) < hoyYM;
  });

  // ── BALANCE DEL MES SELECCIONADO ──
  const movsMes = getTcMovsEnMes(ymSel);
  const movsMesARS = movsMes.filter(m=>m.moneda!=="USD");
  const movsMesUSD = movsMes.filter(m=>m.moneda==="USD");
  const totalMesARS = movsMesARS.reduce((s,m)=>s+m.importe,0);
  const totalMesUSD = movsMesUSD.reduce((s,m)=>s+m.importe,0);
  const cantidadMes = movsMes.length;
  // Subtotales por tarjeta (Visa, Master, etc.) — separados por moneda
  const porTarjeta = {};
  movsMes.forEach(m=>{
    const key=`${m.tarjeta}|${m.moneda||"ARS"}`;
    porTarjeta[key] = (porTarjeta[key]||0) + m.importe;
  });
  // Saldo pendiente (cuotas no terminadas, calculado al día de hoy) — separado por moneda
  const saldoPendienteARS = activas.filter(t=>!t.frecuente && t.moneda!=="USD").reduce((acc,tc)=>{
    const nActual = getCuotaEnMes(tc, hoyYM)||1;
    const restantes = tc.cuotasTotal - nActual + 1;
    return acc + (tc.total/tc.cuotasTotal)*Math.max(0,restantes);
  },0);
  const saldoPendienteUSD = activas.filter(t=>!t.frecuente && t.moneda==="USD").reduce((acc,tc)=>{
    const nActual = getCuotaEnMes(tc, hoyYM)||1;
    const restantes = tc.cuotasTotal - nActual + 1;
    return acc + (tc.total/tc.cuotasTotal)*Math.max(0,restantes);
  },0);

  let chipsHTML=`<div class="chip"><div class="chip-label">Total ARS</div><div class="chip-val negative">${fmtS(totalMesARS)}</div></div>`;
  if(totalMesUSD>0){
    chipsHTML+=`<div class="chip"><div class="chip-label">Total USD</div><div class="chip-val negative">USD ${totalMesUSD.toFixed(2)}</div></div>`;
  }
  chipsHTML+=`<div class="chip"><div class="chip-label">Gastos</div><div class="chip-val warn">${cantidadMes}</div></div>`;
  chipsHTML+=`<div class="chip"><div class="chip-label">Pendiente ARS</div><div class="chip-val negative">${fmtS(saldoPendienteARS)}</div></div>`;
  if(saldoPendienteUSD>0){
    chipsHTML+=`<div class="chip"><div class="chip-label">Pendiente USD</div><div class="chip-val negative">USD ${saldoPendienteUSD.toFixed(2)}</div></div>`;
  }
  document.getElementById("tc-summary").innerHTML=chipsHTML;

  // Card Balance del mes con desglose por tarjeta
  const balanceEl=document.getElementById("tc-balance");
  if(balanceEl){
    const esMesActual = ymSel===hoyYM;
    let html=`<div class="seccion-label seccion-label-sep">${esMesActual?"A pagar este mes":"Total "+mesLbl(ymSel)}</div>
      <div style="display:flex;gap:14px;align-items:baseline;margin-bottom:6px;flex-wrap:wrap">
        <div style="font-size:24px;font-weight:600;color:var(--warning)">${fmtS(totalMesARS)}</div>
        ${totalMesUSD>0?`<div style="font-size:18px;font-weight:600;color:var(--warning)">+ USD ${totalMesUSD.toFixed(2)}</div>`:""}
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px">${cantidadMes} ${cantidadMes===1?"gasto":"gastos"} en este mes</div>`;
    const tarjEntries=Object.entries(porTarjeta).sort((a,b)=>b[1]-a[1]);
    if(tarjEntries.length){
      html+=`<div class="seccion-label seccion-label-sep">Por tarjeta</div>`;
      const maxV=tarjEntries[0][1];
      html+=tarjEntries.map(([key,val])=>{
        const [tarj, moneda]=key.split("|");
        const fmt=moneda==="USD"?`USD ${val.toFixed(2)}`:fmtS(val);
        const monedaBadge=moneda==="USD"?` <span class="badge badge-accent">USD</span>`:"";
        return `<div class="bar-row" style="margin-bottom:6px">
          <div class="bar-label">💳 ${escapeHtml(tarj)}${monedaBadge}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(val/maxV*100)}%;background:var(--warning)"></div></div>
          <div class="bar-val">${fmt}</div>
        </div>`;
      }).join("");
    } else {
      html+=`<p style="font-size:13px;color:var(--muted);text-align:center;padding:8px 0">Sin gastos en ${mesLbl(ymSel)}</p>`;
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
    // Proyección próximos 3 meses (siempre desde ymSel hacia adelante)
    const proyMeses=[1,2,3].map(i=>{
      const ym=addMonths(ymSel,i);
      const movsP=getTcMovsEnMes(ym);
      const totalARS=movsP.filter(m=>m.moneda!=="USD").reduce((s,m)=>s+m.importe,0);
      const totalUSD=movsP.filter(m=>m.moneda==="USD").reduce((s,m)=>s+m.importe,0);
      return {ym, totalARS, totalUSD};
    });
    if(proyMeses.some(p=>p.totalARS>0||p.totalUSD>0)){
      html+=`<div class="seccion-label mt-14 mb-6">Próximos meses</div>
        <div class="u-row">
          ${proyMeses.map(p=>`
            <div style="flex:1;text-align:center;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px">
              <div class="txt-micro txt-muted">${mesLbl(p.ym).slice(0,3)}</div>
              <div style="font-size:13px;font-weight:600;color:var(--warning);margin-top:2px">${fmtAbbr(p.totalARS)}</div>
              ${p.totalUSD>0?`<div style="font-size:10px;color:var(--accent);margin-top:2px">USD ${p.totalUSD.toFixed(0)}</div>`:""}
            </div>`).join("")}
        </div>`;
    }
    balanceEl.innerHTML=html;
  }

  // ── ACTIVAS ──
  const actEl=document.getElementById("tc-activas");
  if(!activas.length){actEl.innerHTML=`<div class="empty"><div class="empty-icon">✓</div>Sin cuotas activas</div>`;}
  else actEl.innerHTML=activas.map(t=>{
    if(t.frecuente){
      // Card para gasto frecuente
      const montoActual=getMontoEnMes(t,hoyYM);
      const mesesActivos=getCuotaEnMes(t,hoyYM)||0;
      const totalPagado=calcTotalFrecuente(t,t.mesInicio,hoyYM);
      const finTxt=t.mesFin?`Hasta ${mesLbl(t.mesFin)}`:"Sin fecha de fin";
      // Próximos 6 meses
      const proyeccion=[];
      for(let i=0;i<6;i++){
        const ym=addMonths(hoyYM,i);
        if(getCuotaEnMes(t,ym)>0){
          proyeccion.push({ym, monto: getMontoEnMes(t,ym), esActual: i===0});
        }
      }
      return `<div class="tc-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div class="u-flex1 u-min0">
            <div style="font-size:14px;font-weight:600">${escapeHtml(t.desc)} <span style="font-size:11px">🔁</span>${t.moneda==="USD"?` <span class="badge badge-accent">USD</span>`:""}</div>
            <div class="txt-xs txt-muted">${escapeHtml(t.tarjeta)} · ${escapeHtml(t.cat)} · Desde ${mesLbl(t.mesInicio)}</div>
          </div>
          <span class="tc-badge" style="background:var(--warning-light);color:var(--warning)">FRECUENTE</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted)">Monto actual</span><strong>${fmtMoneda(montoActual,t.moneda)}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:3px"><span style="color:var(--muted)">Meses activos</span><strong>${mesesActivos}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:3px"><span style="color:var(--muted)">Total pagado</span><strong>${fmtMoneda(totalPagado,t.moneda)}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:3px"><span style="color:var(--muted)">Vigencia</span><strong>${finTxt}</strong></div>
        ${Array.isArray(t.cambios)&&t.cambios.length?`
          <div style="margin-top:10px;font-size:11px;color:var(--muted)">
            <strong class="u-upper">Aumentos</strong>
            ${t.cambios.sort((a,b)=>a.desde.localeCompare(b.desde)).map(c=>`
              <div style="margin-top:3px">${mesLbl(c.desde)}: ${fmtMoneda(c.monto,t.moneda)}</div>
            `).join("")}
          </div>`:""}
        ${proyeccion.length>1?`
        <div style="margin-top:12px">
          <div class="seccion-label mb-6">Próximos meses</div>
          <div class="hscroll" style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none">
            ${proyeccion.map(p=>`
              <div class="hscroll-item" style="flex-shrink:0;text-align:center;background:${p.esActual?"var(--warning-light)":"var(--bg)"};border:1px solid ${p.esActual?"var(--warning)":"var(--border)"};border-radius:8px;padding:6px 10px">
                <div class="txt-micro txt-muted">${mesLbl(p.ym).slice(0,3)}</div>
                <div style="font-size:11px;font-weight:600;color:${p.esActual?"var(--warning)":"var(--text)"};margin-top:2px">${t.moneda==="USD"?"USD "+p.monto.toFixed(2):fmtS(p.monto)}</div>
              </div>`).join("")}
          </div>
        </div>`:""}
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="btn-sm u-flex1" onclick="openEditTcModal(${t.id})">✎ Editar / Aumento</button>
          <button class="btn-sm" style="color:var(--danger);flex:1" onclick="borrarTc(${t.id})">Eliminar</button>
        </div>
      </div>`;
    }
    // Card para cuotas
    const vc=Math.round(t.total/t.cuotasTotal*100)/100;
    const nActual=getCuotaEnMes(t,hoyYM)||1;
    const restantes=t.cuotasTotal-nActual+1;
    const pct=Math.round((nActual-1)/t.cuotasTotal*100);
    const mesUltima=addMonths(t.mesInicio,t.cuotasTotal-1);
    const proyeccion=[];
    for(let i=0;i<6;i++){
      const ym=addMonths(hoyYM,i);
      const nc=getCuotaEnMes(t,ym);
      if(nc>0) proyeccion.push({ym,nc});
    }
    return `<div class="tc-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div class="u-flex1 u-min0">
          <div style="font-size:14px;font-weight:600">${escapeHtml(t.desc)}${t.moneda==="USD"?` <span class="badge badge-accent">USD</span>`:""}</div>
          <div class="txt-xs txt-muted">${escapeHtml(t.tarjeta)} · ${escapeHtml(t.cat)}${t.fecha?" · "+t.fecha.split("-").reverse().join("/"):""}</div>
        </div>
        <span class="tc-badge">Cuota ${nActual}/${t.cuotasTotal}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted)">Por cuota</span><strong>${fmtMoneda(vc,t.moneda)}</strong></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:3px"><span style="color:var(--muted)">Total gasto</span><strong>${fmtMoneda(t.total,t.moneda)}</strong></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:3px"><span style="color:var(--muted)">Saldo pendiente</span><strong style="color:var(--danger)">${fmtMoneda(vc*restantes,t.moneda)}</strong></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:3px"><span style="color:var(--muted)">Última cuota</span><strong>${mesLbl(mesUltima)}</strong></div>
      <div class="tc-progress" style="margin-top:10px"><div class="tc-progress-fill" style="width:${pct}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:4px"><span>${nActual-1} pagadas</span><span>${restantes} restantes</span></div>
      ${proyeccion.length>1?`
      <div style="margin-top:12px">
        <div class="seccion-label mb-6">Próximas cuotas</div>
        <div class="hscroll" style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none">
          ${proyeccion.map(p=>`
            <div class="hscroll-item" style="flex-shrink:0;text-align:center;background:${p.nc===nActual?"var(--warning-light)":"var(--bg)"};border:1px solid ${p.nc===nActual?"var(--warning)":"var(--border)"};border-radius:8px;padding:6px 10px">
              <div class="txt-micro txt-muted">${mesLbl(p.ym).slice(0,3)}</div>
              <div style="font-size:12px;font-weight:600;color:${p.nc===nActual?"var(--warning)":"var(--text)"}">${p.nc}</div>
              <div class="txt-micro txt-muted">${t.moneda==="USD"?"USD "+vc.toFixed(2):fmtS(vc)}</div>
            </div>`).join("")}
        </div>
      </div>`:""}
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn-sm u-flex1" onclick="openEditTcModal(${t.id})">✎ Editar</button>
        <button class="btn-sm" style="color:var(--danger);flex:1" onclick="borrarTc(${t.id})">Eliminar</button>
      </div>
    </div>`;
  }).join("");

  // ── COMPLETAS (con botón editar) ──
  const doneEl=document.getElementById("tc-completas");
  if(!completas.length){doneEl.innerHTML=`<p class="txt-md txt-muted">Sin historial aún</p>`;return;}
  doneEl.innerHTML=completas.map(t=>{
    const subInfo=t.frecuente
      ? `${escapeHtml(t.tarjeta)} · 🔁 Mensual · ${mesLbl(t.mesInicio)}–${t.mesFin?mesLbl(t.mesFin):""}`
      : `${escapeHtml(t.tarjeta)} · ${t.cuotasTotal} cuotas · ${fmtMoneda(t.total,t.moneda)}`;
    return `<div class="tc-card" style="opacity:.75">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:14px;font-weight:600">${escapeHtml(t.desc)}</div>
          <div class="txt-xs txt-muted">${subInfo}</div>
        </div>
        <span class="tc-badge" style="background:var(--success-light);color:var(--success)">✓</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn-sm u-flex1" onclick="openEditTcModal(${t.id})">✎ Editar</button>
        <button class="btn-sm" style="color:var(--danger);flex:1" onclick="borrarTc(${t.id})">Eliminar</button>
      </div>
    </div>`;
  }).join("");
}

// Calcula el total pagado de un gasto frecuente desde mesDesde hasta mesHasta (inclusive).
function calcTotalFrecuente(tc, mesDesde, mesHasta){
  if(!tc.frecuente||!mesDesde||!mesHasta) return 0;
  let total=0;
  let cur=mesDesde;
  let i=0;
  while(cur<=mesHasta && i<600){
    if(getCuotaEnMes(tc,cur)>0) total+=getMontoEnMes(tc,cur);
    cur=addMonths(cur,1);
    i++;
  }
  return Math.round(total*100)/100;
}

async function borrarTc(id){
  const t=tcs.find(x=>x.id===id);
  if(!t) return;
  if(await mostrarConfirm(`¿Eliminar "${t.desc}"?`, {textoOk:"Eliminar", peligroso:true})){
    tcs=tcs.filter(x=>x.id!==id);
    save();
    renderTarjetas();
  }
}

// ═══════════════════════════════════════════
// INVERSIONES (pestaña dedicada)
// ═══════════════════════════════════════════
function cambiarMesInv(delta){
  mesInv = addMonths(mesInv, delta);
  renderInv();
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
    <div class="chip"><div class="chip-label">Balance ARS</div><div class="chip-val ${colorNeto}">${fmtS(totalARS)}</div></div>
    <div class="chip"><div class="chip-label">Balance USD</div><div class="chip-val ${colorNeto}">${totalUSD!==0?"USD "+totalUSD.toFixed(2):"—"}</div></div>
    <div class="chip"><div class="chip-label">Movimientos</div><div class="chip-val">${cantMes}</div></div>`;

  // ── BALANCE DEL MES (desglose por categoría y por ticker) ──
  const balanceEl=document.getElementById("inv-balance");
  if(!cantMes){
    balanceEl.innerHTML=`<p style="font-size:13px;color:var(--muted);text-align:center;padding:14px 0">Sin movimientos en ${mesLbl(ymSel)}</p>`;
  } else {
    const lblNeto=totalARS>=0?"Ingreso neto":"Gasto neto";
    let html=`<div class="seccion-label seccion-label-sep">${lblNeto} en ${mesLbl(ymSel)}</div>
      <div style="font-size:24px;font-weight:600;color:var(--${totalARS>=0?'success':'danger'});margin-bottom:6px">${fmtS(totalARS)}</div>
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
      html+=`<div class="seccion-label seccion-label-sep">Por categoría (balance)</div>`;
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
    <div class="chip"><div class="chip-label">Balance</div><div class="chip-val ${colorNeto}">${fmtS(totalARS)}</div></div>
    <div class="chip"><div class="chip-label">Ingresos</div><div class="chip-val positive">${fmtS(totalIngresosARS)}</div></div>
    <div class="chip"><div class="chip-label">Gastos</div><div class="chip-val negative">${fmtS(totalGastosARS)}</div></div>`;

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
    let html=`<div class="seccion-label seccion-label-sep">Top tickers (balance)</div>`;
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
        <div class="seccion-label seccion-label-sep">Monto vigente este mes</div>
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
        <div class="seccion-label seccion-label-sep">Historial de aumentos</div>
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

