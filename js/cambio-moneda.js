// ═══════════════════════════════════════════
// CAMBIO DE MONEDA
// ═══════════════════════════════════════════
// Comprar dólares no es un gasto: es un cambio de bolsillo. Salen pesos y entran dólares, y
// tu patrimonio no cambió. El problema es que un movimiento guarda UNA sola moneda (si es
// USD, la columna en pesos queda en 0), así que una compra de dólares no entra en un solo
// registro: cargándola en pesos, los dólares no existen; cargándola en dólares, los pesos no
// salen. Y si además cargás el gasto cuando después usás esos dólares, la misma plata cuenta
// dos veces.
//
// La solución: un cambio se guarda como DOS movimientos ligados por `cambioId`, uno por cada
// pata. Cada pata es un movimiento normal y corriente, así que todo lo que ya existe —el
// balance, el dashboard en pesos, el flujo USD, los exports— lo entiende sin tocar una línea:
//
//   Compra de dólares          Venta de dólares
//   ├─ sale : Gasto   en ARS   ├─ sale : Gasto   en USD
//   └─ entra: Ingreso en USD   └─ entra: Ingreso en ARS
//
// Que la pata que sale sea un Gasto es la misma regla que ya usás para el fondo de ahorro
// ("al ahorrarlo lo cuento como gasto"): la plata se fue de tu mano, aunque siga siendo tuya.

const CAMBIO_CAT_DEFECTO = "Cambio de moneda";

// ¿Este movimiento es una de las dos patas de un cambio?
function esPataDeCambio(m){ return !!m && !!m.cambioId; }

// Las dos patas de un cambio, dado el id que las liga.
function patasDelCambio(cambioId, lista){
  return (lista||[]).filter(m=>m.cambioId===cambioId);
}

// El tipo de cambio de una operación: cuántos pesos por dólar.
function tipoDeCambio(montoARS, montoUSD){
  const a=Number(montoARS)||0, u=Number(montoUSD)||0;
  if(a<=0 || u<=0) return null;
  return Math.round(a/u*100)/100;
}

// Arma las dos patas de un cambio. Función pura: devuelve los objetos y no toca `movs` ni el
// DOM, para poder probarla.
//
// `sentido`: "compra" = pagás pesos y recibís dólares · "venta" = entregás dólares y recibís
// pesos. `cambioId` liga las dos patas; se usa el id de la primera.
function crearCambio({fecha, montoARS, montoUSD, sentido, cuenta, cuentaDestino, cat, subcat, nota, idBase}){
  const ars=Math.round((Number(montoARS)||0)*100)/100;
  const usd=Math.round((Number(montoUSD)||0)*100)/100;
  if(ars<=0 || usd<=0 || !fecha) return null;
  if(sentido!=="compra" && sentido!=="venta") return null;

  const id1=idBase || Date.now();
  const id2=id1+1;
  const categoria=cat || CAMBIO_CAT_DEFECTO;
  const sub=subcat || (sentido==="compra" ? "Compra USD" : "Venta USD");
  const comun={cat:categoria, subcat:sub, fecha, nota:nota||"", cambioId:id1,
               esAhorro:false, usaAhorro:false, recuperable:0};

  if(sentido==="compra"){
    return [
      // Salen los pesos.
      {...comun, id:id1, tipo:"Gasto", moneda:"ARS", importe:ars, importeOrig:null,
       cuenta:cuenta||"", cambioPata:"sale"},
      // Entran los dólares. En USD `importe` va en 0 y el monto vive en `importeOrig`,
      // igual que cualquier otro movimiento en dólares (ver form-cargar.js).
      {...comun, id:id2, tipo:"Ingreso", moneda:"USD", importe:0, importeOrig:usd,
       cuenta:cuentaDestino||cuenta||"", cambioPata:"entra"}
    ];
  }
  return [
    {...comun, id:id1, tipo:"Gasto", moneda:"USD", importe:0, importeOrig:usd,
     cuenta:cuenta||"", cambioPata:"sale"},
    {...comun, id:id2, tipo:"Ingreso", moneda:"ARS", importe:ars, importeOrig:null,
     cuenta:cuentaDestino||cuenta||"", cambioPata:"entra"}
  ];
}

// Dadas las dos patas, reconstruye la operación para poder mostrarla o editarla.
function leerCambio(patas){
  if(!patas || patas.length!==2) return null;
  const sale=patas.find(m=>m.cambioPata==="sale");
  const entra=patas.find(m=>m.cambioPata==="entra");
  if(!sale || !entra) return null;
  const sentido = sale.moneda==="USD" ? "venta" : "compra";
  const montoARS = sentido==="compra" ? (sale.importe||0) : (entra.importe||0);
  const montoUSD = sentido==="compra" ? (entra.importeOrig||0) : (sale.importeOrig||0);
  return {cambioId:sale.cambioId, sentido, montoARS, montoUSD, fecha:sale.fecha,
          cat:sale.cat, subcat:sale.subcat, nota:sale.nota,
          cuenta:sale.cuenta, cuentaDestino:entra.cuenta,
          tc:tipoDeCambio(montoARS, montoUSD)};
}

// ═══════════════════════════════════════════
// MIGRACIÓN DE LO YA CARGADO
// ═══════════════════════════════════════════
// Busca movimientos que pintan ser compras de dólares cargadas como un gasto suelto, para
// ofrecer completarles la pata que falta. Es una heurística sobre el texto: no decide nada
// sola, solo propone una lista que después confirmás vos.

const CAMBIO_PISTAS = /\bmep\b|d[oó]lar|\busd\b|\bal30\b|\bgd30\b|\bccl\b|contado\s*con\s*liqui|\bblue\b|cambio\s*de\s*moneda/i;
const CAMBIO_IGNORADOS_KEY = "fcambioignorados";

function idsIgnorados(){
  return leerJSONSeguro(CAMBIO_IGNORADOS_KEY, "[]", "array");
}
function ignorarParaMigrar(id){
  const ids=idsIgnorados();
  if(!ids.includes(id)) ids.push(id);
  guardarPreferencia(CAMBIO_IGNORADOS_KEY, JSON.stringify(ids));
}
function limpiarIgnorados(){
  localStorage.removeItem(CAMBIO_IGNORADOS_KEY);
}

// Devuelve [{mov, motivo, faltaPata}] — `faltaPata` dice qué mitad hay que pedirle al usuario:
// "usd" si el movimiento está en pesos (falta cuántos dólares recibió) y "ars" al revés.
function candidatosAMigrar(lista){
  const ignorados=new Set(idsIgnorados());
  return (lista||[]).filter(m=>{
    if(esPataDeCambio(m)) return false;          // ya está completo
    if(ignorados.has(m.id)) return false;         // lo descartaste a mano
    if(m.frecuente) return false;                 // un gasto mensual fijo no es un cambio
    // Una compra de dólares se pudo cargar como gasto o, si fue por MEP, como inversión.
    // Las que quedaron como inversión son peores: el capital queda "puesto" en un ticker que
    // nunca se va a vender, así que el AL30 figura eternamente invertido por esa plata.
    if(!esGasto(m) && m.tipo!=="Inversion") return false;
    // Pero SOLO las compras. Una "Bonos USD Venta" tiene AL30 y USD en el texto y entraba acá,
    // y no es un cambio de moneda: es vender un bono. Se ofrecía completarla con un monto en
    // pesos que nunca existió.
    if(m.tipo==="Inversion" && isInvSalida(m)) return false;
    // Sin un monto propio no hay mitad desde la cual completar nada.
    if(montoPropioDeCambio(m).monto<=0) return false;
    const texto=`${m.cat||""} ${m.subcat||""} ${m.nota||""}`;
    return CAMBIO_PISTAS.test(texto);
  }).map(m=>{
    const enUSD=montoPropioDeCambio(m).moneda==="USD";
    return {
      mov: m,
      faltaPata: enUSD ? "ars" : "usd",
      motivo: enUSD
        ? "Está en dólares, así que tus pesos no bajaron por esta compra."
        : "Está en pesos, así que los dólares que recibiste no quedaron registrados."
    };
  }).sort((a,b)=>String(b.mov.fecha).localeCompare(String(a.mov.fecha)));
}

// Qué mitad del cambio ya está cargada, y en qué moneda. Un gasto en dólares la guarda en
// importeOrig; una inversión MEP, en importeUSD. Mirar solo m.moneda no alcanza: las inversiones
// no lo usan igual.
function montoPropioDeCambio(mov){
  if(!mov) return {monto:0, moneda:"ARS"};
  if(mov.tipo==="Inversion"){
    return (mov.importeUSD||0)>0 && !(mov.importe||0)
      ? {monto:mov.importeUSD, moneda:"USD"}
      : {monto:mov.importe||0, moneda:"ARS"};
  }
  return mov.moneda==="USD"
    ? {monto:mov.importeOrig||0, moneda:"USD"}
    : {monto:mov.importe||0, moneda:"ARS"};
}

// Completa un movimiento existente convirtiéndolo en un cambio: le pone los campos de pata
// que sale y devuelve además la pata que faltaba. NO toca `movs`: devuelve
// {sale, entra} para que el que llama decida. Conserva la categoría original a propósito —
// si vos lo clasificaste como "MEP / AL30", ese dato es tuyo y no hay por qué pisarlo.
function completarCambioDesde(mov, montoFaltante){
  const falta=Math.round((Number(montoFaltante)||0)*100)/100;
  if(!mov || falta<=0) return null;
  const propio=montoPropioDeCambio(mov);
  const enUSD=propio.moneda==="USD";
  const montoPropio=propio.monto;
  if(montoPropio<=0) return null;

  const cambioId=mov.id;
  // Una inversión que en realidad era un cambio pasa a ser la pata que sale: deja de ser
  // Inversion (si no, seguiría contando como capital puesto en un ticker) y se le acomodan los
  // campos de monto a la forma que usa un gasto.
  const base = mov.tipo==="Inversion"
    ? {...mov, tipo:"Gasto", moneda:enUSD?"USD":"ARS",
       importe: enUSD ? montoPropio : montoPropio,
       importeOrig: enUSD ? montoPropio : null,
       importeUSD: undefined, ticker: undefined}
    : mov;
  const sale={...base, cambioId, cambioPata:"sale",
              // Un cambio no es un depósito al fondo ni una compra pagada con él: los flags
              // de ahorro se limpian, si no la plata se contaría por dos caminos.
              esAhorro:false, usaAhorro:false};
  const entra={
    id: cambioId+1, tipo:"Ingreso", cat:base.cat, subcat:base.subcat, fecha:base.fecha,
    nota:base.nota||"", cuenta:base.cuenta||"", cambioId, cambioPata:"entra",
    esAhorro:false, usaAhorro:false, recuperable:0,
    moneda: enUSD ? "ARS" : "USD",
    importe: enUSD ? falta : 0,
    importeOrig: enUSD ? null : falta
  };
  return {sale, entra, montoARS: enUSD ? falta : montoPropio,
          montoUSD: enUSD ? montoPropio : falta};
}

// ═══════════════════════════════════════════
// RENDER DE LA MIGRACIÓN
// ═══════════════════════════════════════════

function renderMigrarCambios(){
  const card=document.getElementById("card-migrar-cambios");
  const el=document.getElementById("migrar-cambios-lista");
  if(!card||!el) return;
  const cands=candidatosAMigrar(movs);
  const descartados=idsIgnorados().length;
  // Si no hay candidatos pero sí descartes, la card sigue a la vista con el botón de
  // deshacer: descartar de más no puede ser una puerta de una sola dirección.
  if(!cands.length && !descartados){ card.style.display="none"; return; }
  card.style.display="block";
  if(!cands.length){
    el.innerHTML=`<div class="inset">
      <div class="txt-md">No queda ninguno sin completar.</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">Marcaste ${descartados} ${descartados===1?"movimiento":"movimientos"} como "no es un cambio".</div>
    </div>
    <button class="btn-sm" style="width:100%;margin-top:10px" onclick="revisarDescartados()">Volver a revisarlos</button>`;
    return;
  }

  el.innerHTML=cands.map(c=>{
    const m=c.mov;
    // El monto que ya está cargado sale de montoPropioDeCambio(): mirar m.moneda no alcanza,
    // porque una inversión guarda el monto en USD en importeUSD y deja moneda sin definir. Por
    // eso una compra MEP en dólares se mostraba como "$0,00".
    const propio=montoPropioDeCambio(m);
    const enUSD=propio.moneda==="USD";
    const monto=enUSD ? `USD ${propio.monto.toFixed(2)}` : fmtS(propio.monto);
    const fecha=String(m.fecha||"").split("-").reverse().join("/");
    const pide=c.faltaPata==="usd" ? "cuántos dólares recibiste" : "cuántos pesos pagaste";
    return `<div class="inset mb-10">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
        <div class="u-min0">
          <div class="txt-md txt-strong">${escapeHtml(m.nota||m.cat||"(sin descripción)")}</div>
          <div class="txt-micro txt-muted">${escapeHtml(fecha)} · ${escapeHtml(m.cat||"")}${m.subcat?" / "+escapeHtml(m.subcat):""}</div>
        </div>
        <strong class="txt-md" style="white-space:nowrap">${monto}</strong>
      </div>
      <div class="txt-xs txt-muted" style="margin-top:6px;line-height:1.45">${escapeHtml(c.motivo)} Para completarlo hace falta ${pide}.</div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn-sm u-flex1" onclick="completarCandidato(${attrJS(String(m.id))})">Completar</button>
        <button class="btn-sm" style="flex:1" onclick="descartarCandidato(${attrJS(String(m.id))})">No es un cambio</button>
      </div>
    </div>`;
  }).join("");
  el.innerHTML+=`<p class="txt-micro txt-muted" style="margin-top:4px">Los que marques como "no es un cambio" no vuelven a aparecer acá.</p>`;
  if(descartados){
    el.innerHTML+=`<button class="btn-sm" style="width:100%;margin-top:8px" onclick="revisarDescartados()">Volver a revisar los ${descartados} descartados</button>`;
  }
}

// Le pide al usuario la mitad que falta y, si confirma, la agrega.
async function completarCandidato(idStr){
  const id=Number(idStr);
  const mov=movs.find(m=>m.id===id);
  if(!mov){ showToast("Ese movimiento ya no está"); renderMigrarCambios(); return; }
  // Misma corrección que en el render: la moneda de la mitad cargada la decide
  // montoPropioDeCambio(), no m.moneda. Con lo de antes, a una compra MEP que YA estaba en
  // dólares se le preguntaba cuántos dólares recibió — la pregunta equivocada, y completar no
  // hacía nada.
  const info=montoPropioDeCambio(mov);
  const enUSD=info.moneda==="USD";
  const propio = enUSD ? `USD ${info.monto.toFixed(2)}` : fmtS(info.monto);
  const pregunta = enUSD
    ? `Este movimiento dice que salieron ${propio}.\n\n¿Cuántos PESOS pagaste por esos dólares?`
    : `Este movimiento dice que salieron ${propio}.\n\n¿Cuántos DÓLARES recibiste a cambio?`;
  const resp=await mostrarPrompt(pregunta, {titulo:"Completar el cambio", placeholder:"0"});
  if(resp===null) return;
  const falta=parseFloat(String(resp).replace(/\./g,"").replace(",","."));
  if(!isFinite(falta) || falta<=0){ showToast("Poné un número mayor a cero"); return; }

  const r=completarCambioDesde(mov, falta);
  if(!r){ showToast("No pude completar este movimiento"); return; }
  const tc=tipoDeCambio(r.montoARS, r.montoUSD);
  const resumen = `${fmtS(r.montoARS)} ↔ USD ${r.montoUSD.toFixed(2)}${tc?`\n\nTipo de cambio: ${fmtS(tc)} por dólar`:""}`;
  if(!await mostrarConfirm(`Va a quedar así:\n\n${resumen}\n\nEl movimiento que ya tenías queda como la mitad que sale, y se agrega la mitad que entra. Su categoría no se toca.`,
    {titulo:"Confirmar", textoOk:"Completar"})) return;

  // Se reemplaza el movimiento original por su versión con los campos de pata, y se agrega
  // la mitad que faltaba justo al lado.
  const idx=movs.findIndex(m=>m.id===id);
  movs.splice(idx, 1, r.sale, r.entra);
  save();
  showToast("Cambio completado ✓");
  renderMigrarCambios();
  renderMovs();
}

async function descartarCandidato(idStr){
  const id=Number(idStr);
  ignorarParaMigrar(id);
  renderMigrarCambios();
}

// Vuelve a poner en la lista los que marcaste como "no es un cambio". Sin esto, descartar
// era irreversible y un toque de más te dejaba el movimiento mal cargado para siempre.
async function revisarDescartados(){
  const n=idsIgnorados().length;
  if(!n){ showToast("No hay ninguno descartado"); return; }
  if(!await mostrarConfirm(`Vuelven a aparecer los ${n} que marcaste como "no es un cambio".`,
    {titulo:"Volver a revisarlos", textoOk:"Mostrarlos"})) return;
  limpiarIgnorados();
  renderMigrarCambios();
  showToast(`${n} ${n===1?"movimiento vuelve":"movimientos vuelven"} a la lista`);
}
