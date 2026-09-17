// ═══════════════════════════════════════════
// TRASPASOS: PLATA QUE CAMBIA DE BOLSILLO
// ═══════════════════════════════════════════
// Un traspaso mueve plata entre lugares que son tuyos —del fondo de retiro a unos CEDEARs, de
// una cuenta a otra— sin que dejes de tenerla. No es ingreso ni gasto.
//
// La app no tenía cómo decirlo. La casilla "💸 Sale de mis ahorros" está pensada para algo
// distinto: una COMPRA pagada con plata del fondo (unas vacaciones, por ejemplo), que sí es
// consumo. Al no existir otra opción, sacar plata del fondo para invertirla también se marcaba
// así, y esa plata figuraba gastada aunque la seguís teniendo.
//
// Esto busca los que quedaron cargados de esa forma para ofrecerte marcarlos. No decide nada
// solo: propone y vos confirmás, igual que la migración de cambios de moneda.

// Pistas de que el destino es una inversión o el fondo mismo, no algo que consumiste.
const TRASPASO_PISTAS = /cedear|\bfci\b|fondo\s*de\s*retiro|acciones|bonos?\b|cauci[oó]n|plazo\s*fijo|inversi[oó]n|inversiones|\bmep\b|letras?\b|obligaci[oó]n/i;
const TRASPASO_IGNORADOS_KEY = "ftraspasoignorados";

function idsIgnoradosTraspaso(){
  return leerJSONSeguro(TRASPASO_IGNORADOS_KEY, "[]", "array");
}
function ignorarTraspaso(id){
  const ids=idsIgnoradosTraspaso();
  if(!ids.includes(id)) ids.push(id);
  // guardarJSONSeguro() y no guardarPreferencia(): la lista se LEE con leerJSONSeguro(), que con
  // el PIN activo mira encCache. Escribir en localStorage la dejaba donde nadie la busca.
  guardarJSONSeguro(TRASPASO_IGNORADOS_KEY, ids);
}
function limpiarIgnoradosTraspaso(){
  guardarJSONSeguro(TRASPASO_IGNORADOS_KEY, []);
}

// Un candidato es una compra "pagada con el fondo" cuya categoría no describe algo que se
// consumió, sino dónde quedó la plata. "Vacaciones / Alemania" no entra: eso se gastó de
// verdad. "Fondo de Retiro / Cedears" sí: esa plata la seguís teniendo, en CEDEARs.
function candidatosATraspaso(lista){
  const ignorados=new Set(idsIgnoradosTraspaso());
  return (lista||[]).filter(m=>{
    if(esTraspaso(m)) return false;            // ya está marcado
    if(ignorados.has(m.id)) return false;      // lo descartaste a mano
    if(!esRetiroAhorro(m)) return false;       // solo los que salen del fondo
    if(esPataDeCambio(m)) return false;        // un cambio de moneda ya tiene su propio modelo
    const texto=`${m.cat||""} ${m.subcat||""} ${m.nota||""}`;
    return TRASPASO_PISTAS.test(texto);
  }).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
}

// Cuánto se está contando como gasto sin haberse gastado.
function totalCandidatosATraspaso(lista){
  return candidatosATraspaso(lista)
    .filter(m=>m.moneda!=="USD")
    .reduce((s,m)=>s+(m.importe||0),0);
}

function marcarComoTraspaso(id){
  const m=movs.find(x=>x.id===id);
  if(!m) return;
  m.traspaso=true;
  save();
  showToast("Marcado como traspaso ✓");
  renderTraspasos();
  renderMovs();
  if(typeof renderAhorro==="function") renderAhorro();
}
function descartarTraspaso(id){
  ignorarTraspaso(id);
  renderTraspasos();
}
function revisarDescartadosTraspaso(){
  limpiarIgnoradosTraspaso();
  renderTraspasos();
}

// ═══════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════
function renderTraspasos(){
  const card=document.getElementById("card-traspasos");
  const el=document.getElementById("traspasos-lista");
  if(!card||!el) return;
  const cands=candidatosATraspaso(movs);
  const descartados=idsIgnoradosTraspaso().length;
  // Como en la migración de cambios: si no queda ninguno pero descartaste alguno, la card sigue
  // a la vista con el botón de deshacer. Descartar de más no puede ser irreversible.
  if(!cands.length && !descartados){ card.style.display="none"; return; }
  card.style.display="block";
  if(!cands.length){
    el.innerHTML=`<div class="inset">
      <div class="txt-md">No queda ninguno sin revisar.</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">Marcaste ${descartados} ${descartados===1?"movimiento":"movimientos"} como "sí lo gasté".</div>
    </div>
    <button class="btn-sm" style="width:100%;margin-top:10px" onclick="revisarDescartadosTraspaso()">Volver a revisarlos</button>`;
    return;
  }
  const total=totalCandidatosATraspaso(movs);
  let html=`<div class="inset mb-10">
    <div class="txt-md txt-strong">${fmtS(total)} contados como gasto</div>
    <div class="txt-xs txt-muted" style="margin-top:4px">en ${cands.length} ${cands.length===1?"movimiento":"movimientos"}. Si esa plata la seguís teniendo, no es un gasto.</div>
  </div>`;
  html+=cands.map(m=>{
    const monto=m.moneda==="USD" ? `USD ${(m.importeOrig||0).toFixed(2)}` : fmtS(m.importe||0);
    return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <div class="u-flex1 u-min0">
          <div class="txt-md txt-strong">${getIcon(m.cat,"↔️")} ${escapeHtml(m.cat||"")}</div>
          <div class="txt-xs txt-muted">${escapeHtml(subcatVisible(m.subcat)||"")} · ${escapeHtml(mesLbl(String(m.fecha||"").slice(0,7)))}</div>
        </div>
        <div class="txt-md txt-strong" style="color:var(--danger)">${monto}</div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn-sm" style="flex:1" onclick="marcarComoTraspaso(${m.id})">↔️ Es un traspaso</button>
        <button class="btn-sm" style="flex:1" onclick="descartarTraspaso(${m.id})">Sí lo gasté</button>
      </div>
    </div>`;
  }).join("");
  el.innerHTML=html;
}
