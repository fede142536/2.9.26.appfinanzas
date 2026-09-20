// ═══════════════════════════════════════════
// MEP: LAS DOS PATAS SON UNA SOLA OPERACIÓN
// ═══════════════════════════════════════════
// Un MEP se carga como DOS movimientos de inversión con tickers distintos: la compra del bono en
// pesos (AL30) y su venta en dólares (AL30D). Pero no son dos inversiones: es UN cambio de
// moneda. Pasaste pesos a dólares, no compraste nada que siga en tu cartera.
//
// Contadas como inversiones, las dos mienten en direcciones opuestas:
//   · la pata en pesos queda como capital puesto en un ticker que nunca se vende, así que el
//     AL30 figura invertido para siempre — con los datos reales, $60.902,20 que no existen;
//   · la pata en dólares es una venta sin ninguna compra detrás, así que la venta entera cuenta
//     como ganancia.
//
// cambio-moneda.js ya sabe representar un cambio, pero solo ofrecía completar la pata en pesos
// pidiendo a mano los dólares — y los dólares YA estaban cargados en la otra pata. Completarla
// así los contaba dos veces. Acá se emparejan las dos que ya existen.
//
// El emparejado se propone, no se aplica solo: se muestra el tipo de cambio que sale de cada
// par, que es lo que hace obvio un emparejado mal hecho. Dos pares del mismo día a $1.544 y a
// $1.545 están bien; uno a $1.544 y otro a $30.000 no.

const MEP_IGNORADOS_KEY = "fmepignorados";
// Los dólares de un MEP no caen el mismo día: hay un parking de un par de días hábiles.
const MEP_DIAS_MAX = 10;

function idsIgnoradosMEP(){
  return leerJSONSeguro(MEP_IGNORADOS_KEY, "[]", "array");
}
function ignorarMEP(clave){
  const ids=idsIgnoradosMEP();
  if(!ids.includes(clave)) ids.push(clave);
  guardarJSONSeguro(MEP_IGNORADOS_KEY, ids);
}
function limpiarIgnoradosMEP(){
  guardarJSONSeguro(MEP_IGNORADOS_KEY, []);
}

function diasEntre(a, b){
  const da=new Date(a+"T00:00:00"), db=new Date(b+"T00:00:00");
  if(isNaN(da.getTime())||isNaN(db.getTime())) return null;
  return Math.round((db-da)/86400000);
}

// La pata en pesos: una COMPRA de inversión con monto solo en pesos y pinta de MEP.
function esPataPesosMEP(m){
  if(!m || m.tipo!=="Inversion" || esPataDeCambio(m)) return false;
  if(isInvSalida(m)) return false;
  if(!(m.importe>0) || (m.importeUSD>0)) return false;
  return CAMBIO_PISTAS.test(`${m.cat||""} ${m.subcat||""} ${m.nota||""}`);
}
// La pata en dólares: una VENTA de inversión con monto solo en dólares y pinta de MEP.
function esPataDolaresMEP(m){
  if(!m || m.tipo!=="Inversion" || esPataDeCambio(m)) return false;
  if(!isInvSalida(m)) return false;
  if(!(m.importeUSD>0) || (m.importe>0)) return false;
  return CAMBIO_PISTAS.test(`${m.cat||""} ${m.subcat||""} ${m.nota||""}`);
}

// Empareja cada compra en pesos con la venta en dólares más cercana que venga DESPUÉS (el
// parking) y todavía esté libre. Una venta en dólares suelta —sin ninguna compra en pesos cerca—
// no se propone: esa es la otra cosa, una posición anterior a la app.
function candidatosAMEP(lista){
  const fuente=lista || (typeof movs!=="undefined" ? movs : []);
  const ignorados=new Set(idsIgnoradosMEP());
  const pesos=fuente.filter(esPataPesosMEP).slice().sort(ordenDeOperacion);
  const dolares=fuente.filter(esPataDolaresMEP).slice().sort(ordenDeOperacion);
  const usados=new Set();
  const out=[];
  pesos.forEach(p=>{
    let mejor=null, mejorDias=null;
    dolares.forEach(d=>{
      if(usados.has(d.id)) return;
      const dias=diasEntre(String(p.fecha).slice(0,10), String(d.fecha).slice(0,10));
      if(dias==null || dias<0 || dias>MEP_DIAS_MAX) return;
      if(mejorDias==null || dias<mejorDias){ mejor=d; mejorDias=dias; }
    });
    if(!mejor) return;
    usados.add(mejor.id);
    const clave=p.id+"|"+mejor.id;
    if(ignorados.has(clave)) return;
    out.push({
      clave, idArs:p.id, idUsd:mejor.id,
      fechaArs:p.fecha, fechaUsd:mejor.fecha, dias:mejorDias,
      ars:Math.round(p.importe*100)/100,
      usd:Math.round(mejor.importeUSD*100)/100,
      tipoCambio:Math.round(p.importe/mejor.importeUSD*100)/100,
      tickerArs:p.ticker||"", tickerUsd:mejor.ticker||"",
      catArs:p.cat||"", catUsd:mejor.cat||""
    });
  });
  return out.sort((a,b)=>String(b.fechaArs).localeCompare(String(a.fechaArs)));
}

function totalPesosEnMEP(lista){
  return Math.round(candidatosAMEP(lista).reduce((s,c)=>s+c.ars,0)*100)/100;
}

// ═══════════════════════════════════════════
// UNIR Y SEPARAR
// ═══════════════════════════════════════════
// Las dos patas se convierten en un cambio de moneda: dejan de ser Inversion (y por lo tanto
// dejan de sumar capital y de generar ganancia) y pasan a ser las dos mitades de una sola
// operación. No se borra nada: los dos movimientos siguen existiendo, con otra forma, y
// separarMEP() los devuelve a como estaban.
function unirMEP(idArs, idUsd){
  const a=movs.find(m=>m.id===idArs), u=movs.find(m=>m.id===idUsd);
  if(!a || !u) return false;
  const cambioId=a.id;
  const usd=u.importeUSD;

  a.mepOrig={tipo:a.tipo, ticker:a.ticker||""};
  a.tipo="Gasto"; a.moneda="ARS"; a.importeOrig=null;
  delete a.importeUSD; delete a.ticker;
  a.cambioId=cambioId; a.cambioPata="sale";
  a.esAhorro=false; a.usaAhorro=false;

  u.mepOrig={tipo:u.tipo, ticker:u.ticker||""};
  u.tipo="Ingreso"; u.moneda="USD"; u.importe=0; u.importeOrig=usd;
  delete u.importeUSD; delete u.ticker;
  u.cambioId=cambioId; u.cambioPata="entra";
  u.esAhorro=false; u.usaAhorro=false; u.recuperable=0;

  // La posición inicial de ese ticker se había cargado para tapar justamente estas ventas sin
  // compra detrás. Si sigue entera, esos dólares quedan ahora como capital invertido que no
  // existe: se descuenta lo que esta pata dejó de vender.
  ajustarPosIniTrasMEP(u.mepOrig.ticker, usd);
  save();
  return true;
}

function ajustarPosIniTrasMEP(ticker, usd){
  const p=posicionInicial[ticker];
  if(!p || !(Number(p.usd)>0)) return;
  p.usd=Math.max(0, Math.round((Number(p.usd)-usd)*100)/100);
  if(!Number(p.usd) && !Number(p.ars)) delete posicionInicial[ticker];
  if(typeof savePosicionInicial==="function") savePosicionInicial();
}

function separarMEP(cambioId){
  const patas=movs.filter(m=>m.cambioId===cambioId && m.mepOrig);
  if(!patas.length) return false;
  patas.forEach(m=>{
    const orig=m.mepOrig;
    if(m.cambioPata==="entra"){ m.importeUSD=m.importeOrig||0; m.importe=0; }
    else { m.importeUSD=0; }
    m.tipo=orig.tipo;
    if(orig.ticker) m.ticker=orig.ticker;
    delete m.moneda; delete m.importeOrig; delete m.cambioId; delete m.cambioPata;
    delete m.mepOrig; delete m.recuperable;
  });
  save();
  return true;
}

function unirMEPDesdeCard(idArs, idUsd){
  if(!unirMEP(idArs, idUsd)) return;
  showToast("Unidas como cambio de moneda ✓");
  refrescarTrasMEP();
}
function descartarMEP(clave){
  ignorarMEP(clave);
  refrescarTrasMEP();
}
function revisarDescartadosMEP(){
  limpiarIgnoradosMEP();
  refrescarTrasMEP();
}
function refrescarTrasMEP(){
  if(typeof renderMEP==="function") renderMEP();
  if(typeof renderInv==="function") renderInv();
  if(typeof renderMovs==="function") renderMovs();
  if(typeof renderDash==="function") renderDash();
}

// ═══════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════
function renderMEP(){
  const card=document.getElementById("card-mep");
  const el=document.getElementById("mep-lista");
  if(!card||!el) return;
  const cands=candidatosAMEP(movs);
  const descartados=idsIgnoradosMEP().length;
  if(!cands.length && !descartados){ card.style.display="none"; return; }
  card.style.display="block";

  if(!cands.length){
    el.innerHTML=`<div class="inset">
      <div class="txt-md">No queda ninguno sin revisar.</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">Descartaste ${descartados}.</div>
    </div>
    <button class="btn-sm" style="width:100%;margin-top:10px" onclick="revisarDescartadosMEP()">Volver a revisarlos</button>`;
    return;
  }

  let html=`<div class="inset mb-10">
    <div class="txt-md txt-strong">${fmtS(totalPesosEnMEP(movs))} figuran invertidos</div>
    <div class="txt-xs txt-muted" style="margin-top:4px">Son pesos que pasaste a dólares, no plata puesta en un bono. Mirá que el tipo de cambio de cada par tenga sentido antes de unirlos.</div>
  </div>`;
  html+=cands.map(c=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <div class="u-flex1 u-min0">
          <div class="txt-md txt-strong">${escapeHtml(c.tickerArs)} → ${escapeHtml(c.tickerUsd)}</div>
          <div class="txt-xs txt-muted">${escapeHtml(mesLbl(String(c.fechaArs).slice(0,7)))} · ${c.dias===0?"el mismo día":c.dias===1?"1 día después":c.dias+" días después"}</div>
        </div>
        <div style="text-align:right">
          <div class="txt-md txt-strong" style="color:var(--invest)">${fmtS(c.ars)}</div>
          <div class="txt-xs" style="color:var(--success)">→ USD ${c.usd.toFixed(2)}</div>
        </div>
      </div>
      <div class="txt-xs txt-muted" style="margin-top:6px">Tipo de cambio: <strong>${fmtS(c.tipoCambio)}</strong> por dólar</div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn-sm" style="flex:1" onclick="unirMEPDesdeCard(${c.idArs},${c.idUsd})">Es un MEP: unirlas</button>
        <button class="btn-sm" style="flex:1" onclick="descartarMEP(${attrJS(c.clave)})">Son operaciones distintas</button>
      </div>
    </div>`).join("");
  if(descartados){
    html+=`<button class="btn-sm" style="width:100%;margin-top:10px" onclick="revisarDescartadosMEP()">Volver a revisar ${descartados===1?"el descartado":"los "+descartados+" descartados"}</button>`;
  }
  el.innerHTML=html;
}
