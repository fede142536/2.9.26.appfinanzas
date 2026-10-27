// ═══════════════════════════════════════════
// MONTO RECUPERABLE: COBRAR (TOTAL O EN PARTES)
// ═══════════════════════════════════════════
// Un gasto compartido (`recuperable`: lo que te van a devolver) muestra, debajo del monto, un botón "🔁 Cobrar $25K" igual que el "Marcar
// pagado" de los gastos frecuentes. Al tocarlo pregunta cuánto te devolvieron (ya viene lo que falta; si te devolvieron todo, alcanza con
// aceptar) y registra la devolución como un ingreso (Dinero extra › Devoluciones, en la misma cuenta del gasto, con la fecha de hoy), así el
// balance refleja la plata que volvió; el gasto queda entero. Si te devuelven en partes, cada cobro es un ingreso y el botón muestra
// "🔁 Faltan $10K". Con todo cobrado dice "✓ Cobrado" y tocarlo deshace el último cobro.
// Lo cobrado se deduce de los ingresos ligados al gasto (`devolucionDeId`): si borrás o restaurás uno, el botón se acomoda solo.

const RECUP_CAT="Dinero extra";
const RECUP_SUB="Devoluciones";

// ¿Es un gasto con plata por recuperar? Solo gastos propios: ni frecuentes, ni ahorro, ni traspasos.
const tieneRecuperable=m=>!!m && m.tipo==="Gasto" && !m.frecuente && !m._isFrecVirtual && esConsumo(m) && m.recuperable>0;
const r2rec=x=>Math.round(x*100)/100;
// Los ingresos que ya cobraron ese gasto, y cuánto suman en la moneda del gasto.
const cobrosDe=(m, lista)=> m ? (lista||movs).filter(x=>x.tipo==="Ingreso" && x.devolucionDeId===m.id) : [];
const montoCobrado=(m, lista)=> r2rec(cobrosDe(m, lista).reduce((s,x)=>s+(m.moneda==="USD" ? (x.importeOrig||0) : montoARS(x)), 0));
// Lo que falta cobrar (nunca negativo).
const faltaCobrar=(m, lista)=> (m && m.recuperable>0) ? Math.max(r2rec(m.recuperable-montoCobrado(m, lista)), 0) : 0;
const estaCobrado=(m, lista)=> tieneRecuperable(m) && faltaCobrar(m, lista)<0.005;

// Pura. Lo que falta cobrar de los gastos de `lista`: {total (gastos con recuperable), pendientes (con algo por cobrar), ars, usd}. `todas` = para buscar los ingresos (por defecto, movs).
function pendienteDeRecuperar(lista, todas){
  const g=(lista||[]).filter(tieneRecuperable);
  const sin=g.filter(m=>!estaCobrado(m, todas));
  const suma=mon=>r2rec(sin.filter(m=>(m.moneda==="USD"?"USD":"ARS")===mon).reduce((s,m)=>s+faltaCobrar(m, todas),0));
  return {total:g.length, pendientes:sin.length, ars:suma("ARS"), usd:suma("USD")};
}

// Pura. El ingreso de una devolución de `monto` (por defecto, todo lo recuperable).
function crearDevolucion(m, hoyISO, id, monto){
  const usd=m.moneda==="USD";
  const v=monto>0 ? monto : m.recuperable;
  const desc=m.nota || (m.subcat && m.subcat!=="Otros" ? m.subcat : m.cat) || "gasto";
  return {id, tipo:"Ingreso", importe: usd ? 0 : v, importeOrig: usd ? v : null, moneda: usd ? "USD" : "ARS",
    cat:RECUP_CAT, subcat:RECUP_SUB, cuenta:m.cuenta||"", fecha:hoyISO, nota:`Devolución: ${desc}`, tags:[],
    esAhorro:false, usaAhorro:false, traspaso:false, recuperable:0, devolucionDeId:m.id};
}

// La subcategoría "Devoluciones" tiene que existir para poder elegirla después al editar el ingreso.
function asegurarCategoriaDevoluciones(){
  if(getCats("Ingreso")[RECUP_CAT] && getCats("Ingreso")[RECUP_CAT].includes(RECUP_SUB)) return;
  if(!custom.Ingreso) custom.Ingreso={};
  custom.Ingreso[RECUP_CAT]=[...(custom.Ingreso[RECUP_CAT]||[]), RECUP_SUB];
}

const fmtRec=(m, v)=> m.moneda==="USD" ? fmtMoneda(v,"USD") : fmtS(v);

// Registra un cobro de `monto` del gasto `m` (crea el ingreso) y ofrece deshacerlo. Devuelve el ingreso creado.
function registrarCobro(m, monto){
  asegurarCategoriaDevoluciones();
  let idNuevo=Date.now(); while(movs.some(x=>x.id===idNuevo)) idNuevo++;
  const ing=crearDevolucion(m, hoyLocal(), idNuevo, monto);
  movs.unshift(ing);
  save();
  const resta=faltaCobrar(m);
  ofrecerDeshacerCambio(`Devolución de ${fmtRec(m, monto)} registrada ✓${resta>0.004 ? ` · faltan ${fmtRec(m, resta)}` : ""}`, ()=>{ movs=movs.filter(x=>x.id!==ing.id); });
  renderMovs();
  if(typeof refrescarVistas==="function") refrescarVistas();
  return ing;
}

// El botón: con algo por cobrar pregunta cuánto te devolvieron; con todo cobrado deshace el último cobro. Devuelve true si cambió algo.
async function toggleRecuperado(id){
  const m=movs.find(x=>x.id===id);
  if(!tieneRecuperable(m)) return false;
  const falta=faltaCobrar(m);
  if(falta<0.005){
    const ultimo=cobrosDe(m).sort(ordenDeOperacion).pop();
    if(!ultimo) return false;
    eliminarConDeshacer("mov", x=>x.id===ultimo.id, "Cobro deshecho");
    renderMovs();
    return true;
  }
  const txt=await mostrarPrompt(`¿Cuánto te devolvieron? Falta cobrar ${fmtRec(m, falta)}.`,
    {titulo:"🔁 Cobrar", tipoInput:"text", inputMode:"decimal", valorInicial:decimalParaMostrar(falta), textoOk:"Registrar cobro"});
  if(txt===null) return false;
  const monto=r2rec(parseFloat(limpiarImporte(txt)));
  if(!(monto>0)){ showToast("Ingresá cuánto te devolvieron"); return false; }
  if(monto>falta+0.005){ showToast(`No puede superar lo que falta (${fmtRec(m, falta)})`); return false; }
  registrarCobro(m, monto);
  return true;
}

// El botón de debajo del monto (HTML), o "" si el gasto no tiene nada por recuperar.
function botonRecuperableHTML(m){
  if(!tieneRecuperable(m)) return "";
  const monto=v=> m.moneda==="USD" ? fmtMoneda(v,"USD") : fmtAbbr(v);
  const falta=faltaCobrar(m);
  if(falta<0.005) return `<span class="badge badge-success js-toggle-recup" role="button" tabindex="0" aria-label="Cobrado. Tocá para deshacer el último cobro">✓ Cobrado ${monto(m.recuperable)}</span>`;
  if(montoCobrado(m)>0) return `<span class="badge badge-accent js-toggle-recup" role="button" tabindex="0" aria-label="Cobro parcial. Tocá cuando te devuelvan más">🔁 Faltan ${monto(falta)}</span>`;
  return `<span class="badge badge-accent js-toggle-recup" role="button" tabindex="0" aria-label="Por cobrar. Tocá cuando te lo devuelvan">🔁 Cobrar ${monto(m.recuperable)}</span>`;
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
