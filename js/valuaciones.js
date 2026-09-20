// ═══════════════════════════════════════════
// CUÁNTO VALE HOY: EL RESULTADO NO REALIZADO
// ═══════════════════════════════════════════
// Hasta acá el resultado era solo el REALIZADO: lo que ganaste o perdiste en operaciones que ya
// cerraste. De una posición abierta la app sabe cuánto pusiste, y nada más — no guarda precios
// ni los va a buscar a ningún lado. Si tenés $158.486 en SPY y hoy vale $140.000, esos $18.486
// perdidos no existían en ninguna pantalla.
//
// Acá se guarda, por ticker, cuánto vale hoy la posición. Lo cargás vos: es el único que puede
// mirarlo en el broker. Con eso sale el NO REALIZADO = lo que vale hoy − lo que pusiste.
//
// No se mezcla con el resultado del mes ni con el balance, a propósito. Esos son plata que entró
// o salió de verdad; esto es una foto de algo que todavía no pasó y que cambia todos los días.
// Mezclarlos haría que el resultado de un mes cerrado cambie con la cotización de mañana.

const VALUACIONES_KEY = "fvaluaciones";
// A partir de acá el valor cargado ya no dice mucho: se muestra igual, pero avisando.
const VALUACION_DIAS_VIEJA = 30;

function saveValuaciones(){
  guardarJSONSeguro(VALUACIONES_KEY, valuaciones);
  marcarDatosSucios();
}

function valuacionDe(ticker){
  const v=(valuaciones||{})[ticker];
  if(!v) return null;
  return {ars:Number(v.ars)||0, usd:Number(v.usd)||0, fecha:v.fecha||""};
}

function fijarValuacion(ticker, ars, usd, fecha){
  const a=Number(ars)||0, u=Number(usd)||0;
  if(a<0 || u<0) return false;
  // Cargar 0 en las dos monedas es decir "no vale nada", que es distinto de no haberlo cargado.
  valuaciones[ticker]={
    ars: Math.round(a*100)/100,
    usd: Math.round(u*100)/100,
    fecha: fecha || currentYMD()
  };
  saveValuaciones();
  return true;
}

function borrarValuacion(ticker){
  delete valuaciones[ticker];
  saveValuaciones();
}

function diasDesde(fecha){
  if(!fecha) return null;
  const d=new Date(fecha+"T00:00:00"), hoy=new Date(currentYMD()+"T00:00:00");
  if(isNaN(d.getTime())) return null;
  return Math.round((hoy-d)/86400000);
}

// ═══════════════════════════════════════════
// EL CÁLCULO
// ═══════════════════════════════════════════
// Una posición abierta es un ticker con capital adentro. Las cerradas no se valúan: ya no las
// tenés, y su resultado es el realizado.
function posicionesAbiertas(lista){
  return capitalPorTicker(lista);
}

// Por ticker: lo que pusiste, lo que vale hoy (si lo cargaste) y la diferencia.
function noRealizadoPorTicker(lista){
  return posicionesAbiertas(lista).map(p=>{
    const v=valuacionDe(p.ticker);
    return {
      ticker: p.ticker,
      capital: {ars:p.ars, usd:p.usd},
      valor: v ? {ars:v.ars, usd:v.usd} : null,
      fecha: v ? v.fecha : "",
      dias: v ? diasDesde(v.fecha) : null,
      dif: v ? {ars: Math.round((v.ars-p.ars)*100)/100,
                usd: Math.round((v.usd-p.usd)*100)/100}
             : {ars:0, usd:0}
    };
  });
}

// El total, contando SOLO las posiciones que valuaste: sumar las otras como si valieran lo que
// pusiste inventaría un "no realizado 0" que no sabés si es cierto. Por eso se devuelve también
// cuántas quedaron sin valuar, para poder decirlo en pantalla.
function noRealizadoTotal(lista){
  const filas=noRealizadoPorTicker(lista);
  const out={ars:0, usd:0, capitalValuado:{ars:0, usd:0}, valor:{ars:0, usd:0},
             valuadas:0, sinValuar:0, diasMasViejo:null};
  filas.forEach(f=>{
    if(!f.valor){ out.sinValuar++; return; }
    out.valuadas++;
    out.ars+=f.dif.ars; out.usd+=f.dif.usd;
    out.capitalValuado.ars+=f.capital.ars; out.capitalValuado.usd+=f.capital.usd;
    out.valor.ars+=f.valor.ars; out.valor.usd+=f.valor.usd;
    if(f.dias!=null && (out.diasMasViejo==null || f.dias>out.diasMasViejo)) out.diasMasViejo=f.dias;
  });
  ["ars","usd"].forEach(k=>{
    out[k]=Math.round(out[k]*100)/100;
    out.capitalValuado[k]=Math.round(out.capitalValuado[k]*100)/100;
    out.valor[k]=Math.round(out.valor[k]*100)/100;
  });
  return out;
}

// Realizado (lo que ya pasó por caja) + no realizado (la foto de hoy). Se devuelven separados
// además del total, porque no son la misma clase de número y la pantalla los muestra aparte.
function resultadoCompleto(lista){
  const gan=resultadoInv(lista).gananciaPorMes;
  const real={ars:0, usd:0};
  Object.keys(gan).forEach(ym=>{ real.ars+=gan[ym].ars; real.usd+=gan[ym].usd; });
  real.ars=Math.round(real.ars*100)/100;
  real.usd=Math.round(real.usd*100)/100;
  const noReal=noRealizadoTotal(lista);
  return {
    realizado: real,
    noRealizado: {ars:noReal.ars, usd:noReal.usd},
    total: {ars: Math.round((real.ars+noReal.ars)*100)/100,
            usd: Math.round((real.usd+noReal.usd)*100)/100},
    valuadas: noReal.valuadas,
    sinValuar: noReal.sinValuar,
    diasMasViejo: noReal.diasMasViejo
  };
}

// ═══════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════
function renderValuaciones(){
  const card=document.getElementById("card-valuaciones");
  const el=document.getElementById("valuaciones-cuerpo");
  if(!card||!el) return;

  const abiertas=posicionesAbiertas(movs);
  if(!abiertas.length){ card.style.display="none"; return; }
  card.style.display="block";

  const r=resultadoCompleto(movs);
  const filas=noRealizadoPorTicker(movs);
  let html="";

  if(!r.valuadas){
    html+=`<div class="inset mb-10">
      <div class="txt-md">Todavía no cargaste cuánto valen tus posiciones.</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">Sin eso, la app solo sabe el resultado de lo que ya vendiste: de lo que tenés abierto conoce cuánto pusiste, no cuánto vale.</div>
    </div>`;
  } else {
    const cNR=r.noRealizado.ars>=0?"var(--success)":"var(--danger)";
    html+=`<div class="seccion-label mb-6">No realizado</div>
      <div style="font-size:24px;font-weight:600;color:${cNR};margin-bottom:2px" data-animar="${r.noRealizado.ars}" data-animar-fmt="fmtTotalMas">${fmtTotal(0)}</div>`;
    if(Math.abs(r.noRealizado.usd)>=0.01){
      const cu=r.noRealizado.usd>=0?"var(--success)":"var(--danger)";
      html+=`<div style="font-size:13px;font-weight:600;color:${cu};margin-bottom:4px">${r.noRealizado.usd>=0?"+":""}USD ${r.noRealizado.usd.toFixed(2)}</div>`;
    }
    const nrt=noRealizadoTotal(movs);
    html+=`<div style="font-size:12px;color:var(--muted);margin-top:6px">📤 pusiste <strong style="color:var(--invest)">${fmtS(nrt.capitalValuado.ars)}</strong> · 💰 vale hoy <strong>${fmtS(nrt.valor.ars)}</strong></div>`;
    // Realizado y no realizado no se suman en un solo número grande a propósito: uno ya pasó
    // por caja y el otro cambia con la cotización de mañana.
    const cR=r.realizado.ars>=0?"var(--success)":"var(--danger)";
    const cT=r.total.ars>=0?"var(--success)":"var(--danger)";
    html+=`<div style="font-size:12px;color:var(--muted);margin-top:3px">📊 realizado <strong style="color:${cR}">${fmtTotalMas(r.realizado.ars)}</strong> · en total <strong style="color:${cT}">${fmtTotalMas(r.total.ars)}</strong></div>`;
    if(r.sinValuar){
      html+=`<div class="txt-xs txt-muted" style="margin-top:6px">No incluye ${r.sinValuar} ${r.sinValuar===1?"posición sin valuar":"posiciones sin valuar"}.</div>`;
    }
    if(r.diasMasViejo!=null && r.diasMasViejo>VALUACION_DIAS_VIEJA){
      html+=`<div class="txt-xs" style="color:var(--warning);margin-top:6px">⚠️ El valor más viejo es de hace ${r.diasMasViejo} días.</div>`;
    }
    html+=`<div style="height:14px"></div>`;
  }

  html+=filas.map(f=>{
    const dif=f.valor ? f.dif.ars : 0;
    const c=!f.valor ? "var(--muted)" : (dif>=0?"var(--success)":"var(--danger)");
    const derecha=f.valor
      ? `<div style="font-size:13px;font-weight:600;color:${c}">${fmtTotalMas(dif)}</div>
         <div class="txt-xs txt-muted">vale ${fmtS(f.valor.ars)}${Math.abs(f.valor.usd)>=0.01?" + USD "+f.valor.usd.toFixed(2):""}</div>`
      : `<div class="txt-xs txt-muted">sin valuar</div>`;
    const antiguedad=(f.dias!=null && f.dias>VALUACION_DIAS_VIEJA)
      ? ` · <span style="color:var(--warning)">hace ${f.dias} días</span>` : "";
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div class="u-flex1 u-min0">
        <div class="txt-md txt-strong">${escapeHtml(f.ticker)}</div>
        <div class="txt-xs txt-muted">pusiste ${fmtS(f.capital.ars)}${Math.abs(f.capital.usd)>=0.01?" + USD "+f.capital.usd.toFixed(2):""}${antiguedad}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">${derecha}</div>
    </div>`;
  }).join("");

  html+=`<button class="btn-primary" style="width:100%;margin-top:12px" onclick="abrirModalValuaciones()">${r.valuadas?"Actualizar valores":"Cargar valores"}</button>`;
  el.innerHTML=html;
  animarNumerosDe(el);
}

// ═══════════════════════════════════════════
// MODAL DE CARGA
// ═══════════════════════════════════════════
function abrirModalValuaciones(){
  const cont=document.getElementById("valuaciones-form");
  const modal=document.getElementById("modal-valuaciones");
  if(!cont||!modal) return;
  const filas=noRealizadoPorTicker(movs);
  if(!filas.length){
    cont.innerHTML=`<p class="txt-md txt-muted">No tenés ninguna posición abierta.</p>`;
  } else {
    cont.innerHTML=filas.map(f=>{
      const id=valIdSeguro(f.ticker);
      const usd=Math.abs(f.capital.usd)>=0.01;
      return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div class="txt-md txt-strong">${escapeHtml(f.ticker)}</div>
        <div class="txt-xs txt-muted" style="margin-bottom:6px">Pusiste ${fmtS(f.capital.ars)}${usd?" + USD "+f.capital.usd.toFixed(2):""}</div>
        <div class="amount-wrap">
          <span class="amount-prefix">$</span>
          <input type="number" inputmode="decimal" step="0.01" min="0" class="form-input" style="padding-left:28px"
                 id="valar-${id}" placeholder="¿Cuánto vale hoy?" value="${f.valor?f.valor.ars:""}">
        </div>
        ${usd?`<div class="amount-wrap" style="margin-top:6px">
          <span class="amount-prefix">USD</span>
          <input type="number" inputmode="decimal" step="0.01" min="0" class="form-input" style="padding-left:46px"
                 id="valusd-${id}" placeholder="¿Cuánto vale en dólares?" value="${f.valor?f.valor.usd:""}">
        </div>`:""}
      </div>`;
    }).join("");
  }
  modal.classList.add("open");
}

function cerrarModalValuaciones(){
  const modal=document.getElementById("modal-valuaciones");
  if(modal) modal.classList.remove("open");
}

// El ticker lo escribe el usuario y termina adentro de un id y de un querySelector.
function valIdSeguro(txt){
  return String(txt||"").replace(/[^A-Za-z0-9_-]/g, "_");
}

function guardarValuaciones(){
  const filas=noRealizadoPorTicker(movs);
  let cargadas=0, borradas=0;
  filas.forEach(f=>{
    const id=valIdSeguro(f.ticker);
    const inpA=document.querySelector("#valar-"+id);
    const inpU=document.querySelector("#valusd-"+id);
    const txtA=inpA ? String(inpA.value).trim() : "";
    const txtU=inpU ? String(inpU.value).trim() : "";
    // Vaciar los dos campos es borrar la valuación, no cargar un cero.
    if(!txtA && !txtU){
      if(valuacionDe(f.ticker)){ borrarValuacion(f.ticker); borradas++; }
      return;
    }
    const a=parseFloat(txtA)||0, u=parseFloat(txtU)||0;
    if(a<0 || u<0) return;
    if(fijarValuacion(f.ticker, a, u)) cargadas++;
  });
  cerrarModalValuaciones();
  const partes=[];
  if(cargadas) partes.push(`${cargadas} ${cargadas===1?"valor cargado":"valores cargados"}`);
  if(borradas) partes.push(`${borradas} ${borradas===1?"borrado":"borrados"}`);
  showToast(partes.length ? partes.join(" · ")+" ✓" : "Sin cambios");
  refrescarTrasValuacion();
}

function refrescarTrasValuacion(){
  renderValuaciones();
  if(typeof renderInv==="function") renderInv();
}
