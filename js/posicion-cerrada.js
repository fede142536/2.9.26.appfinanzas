// ═══════════════════════════════════════════
// POSICIONES CERRADAS: LAS PÉRDIDAS
// ═══════════════════════════════════════════
// Vender por menos de lo que pusiste dejaba la diferencia como "capital invertido" para
// siempre. El modelo no podía expresar una pérdida: todo resultado salía positivo o cero, y la
// pantalla mostraba plata puesta en posiciones que ya no existían. Con los datos reales, MCD
// —comprado a $54.238,57 y vendido a $53.581,03— figuraba con $657,54 todavía invertidos en vez
// de $657,54 perdidos.
//
// La app guarda montos, no cantidades, así que una venta más chica que el capital es ambigua:
// puede ser que vendiste todo a pérdida o que vendiste una parte. SPY, por ejemplo, tiene una
// venta de $77.916 sobre $236.403 puestos: eso es vender un tercio, no cerrar nada.
//
// Se proponen solo las que casi no dejan nada: una venta que devolvió la mayor parte del capital
// y después de la cual el ticker no se volvió a tocar. El resto se marca a mano desde la ficha
// del instrumento, que es donde se ve el monto que sobra.

const POSCERR_IGNORADOS_KEY = "fposcerrignorados";
// Cuánto del capital tiene que devolver una venta para que valga la pena preguntar. Con 80%,
// MCD entra (devolvió el 98,8%) y SPY no (devolvió el 33%).
const POSCERR_UMBRAL = 0.8;

function idsIgnoradosPosCerr(){
  return leerJSONSeguro(POSCERR_IGNORADOS_KEY, "[]", "array");
}
function ignorarPosCerr(clave){
  const ids=idsIgnoradosPosCerr();
  if(!ids.includes(clave)) ids.push(clave);
  guardarJSONSeguro(POSCERR_IGNORADOS_KEY, ids);
}
function limpiarIgnoradosPosCerr(){
  guardarJSONSeguro(POSCERR_IGNORADOS_KEY, []);
}

// Recorre la historia igual que el cálculo del resultado y anota, para cada venta, cuánto
// capital quedó sin recuperar. Devuelve las que parecen un cierre.
function candidatosAPosicionCerrada(lista){
  const fuente=lista || (typeof movs!=="undefined" ? movs : []);
  const inv=fuente.filter(m=>m && m.tipo==="Inversion" && String(m.fecha||"").length>=7)
    .slice().sort(ordenDeOperacion);
  const ignorados=new Set(idsIgnoradosPosCerr());
  const capital={};
  Object.keys(posicionInicialActual()).forEach(t=>{
    const p=posicionInicialActual()[t]||{};
    capital[t]={ars:Number(p.ars)||0, usd:Number(p.usd)||0};
  });
  const ultimaOp={};
  inv.forEach(m=>{ ultimaOp[m.ticker||"Sin ticker"]=m; });

  const out=[];
  inv.forEach(m=>{
    const ticker=m.ticker||"Sin ticker";
    if(!capital[ticker]) capital[ticker]={ars:0, usd:0};
    const venta=isInvSalida(m);
    ["ars","usd"].forEach(k=>{
      const monto=montoInv(m, k==="usd"?"USD":"ARS");
      if(!monto) return;
      if(!venta){ capital[ticker][k]+=monto; return; }
      const antes=capital[ticker][k];
      const devuelve=Math.min(monto, antes);
      capital[ticker][k]-=devuelve;
      const resto=capital[ticker][k];
      if(m.cierraPosicion){ capital[ticker][k]=0; return; }   // ya está marcada
      if(resto<=0.005 || antes<=0) return;                     // no quedó nada sin recuperar
      if(devuelve/antes < POSCERR_UMBRAL) return;              // vendiste una parte, no todo
      if(ultimaOp[ticker]!==m) return;                         // después seguiste operando
      const clave=m.id+"|"+k;
      if(ignorados.has(clave)) return;
      out.push({clave, id:m.id, ticker, moneda:k==="usd"?"USD":"ARS", fecha:m.fecha,
                perdida:Math.round(resto*100)/100,
                puesto:Math.round(antes*100)/100,
                recuperado:Math.round(devuelve*100)/100,
                cat:m.cat, subcat:m.subcat});
    });
  });
  return out.sort((a,b)=>b.perdida-a.perdida);
}

function totalPerdidaSinReconocer(lista){
  const out={ars:0, usd:0};
  candidatosAPosicionCerrada(lista).forEach(c=>{
    if(c.moneda==="USD") out.usd+=c.perdida; else out.ars+=c.perdida;
  });
  out.ars=Math.round(out.ars*100)/100;
  out.usd=Math.round(out.usd*100)/100;
  return out;
}

// ═══════════════════════════════════════════
// MARCAR
// ═══════════════════════════════════════════
function marcarPosicionCerrada(id){
  const m=movs.find(x=>x.id===id);
  if(!m) return false;
  m.cierraPosicion=true;
  save();
  return true;
}
function marcarPosicionCerradaDesdeCard(id){
  if(!marcarPosicionCerrada(id)) return;
  showToast("Pérdida reconocida ✓");
  refrescarTrasPosCerr();
}
function descartarPosCerr(clave){
  ignorarPosCerr(clave);
  refrescarTrasPosCerr();
}
function revisarDescartadosPosCerr(){
  limpiarIgnoradosPosCerr();
  refrescarTrasPosCerr();
}
// Deshacer: la venta vuelve a dejar el resto como capital invertido.
function reabrirPosicion(id){
  const m=movs.find(x=>x.id===id);
  if(!m) return;
  delete m.cierraPosicion;
  save();
  showToast("La posición vuelve a figurar abierta");
  refrescarTrasPosCerr();
}

function refrescarTrasPosCerr(){
  if(typeof renderPosicionCerrada==="function") renderPosicionCerrada();
  if(typeof renderInv==="function") renderInv();
  if(typeof renderMovs==="function") renderMovs();
  if(typeof renderDash==="function") renderDash();
}

// La última venta de un ticker.
function ultimaVentaDe(ticker){
  const inv=(movs||[]).filter(m=>m && m.tipo==="Inversion" && (m.ticker||"Sin ticker")===ticker)
    .slice().sort(ordenDeOperacion);
  for(let i=inv.length-1;i>=0;i--){ if(isInvSalida(inv[i])) return inv[i]; }
  return null;
}

// La venta que cerraría la posición, para el botón de la ficha del instrumento: la última
// operación del ticker, y solo si es una venta. Si después compraste más, la posición está
// abierta y preguntarlo no tiene sentido — la ficha de BCMMA ofrecía marcar como pérdida
// $165.645 comprados nueve días antes.
function ventaQueCerraria(ticker){
  const inv=(movs||[]).filter(m=>m && m.tipo==="Inversion" && (m.ticker||"Sin ticker")===ticker)
    .slice().sort(ordenDeOperacion);
  const ultima=inv[inv.length-1];
  return (ultima && isInvSalida(ultima)) ? ultima : null;
}

// ═══════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════
function renderPosicionCerrada(){
  const card=document.getElementById("card-posicion-cerrada");
  const el=document.getElementById("posicion-cerrada-lista");
  if(!card||!el) return;

  const cands=candidatosAPosicionCerrada(movs);
  const descartados=idsIgnoradosPosCerr().length;
  if(!cands.length && !descartados){ card.style.display="none"; return; }
  card.style.display="block";

  if(!cands.length){
    el.innerHTML=`<div class="inset">
      <div class="txt-md">No queda ninguna sin revisar.</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">Marcaste ${descartados} como ${descartados===1?"posición que seguís teniendo":"posiciones que seguís teniendo"}.</div>
    </div>
    <button class="btn-sm" style="width:100%;margin-top:10px" onclick="revisarDescartadosPosCerr()">Volver a revisarlas</button>`;
    return;
  }

  const total=totalPerdidaSinReconocer(movs);
  const montos=[];
  if(total.ars>0) montos.push(fmtS(total.ars));
  if(total.usd>0) montos.push("USD "+total.usd.toFixed(2));
  let html=`<div class="inset mb-10">
    <div class="txt-md txt-strong">${montos.join(" + ")} figuran como invertidos</div>
    <div class="txt-xs txt-muted" style="margin-top:4px">Vendiste casi todo y no volviste a operar el ticker. Si ya no tenés la posición, eso no sigue invertido: es lo que perdiste.</div>
  </div>`;
  html+=cands.map(c=>{
    const monto=c.moneda==="USD" ? `USD ${c.perdida.toFixed(2)}` : fmtS(c.perdida);
    const puesto=c.moneda==="USD" ? `USD ${c.puesto.toFixed(2)}` : fmtS(c.puesto);
    const recup=c.moneda==="USD" ? `USD ${c.recuperado.toFixed(2)}` : fmtS(c.recuperado);
    return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <div class="u-flex1 u-min0">
          <div class="txt-md txt-strong">${escapeHtml(c.ticker)}</div>
          <div class="txt-xs txt-muted">${escapeHtml(c.subcat||c.cat||"")} · ${escapeHtml(mesLbl(String(c.fecha||"").slice(0,7)))}</div>
        </div>
        <div class="txt-md txt-strong" style="color:var(--invest)">${monto}</div>
      </div>
      <div class="txt-xs txt-muted" style="margin-top:6px">Pusiste ${puesto} y recuperaste ${recup}.</div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn-sm" style="flex:1" onclick="marcarPosicionCerradaDesdeCard(${c.id})">Ya no la tengo</button>
        <button class="btn-sm" style="flex:1" onclick="descartarPosCerr(${attrJS(c.clave)})">La sigo teniendo</button>
      </div>
    </div>`;
  }).join("");
  if(descartados){
    html+=`<button class="btn-sm" style="width:100%;margin-top:10px" onclick="revisarDescartadosPosCerr()">Volver a revisar ${descartados===1?"la descartada":"las "+descartados+" descartadas"}</button>`;
  }
  el.innerHTML=html;
}

// Desde la ficha del instrumento: se marca y se vuelve a abrir la ficha, ya recalculada.
function cerrarPosicionDesdeFicha(id, ticker){
  if(!marcarPosicionCerrada(id)) return;
  showToast("Pérdida reconocida ✓");
  refrescarTrasPosCerr();
  showInstrumentoDetail(ticker);
}
function reabrirPosicionDesdeFicha(id, ticker){
  reabrirPosicion(id);
  showInstrumentoDetail(ticker);
}
