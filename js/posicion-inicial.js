// ═══════════════════════════════════════════
// POSICIÓN INICIAL: LO QUE YA TENÍAS ANTES DE LA APP
// ═══════════════════════════════════════════
// La regla del resultado es "primero recuperás capital, después ganás". Necesita saber cuánto
// pusiste, y eso sale de las compras cargadas. Si vendiste algo que habías comprado ANTES de
// empezar a usar la app, esa compra no existe en ninguna parte: el capital da 0 y la venta
// entera se cuenta como ganancia.
//
// No es un detalle. En los datos reales son USD 666,53 de "ganancia" que en realidad es plata
// que ya tenías volviendo a tu bolsillo — ESTRA1A sola aporta USD 551,21 en una única venta de
// mayo, y el mes figura como el mejor del año por eso.
//
// Acá se guarda, por ticker y por moneda, cuánto valía lo que ya tenías. Se siembra como
// capital al arrancar el recorrido, y la venta pasa a descontarse de ahí.
//
// No se inventa como un movimiento de compra falso: eso ensuciaría los totales del mes en que
// se cargue, la lista de movimientos y los chips de "invertido". Es un dato aparte que solo
// mira el cálculo del resultado.

const POSINI_KEY = "fposini";
const POSINI_IGNORADOS_KEY = "fposiniignorados";

function savePosicionInicial(){
  guardarJSONSeguro(POSINI_KEY, posicionInicial);
  // El resultado se calcula sobre toda la historia y queda cacheado: sin invalidar, la
  // pantalla sigue mostrando la ganancia vieja.
  invalidarResultadoInv();
  marcarDatosSucios();
}

function idsIgnoradosPosIni(){
  return leerJSONSeguro(POSINI_IGNORADOS_KEY, "[]", "array");
}
function ignorarPosIni(clave){
  const ids=idsIgnoradosPosIni();
  if(!ids.includes(clave)) ids.push(clave);
  guardarJSONSeguro(POSINI_IGNORADOS_KEY, ids);
}
function limpiarIgnoradosPosIni(){
  guardarJSONSeguro(POSINI_IGNORADOS_KEY, []);
}

// Un cupón, un dividendo o un rendimiento SON ganancia pura: no devuelven capital, así que no
// tener una compra detrás es lo normal y no hay nada que corregir. Solo se miran las ventas y
// los rescates, que sí son "te devuelven lo que pusiste".
function esVentaDeCapital(m){
  const txt=(m.subcat||"").toLowerCase()+" "+(m.cat||"").toLowerCase();
  return /rescate|venta|amortizaci|tomada/.test(txt);
}

// Una venta que no encuentra capital PUEDE ser ganancia de verdad (compraste a 100, vendiste a
// 150) o una posición anterior a la app. Lo que las distingue: si NUNCA se cargó una compra de
// ese ticker en esa moneda, no hay con qué haber ganado. Ese es el único caso que se propone.
function candidatosAPosicionInicial(lista){
  const inv=(lista||movs||[]).filter(m=>m && m.tipo==="Inversion" && String(m.fecha||"").length>=7)
    .slice().sort(ordenDeOperacion);
  const ignorados=new Set(idsIgnoradosPosIni());
  const capital={};
  const huboCompra={};
  const out={};
  Object.keys(posicionInicial||{}).forEach(t=>{
    const p=posicionInicial[t]||{};
    capital[t]={ars:Number(p.ars)||0, usd:Number(p.usd)||0};
  });

  inv.forEach(m=>{
    const ticker=m.ticker||"Sin ticker";
    if(!capital[ticker]) capital[ticker]={ars:0, usd:0};
    const venta=isInvSalida(m);
    ["ars","usd"].forEach(k=>{
      const monto=montoInv(m, k==="usd"?"USD":"ARS");
      if(!monto) return;
      const clave=ticker+"|"+k;
      if(!venta){ huboCompra[clave]=true; capital[ticker][k]+=monto; return; }
      const devuelve=Math.min(monto, capital[ticker][k]);
      capital[ticker][k]-=devuelve;
      const sinRespaldo=monto-devuelve;
      // Medio centavo, no cero: con varias ventas cubiertas por una posición que suma justo,
      // la resta deja residuos de coma flotante del orden de 1e-14. Con `> 0` eso alcanzaba
      // para proponer un candidato de "USD 0" que no se iba nunca —cargarlo lo dejaba igual—
      // y encima no había forma de sacárselo de encima salvo descartarlo.
      if(sinRespaldo<0.005) return;
      if(huboCompra[clave]) return;               // ganaste de verdad: hay compras cargadas
      if(!esVentaDeCapital(m)) return;            // un cupón no devuelve capital
      if(ignorados.has(clave)) return;            // lo descartaste a mano
      const c = out[clave] || (out[clave]={clave, ticker, moneda:k==="usd"?"USD":"ARS",
                                           faltante:0, ventas:0, desde:m.fecha, cat:m.cat});
      c.faltante+=sinRespaldo;
      c.ventas++;
    });
  });

  return Object.values(out)
    .map(c=>{ c.faltante=Math.round(c.faltante*100)/100; return c; })
    .sort((a,b)=>b.faltante-a.faltante);
}

// Cuánta "ganancia" está apoyada en capital que no está cargado.
function totalSinRespaldo(lista){
  const out={ars:0, usd:0};
  candidatosAPosicionInicial(lista).forEach(c=>{
    if(c.moneda==="USD") out.usd+=c.faltante; else out.ars+=c.faltante;
  });
  out.ars=Math.round(out.ars*100)/100;
  out.usd=Math.round(out.usd*100)/100;
  return out;
}

// ═══════════════════════════════════════════
// APLICAR
// ═══════════════════════════════════════════
function fijarPosicionInicial(ticker, moneda, monto){
  const n=Number(monto);
  if(!isFinite(n) || n<=0){ showToast("Ingresá un importe válido"); return false; }
  const k=moneda==="USD" ? "usd" : "ars";
  const actual=posicionInicial[ticker] || {ars:0, usd:0};
  posicionInicial[ticker]={ars:Number(actual.ars)||0, usd:Number(actual.usd)||0};
  posicionInicial[ticker][k]=Math.round(n*100)/100;
  savePosicionInicial();
  return true;
}

function aplicarPosIniDesdeInput(clave){
  const cand=candidatosAPosicionInicial(movs).find(c=>c.clave===clave);
  if(!cand) return;
  const input=document.querySelector("#posini-"+cssIdSeguro(clave));
  const valor=input ? parseFloat(input.value) : NaN;
  if(!fijarPosicionInicial(cand.ticker, cand.moneda, valor)) return;
  showToast("Posición inicial cargada ✓");
  refrescarTrasPosIni();
}

// Cargar todas de una. Con tres o cuatro propuestas, aceptar el valor sugerido una por una es
// puro trámite: el valor que se toma es el que está en cada input, así que lo que hayas
// corregido a mano se respeta igual.
function aplicarTodasLasPosIni(){
  const cands=candidatosAPosicionInicial(movs);
  if(!cands.length) return;
  let cargadas=0;
  cands.forEach(c=>{
    const input=document.querySelector("#posini-"+cssIdSeguro(c.clave));
    const escrito=input ? parseFloat(input.value) : NaN;
    const monto=(isFinite(escrito) && escrito>0) ? escrito : c.faltante;
    if(fijarPosicionInicial(c.ticker, c.moneda, monto)) cargadas++;
  });
  showToast(`${cargadas} ${cargadas===1?"posición cargada":"posiciones cargadas"} ✓`);
  refrescarTrasPosIni();
}

function descartarPosIni(clave){
  ignorarPosIni(clave);
  refrescarTrasPosIni();
}

function revisarDescartadosPosIni(){
  limpiarIgnoradosPosIni();
  refrescarTrasPosIni();
}

// Borrar una posición cargada: vuelve a aparecer como candidata, así se puede corregir un
// número mal puesto sin tener que adivinar dónde quedó.
function borrarPosicionInicial(ticker, moneda){
  const k=moneda==="USD" ? "usd" : "ars";
  if(posicionInicial[ticker]){
    posicionInicial[ticker][k]=0;
    if(!posicionInicial[ticker].ars && !posicionInicial[ticker].usd) delete posicionInicial[ticker];
    savePosicionInicial();
  }
  refrescarTrasPosIni();
}

function refrescarTrasPosIni(){
  renderPosicionInicial();
  if(typeof renderInv==="function") renderInv();
  if(typeof renderMovs==="function") renderMovs();
  if(typeof renderDash==="function") renderDash();
}

// Los ids llevan el ticker adentro y el ticker lo escribe el usuario: se lo pasa por un colador
// que deja solo lo que puede vivir en un id sin romper el selector ni inyectar nada.
function cssIdSeguro(txt){
  return String(txt||"").replace(/[^A-Za-z0-9_-]/g, "_");
}

// ═══════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════
function renderPosicionInicial(){
  const card=document.getElementById("card-posicion-inicial");
  const el=document.getElementById("posicion-inicial-lista");
  if(!card||!el) return;

  const cands=candidatosAPosicionInicial(movs);
  const cargadas=[];
  Object.keys(posicionInicial||{}).forEach(t=>{
    const p=posicionInicial[t]||{};
    if(Number(p.ars)>0) cargadas.push({ticker:t, moneda:"ARS", monto:Number(p.ars)});
    if(Number(p.usd)>0) cargadas.push({ticker:t, moneda:"USD", monto:Number(p.usd)});
  });
  const descartados=idsIgnoradosPosIni().length;

  if(!cands.length && !cargadas.length && !descartados){ card.style.display="none"; return; }
  card.style.display="block";

  let html="";
  if(cands.length){
    const total=totalSinRespaldo(movs);
    const montos=[];
    if(total.ars>0) montos.push(fmtS(total.ars));
    if(total.usd>0) montos.push("USD "+total.usd.toFixed(2));
    html+=`<div class="inset mb-10">
      <div class="txt-md txt-strong">${montos.join(" + ")} contados como ganancia</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">Vendiste esto sin que haya ninguna compra cargada. Si ya lo tenías antes de usar la app, decí cuánto te había costado y deja de figurar como ganado. Dejando el número como viene, no ganaste ni perdiste con lo que ya tenías.</div>
    </div>`;
    if(cands.length>1){
      html+=`<button class="btn-primary" style="width:100%;margin-bottom:10px" onclick="aplicarTodasLasPosIni()">Ya tenía las ${cands.length} · cargarlas todas</button>`;
    }
    html+=cands.map(c=>{
      const id="posini-"+cssIdSeguro(c.clave);
      const monto=c.moneda==="USD" ? `USD ${c.faltante.toFixed(2)}` : fmtS(c.faltante);
      const prefijo=c.moneda==="USD" ? "USD" : "$";
      return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
          <div class="u-flex1 u-min0">
            <div class="txt-md txt-strong">${escapeHtml(c.ticker)}</div>
            <div class="txt-xs txt-muted">${escapeHtml(c.cat||"")} · ${c.ventas} ${c.ventas===1?"venta":"ventas"} desde ${escapeHtml(mesLbl(String(c.desde||"").slice(0,7)))}</div>
          </div>
          <div class="txt-md txt-strong" style="color:var(--success)">+${monto}</div>
        </div>
        <div class="txt-xs txt-muted" style="margin-top:8px">¿Cuánto te costó lo que ya tenías de ${escapeHtml(c.ticker)}?</div>
        <div class="amount-wrap" style="margin-top:4px">
          <span class="amount-prefix">${prefijo}</span>
          <input type="number" inputmode="decimal" step="0.01" min="0" class="form-input" style="padding-left:${c.moneda==="USD"?"46px":"28px"}" id="${id}" value="${c.faltante}">
        </div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn-sm" style="flex:1" onclick="aplicarPosIniDesdeInput(${attrJS(c.clave)})">Ya lo tenía</button>
          <button class="btn-sm" style="flex:1" onclick="descartarPosIni(${attrJS(c.clave)})">Fue ganancia</button>
        </div>
      </div>`;
    }).join("");
  } else {
    html+=`<div class="inset mb-10">
      <div class="txt-md">No queda ninguna venta sin respaldo.</div>
    </div>`;
  }

  if(cargadas.length){
    html+=`<div class="seccion-label mt-14 mb-6">Posiciones que ya cargaste</div>`;
    html+=cargadas.map(p=>{
      const monto=p.moneda==="USD" ? `USD ${p.monto.toFixed(2)}` : fmtS(p.monto);
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div class="u-flex1 u-min0">
          <div class="txt-md txt-strong">${escapeHtml(p.ticker)}</div>
          <div class="txt-xs txt-muted">ya lo tenías por ${monto}</div>
        </div>
        <button class="btn-sm" onclick="borrarPosicionInicial(${attrJS(p.ticker)},${attrJS(p.moneda)})">Quitar</button>
      </div>`;
    }).join("");
  }

  if(descartados){
    html+=`<button class="btn-sm" style="width:100%;margin-top:10px" onclick="revisarDescartadosPosIni()">Volver a revisar ${descartados===1?"el descartado":"los "+descartados+" descartados"}</button>`;
  }
  el.innerHTML=html;
}
