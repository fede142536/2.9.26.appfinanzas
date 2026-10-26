// ═══════════════════════════════════════════
// MONTO RECUPERABLE: MARCAR COMO COBRADO
// ═══════════════════════════════════════════
// Un gasto compartido (`recuperable`: lo que te van a devolver) muestra, debajo del monto, un botón "🔁 Cobrar $25K" igual que el "Marcar
// pagado" de los gastos frecuentes. Al tocarlo se registra la DEVOLUCIÓN como un ingreso (Dinero extra › Devoluciones, en la misma cuenta
// del gasto, con la fecha de hoy), así el balance refleja la plata que volvió; el gasto queda entero. Tocar "✓ Cobrado" lo deshace.
// El estado se deduce de que el ingreso exista (`recuperadoId`): si borrás o restaurás ese ingreso, el botón se acomoda solo.

const RECUP_CAT="Dinero extra";
const RECUP_SUB="Devoluciones";

// ¿Es un gasto con plata por recuperar? Solo gastos propios: ni frecuentes, ni ahorro, ni traspasos.
const tieneRecuperable=m=>!!m && m.tipo==="Gasto" && !m.frecuente && !m._isFrecVirtual && esConsumo(m) && m.recuperable>0;
// El ingreso de la devolución de ese gasto (o null si todavía no se cobró).
const devolucionDe=(m, lista)=> (m && m.recuperadoId) ? ((lista||movs).find(x=>x.id===m.recuperadoId && x.tipo==="Ingreso") || null) : null;
const estaCobrado=(m, lista)=>!!devolucionDe(m, lista);

// Pura. Lo que falta cobrar de los gastos de `lista`: {total (gastos con recuperable), pendientes, ars, usd}. `todas` = para buscar los ingresos (por defecto, movs).
function pendienteDeRecuperar(lista, todas){
  const g=(lista||[]).filter(tieneRecuperable);
  const sin=g.filter(m=>!estaCobrado(m, todas));
  const suma=mon=>Math.round(sin.filter(m=>(m.moneda==="USD"?"USD":"ARS")===mon).reduce((s,m)=>s+m.recuperable,0)*100)/100;
  return {total:g.length, pendientes:sin.length, ars:suma("ARS"), usd:suma("USD")};
}

// Pura. El ingreso de la devolución.
function crearDevolucion(m, hoyISO, id){
  const usd=m.moneda==="USD";
  const desc=m.nota || (m.subcat && m.subcat!=="Otros" ? m.subcat : m.cat) || "gasto";
  return {id, tipo:"Ingreso", importe: usd ? 0 : m.recuperable, importeOrig: usd ? m.recuperable : null, moneda: usd ? "USD" : "ARS",
    cat:RECUP_CAT, subcat:RECUP_SUB, cuenta:m.cuenta||"", fecha:hoyISO, nota:`Devolución: ${desc}`, tags:[],
    esAhorro:false, usaAhorro:false, traspaso:false, recuperable:0, devolucionDeId:m.id};
}

// La subcategoría "Devoluciones" tiene que existir para poder elegirla después al editar el ingreso.
function asegurarCategoriaDevoluciones(){
  if(getCats("Ingreso")[RECUP_CAT] && getCats("Ingreso")[RECUP_CAT].includes(RECUP_SUB)) return;
  if(!custom.Ingreso) custom.Ingreso={};
  custom.Ingreso[RECUP_CAT]=[...(custom.Ingreso[RECUP_CAT]||[]), RECUP_SUB];
}

// Marca como cobrado (crea el ingreso) o deshace el cobro (saca el ingreso). Devuelve true si cambió algo.
function toggleRecuperado(id){
  const m=movs.find(x=>x.id===id);
  if(!tieneRecuperable(m)) return false;
  const previo=devolucionDe(m);
  if(previo){
    eliminarConDeshacer("mov", x=>x.id===previo.id, "Cobro deshecho");
    renderMovs();
    return true;
  }
  asegurarCategoriaDevoluciones();
  let idNuevo=Date.now(); if(movs.some(x=>x.id===idNuevo)) idNuevo++;
  const ing=crearDevolucion(m, hoyLocal(), idNuevo);
  const revertir=capturarCampos([m], ["recuperadoId"]);
  movs.unshift(ing); m.recuperadoId=ing.id;
  save();
  ofrecerDeshacerCambio(`Devolución de ${m.moneda==="USD"?fmtMoneda(m.recuperable,"USD"):fmtS(m.recuperable)} registrada ✓`, ()=>{ revertir(); movs=movs.filter(x=>x.id!==ing.id); });
  renderMovs();
  if(typeof refrescarVistas==="function") refrescarVistas();
  return true;
}

// Si cambiás cuánto se recupera (o lo sacás), la devolución ya registrada se pone igual. Devuelve true si tocó algo.
function sincronizarDevolucion(m){
  const ing=devolucionDe(m);
  if(!ing) return false;
  if(!(m.recuperable>0)){ movs=movs.filter(x=>x.id!==ing.id); delete m.recuperadoId; return true; }
  const usd=m.moneda==="USD";
  ing.moneda=usd?"USD":"ARS"; ing.importe=usd?0:m.recuperable; ing.importeOrig=usd?m.recuperable:null; ing.cuenta=m.cuenta||"";
  return true;
}

// El botón de debajo del monto (HTML), o "" si el gasto no tiene nada por recuperar.
function botonRecuperableHTML(m){
  if(!tieneRecuperable(m)) return "";
  const monto=m.moneda==="USD" ? fmtMoneda(m.recuperable,"USD") : fmtAbbr(m.recuperable);
  return estaCobrado(m)
    ? `<span class="badge badge-success js-toggle-recup" role="button" tabindex="0" aria-label="Cobrado. Tocá para deshacerlo">✓ Cobrado ${monto}</span>`
    : `<span class="badge badge-accent js-toggle-recup" role="button" tabindex="0" aria-label="Por cobrar. Tocá cuando te lo devuelvan">🔁 Cobrar ${monto}</span>`;
}

// El mosaico "A recuperar" de Movimientos: lo que falta cobrar del período, o "" si no hay gastos con recuperable.
function recuperarMosaicoHTML(r){
  if(!r.total) return "";
  const listo=r.pendientes===0;
  const soloUsd=r.usd>0 && !r.ars;
  const val=soloUsd ? `USD ${fmtNum2(r.usd)}` : fmtTotal(r.ars);
  const sub= listo ? "Todo cobrado ✓" : `${r.pendientes} de ${r.total} sin cobrar${r.usd>0&&!soloUsd?` · + USD ${fmtNum2(r.usd)}`:""}`;
  return mosaicoHTML("🔁","A recuperar", listo?"var(--success)":"var(--accent)", val, sub, 'data-mosaico="a-recuperar"');
}
