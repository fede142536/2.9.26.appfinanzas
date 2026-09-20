// ═══════════════════════════════════════════
// UNIFICAR TICKERS
// ═══════════════════════════════════════════
// Balanz usa sus propios nombres: al money market le dice BMMA y en la app está cargado como
// BCMMA; a la acción de YPF le dice YPFD y acá es YPF. Importando el resumen quedan DOS
// posiciones de la misma plata, cada una con su capital y su resultado, y ninguna de las dos
// dice la verdad.
//
// Unificar es renombrar el ticker en todos los movimientos y juntar lo que colgaba de él: la
// posición inicial se suma y la valuación se mueve si el destino no tenía una.
//
// Lo que NO hace es decidir solo. Un detector por parecido de nombre se equivoca justo en los
// casos que importan: AL30 y AL30D difieren en una letra y son las dos patas de un MEP
// —unirlas rompería el modelo entero— mientras que YPF y YPFD difieren igual y son el mismo
// instrumento; y BCAHA y BCMMA son dos fondos distintos del mismo banco. Ninguna regla
// automática separa esos casos, así que las sugerencias son solo eso: el usuario confirma
// cada una, elige con qué nombre se queda y puede deshacerlo.

function tickersDeInversion(lista){
  const fuente=lista || (typeof movs!=="undefined" ? movs : []);
  const cuenta={};
  (fuente||[]).forEach(m=>{
    if(!m || m.tipo!=="Inversion") return;
    const t=m.ticker||"Sin ticker";
    cuenta[t]=(cuenta[t]||0)+1;
  });
  const cap=resultadoInv(fuente).capitalPorTicker;
  return Object.keys(cuenta).sort().map(t=>({
    ticker:t, movs:cuenta[t],
    capital:{ars:(cap[t]&&cap[t].ars)||0, usd:(cap[t]&&cap[t].usd)||0}
  }));
}

// Distancia de edición, para SUGERIR parecidos. No alcanza para decidir: AL30/AL30D da 1.
function distanciaTicker(a, b){
  a=String(a||"").toUpperCase(); b=String(b||"").toUpperCase();
  const fila=Array.from({length:b.length+1}, (_,j)=>j);
  for(let i=1;i<=a.length;i++){
    let prev=fila[0]; fila[0]=i;
    for(let j=1;j<=b.length;j++){
      const tmp=fila[j];
      fila[j]=Math.min(fila[j]+1, fila[j-1]+1, prev+(a[i-1]===b[j-1]?0:1));
      prev=tmp;
    }
  }
  return fila[b.length];
}

// Pares que VALE LA PENA mirar. La D al final es ambigua a propósito y no se puede resolver
// sola: en AL30/AL30D son las dos patas de un MEP —unirlas rompería el modelo— pero en
// YPF/YPFD es literalmente el caso que hay que unificar, porque Balanz le dice YPFD a la
// acción que en la app está cargada como YPF. Descartar el par a ciegas taparía el segundo;
// proponerlo sin decir nada invitaría al primero. Va propuesto y marcado con ojo:true, y el
// texto de la pantalla explica de qué depende.
function sugerenciasDeTicker(lista){
  const ts=tickersDeInversion(lista).map(t=>t.ticker);
  const out=[];
  for(let i=0;i<ts.length;i++){
    for(let j=i+1;j<ts.length;j++){
      const a=ts[i], b=ts[j];
      const d=distanciaTicker(a,b);
      if(d===0 || d>2) continue;
      if(a[0]!==b[0]) continue;                       // ni arrancan igual
      const laD = a.length!==b.length && (a+"D"===b || b+"D"===a);
      out.push({a, b, distancia:d, ojo:laD});
    }
  }
  // Primero lo más parecido, y dentro de eso lo que no necesita advertencia.
  return out.sort((x,y)=>(x.distancia-y.distancia) || ((x.ojo?1:0)-(y.ojo?1:0)));
}

// ═══════════════════════════════════════════
// APLICAR
// ═══════════════════════════════════════════
function unificarTicker(origen, destino){
  if(!origen || !destino || origen===destino) return 0;
  let tocados=0;
  movs.forEach(m=>{
    if(!m || m.tipo!=="Inversion" || (m.ticker||"Sin ticker")!==origen) return;
    m.tickerOrig=origen;          // para poder deshacer
    m.ticker=destino;
    tocados++;
  });
  if(!tocados) return 0;

  // La posición inicial de los dos es capital de la MISMA posición: se suma.
  const po=posicionInicial[origen];
  if(po){
    const pd=posicionInicial[destino] || {ars:0, usd:0};
    posicionInicial[destino]={
      ars: Math.round(((Number(pd.ars)||0)+(Number(po.ars)||0))*100)/100,
      usd: Math.round(((Number(pd.usd)||0)+(Number(po.usd)||0))*100)/100
    };
    delete posicionInicial[origen];
    if(typeof savePosicionInicial==="function") savePosicionInicial();
  }
  // La valuación NO se suma: las dos miden lo mismo. Se mueve solo si el destino no tenía.
  if(typeof valuaciones!=="undefined" && valuaciones[origen]){
    if(!valuaciones[destino]) valuaciones[destino]=valuaciones[origen];
    delete valuaciones[origen];
    if(typeof saveValuaciones==="function") saveValuaciones();
  }
  save();
  return tocados;
}

function separarTicker(origen){
  let tocados=0;
  movs.forEach(m=>{
    if(!m || !m.tickerOrig || m.tickerOrig!==origen) return;
    m.ticker=m.tickerOrig;
    delete m.tickerOrig;
    tocados++;
  });
  if(tocados) save();
  return tocados;
}

function tickersUnificados(lista){
  const fuente=lista || (typeof movs!=="undefined" ? movs : []);
  const out={};
  (fuente||[]).forEach(m=>{
    if(m && m.tickerOrig) out[m.tickerOrig]=(out[m.tickerOrig]||0)+1;
  });
  return Object.keys(out).sort().map(t=>({origen:t, movs:out[t]}));
}

// ═══════════════════════════════════════════
// DESCARTES
// ═══════════════════════════════════════════
// AL30/AL30D ya se filtran solos, pero BCAHA/BCMMA no: son dos fondos distintos del mismo
// banco y la distancia de edición no lo sabe. Sin poder decir "estos dos NO son el mismo", la
// sugerencia vuelve a aparecer para siempre y la card deja de significar algo.
const UNIF_IGNORADOS_KEY = "funifignorados";

function claveDePar(a, b){
  return [String(a||""), String(b||"")].sort().join("\u0001");
}
function paresIgnorados(){
  return leerJSONSeguro(UNIF_IGNORADOS_KEY, "[]", "array");
}
function ignorarParTicker(a, b){
  const ids=paresIgnorados();
  const k=claveDePar(a,b);
  if(!ids.includes(k)) ids.push(k);
  guardarJSONSeguro(UNIF_IGNORADOS_KEY, ids);
}
function limpiarIgnoradosTicker(){
  guardarJSONSeguro(UNIF_IGNORADOS_KEY, []);
}
function sugerenciasVisiblesDeTicker(lista){
  const ign=paresIgnorados();
  return sugerenciasDeTicker(lista).filter(s=>!ign.includes(claveDePar(s.a, s.b)));
}

// ═══════════════════════════════════════════
// PANTALLA
// ═══════════════════════════════════════════
function montoDeCapital(cap){
  const partes=[];
  if(Math.abs(cap.ars)>=0.005) partes.push(fmtS(cap.ars));
  if(Math.abs(cap.usd)>=0.005) partes.push("USD "+cap.usd.toFixed(2));
  return partes.length ? partes.join(" + ") : "sin capital abierto";
}

function renderUnificarTickers(){
  const card=document.querySelector("#card-unificar");
  const el=document.querySelector("#unificar-lista");
  if(!card||!el) return;

  const tickers=tickersDeInversion(movs);
  const hechos=tickersUnificados(movs);
  // Con un solo ticker no hay nada que unificar y la card sería ruido en la pantalla.
  if(tickers.length<2 && !hechos.length){ card.style.display="none"; return; }
  card.style.display="block";

  const porTicker={};
  tickers.forEach(t=>{ porTicker[t.ticker]=t; });
  const sugs=sugerenciasVisiblesDeTicker(movs);
  const descartados=paresIgnorados().length;

  let html="";

  if(sugs.length){
    html+=`<div class="inset mb-10">
      <div class="txt-md txt-strong">${sugs.length} ${sugs.length===1?"par se parece":"pares se parecen"}</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">Elegí con qué nombre te quedás. El otro desaparece y sus movimientos, su posición inicial y su valuación pasan al que elegiste.</div>
    </div>`;
    html+=sugs.map(s=>{
      const ta=porTicker[s.a]||{movs:0, capital:{ars:0,usd:0}};
      const tb=porTicker[s.b]||{movs:0, capital:{ars:0,usd:0}};
      // La advertencia de la D: ver el comentario de sugerenciasDeTicker().
      const aviso = s.ojo
        ? `<div class="txt-xs" style="margin-top:6px;color:var(--warning)">Ojo: se diferencian por una <strong>D</strong> al final. Si es un bono comprado con MEP (AL30/AL30D) son dos cosas distintas y no hay que unirlas; si es la misma acción con otro nombre (YPF/YPFD), sí.</div>`
        : "";
      return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;gap:8px;align-items:baseline">
          <div class="u-flex1 u-min0">
            <div class="txt-md txt-strong">${escapeHtml(s.a)}</div>
            <div class="txt-xs txt-muted">${ta.movs} ${ta.movs===1?"movimiento":"movimientos"} · ${montoDeCapital(ta.capital)}</div>
          </div>
          <div class="txt-xs txt-muted">vs</div>
          <div class="u-flex1 u-min0" style="text-align:right">
            <div class="txt-md txt-strong">${escapeHtml(s.b)}</div>
            <div class="txt-xs txt-muted">${tb.movs} ${tb.movs===1?"movimiento":"movimientos"} · ${montoDeCapital(tb.capital)}</div>
          </div>
        </div>
        ${aviso}
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn-sm" style="flex:1" onclick="unificarDesdeCard(${attrJS(s.b)},${attrJS(s.a)})">Dejar ${escapeHtml(s.a)}</button>
          <button class="btn-sm" style="flex:1" onclick="unificarDesdeCard(${attrJS(s.a)},${attrJS(s.b)})">Dejar ${escapeHtml(s.b)}</button>
        </div>
        <button class="btn-sm" style="width:100%;margin-top:6px" onclick="descartarParTicker(${attrJS(s.a)},${attrJS(s.b)})">Son distintos</button>
      </div>`;
    }).join("");
  }else{
    html+=`<div class="inset mb-10">
      <div class="txt-md">Ningún par se parece lo suficiente.</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">${descartados ? "Descartaste "+descartados+" "+(descartados===1?"par":"pares")+". " : ""}Si igual sabés que dos son el mismo instrumento, unilos acá abajo.</div>
    </div>`;
  }

  if(descartados){
    html+=`<button class="btn-sm" style="width:100%;margin-bottom:10px" onclick="revisarDescartadosTicker()">Volver a revisar los descartados</button>`;
  }

  // A mano: los nombres pueden no parecerse en nada (BMMA vs "Fondo Money Market"), así que
  // la lista completa tiene que estar siempre disponible.
  const opciones=tickers.map(t=>`<option value="${escapeHtml(t.ticker)}">${escapeHtml(t.ticker)} (${t.movs})</option>`).join("");
  html+=`<div class="inset">
    <div class="txt-xs txt-muted mb-10">Unir a mano</div>
    <div style="display:flex;gap:6px;align-items:center">
      <select id="unificar-origen" class="u-flex1 u-min0">${opciones}</select>
      <div class="txt-xs txt-muted">→</div>
      <select id="unificar-destino" class="u-flex1 u-min0">${opciones}</select>
    </div>
    <button class="btn-sm" style="width:100%;margin-top:8px" onclick="unificarAMano()">Unificar</button>
  </div>`;

  if(hechos.length){
    html+=`<div class="txt-xs txt-muted" style="margin-top:12px">Ya unificados</div>`;
    html+=hechos.map(h=>`<div style="display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <div class="u-flex1 u-min0 txt-sm">${escapeHtml(h.origen)} · ${h.movs} ${h.movs===1?"movimiento":"movimientos"}</div>
      <button class="btn-sm" onclick="separarDesdeCard(${attrJS(h.origen)})">Separar</button>
    </div>`).join("");
  }

  el.innerHTML=html;
}

async function unificarDesdeCard(origen, destino){
  const ok=await mostrarConfirm(`Todos los movimientos de ${origen} van a pasar a llamarse ${destino}. Se puede deshacer.`, {titulo:"Unificar tickers"});
  if(!ok) return;
  const n=unificarTicker(origen, destino);
  if(!n){ showToast("No quedaba nada para unificar"); renderUnificarTickers(); return; }
  showToast(`${n} ${n===1?"movimiento":"movimientos"} ahora son ${destino}`);
  renderUnificarTickers();
}

function descartarParTicker(a, b){
  ignorarParTicker(a, b);
  renderUnificarTickers();
}
function revisarDescartadosTicker(){
  limpiarIgnoradosTicker();
  renderUnificarTickers();
}

function unificarAMano(){
  const o=document.querySelector("#unificar-origen");
  const d=document.querySelector("#unificar-destino");
  if(!o||!d) return;
  if(o.value===d.value){ showToast("Elegí dos tickers distintos"); return; }
  unificarDesdeCard(o.value, d.value);
}

function separarDesdeCard(origen){
  const n=separarTicker(origen);
  if(!n){ showToast("Ya estaba separado"); renderUnificarTickers(); return; }
  showToast(`${origen} volvió a ser ${origen}`);
  renderUnificarTickers();
}
