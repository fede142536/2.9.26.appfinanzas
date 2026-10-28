// ═══════════════════════════════════════════
// REPETIR UN MOVIMIENTO
// ═══════════════════════════════════════════
// Lo que cargás una y otra vez (la SUBE, la nafta, el súper) se repite con un toque: en cualquier fila, deslizá hacia la derecha y tocá
// "🔁 Repetir" (o usá el mismo botón en el editor). Lleva a Cargar con el mismo movimiento ya armado —tipo, monto, categoría, cuenta, nota—
// pero con la fecha de HOY, para que cambies lo que haga falta y toques Guardar. No guarda nada solo: igual que la carga rápida.

// Pura. Qué hay que cargar para repetir `m` (un movimiento, o una compra con tarjeta de `tcs`), o {motivo} si no se puede repetir.
// Devuelve {r, flags}: `r` es lo que entiende aplicarCargaRapida() y `flags` lo que va aparte (ahorro, retiro, traspaso, recuperable, MEP).
function datosParaRepetir(m, hoyISO){
  if(!m) return {motivo:"No encontré ese movimiento"};
  if(m._isTc || m.cuotasTotal!==undefined && m.total!==undefined && !m.tipo){
    if(m.frecuente) return {motivo:"Los gastos frecuentes ya se repiten solos cada mes"};
    return {r:{tipo:"Tarjeta", nota:m.desc||"", importe:m.total||0, moneda:m.moneda==="USD"?"USD":"ARS", tarjeta:m.tarjeta||"", cat:m.cat||"", cuenta:m.cuenta||"", cuotas:m.cuotasTotal||1, fecha:hoyISO}, flags:{}};
  }
  if(m.frecuente || m._isFrecVirtual) return {motivo:"Los gastos frecuentes ya se repiten solos cada mes"};
  if(typeof esPataDeCambio==="function" && esPataDeCambio(m)) return {motivo:"Un cambio de moneda se carga de nuevo desde la pestaña Cambio"};
  if(m.pagoTarjeta) return {motivo:"El pago de un resumen se carga desde Tarjetas"};
  if(m.origenInvId) return {motivo:"Este retiro se crea junto con la venta: repetí la venta"};
  if(m.devolucionDeId) return {motivo:"Un cobro se registra con el botón “Cobrar” del gasto"};
  const base={nota:m.nota||"", cat:m.cat||"", subcat:m.subcat||"", cuenta:m.cuenta||"", fecha:hoyISO};
  if(m.tipo==="Inversion"){
    const usd=!!(m.importeUSD>0 && !(m.importe>0));
    const sub=m.cat && String(m.subcat||"").startsWith(m.cat+" ") ? String(m.subcat).slice(m.cat.length+1) : (m.subcat||"");
    return {r:{...base, tipo:"Inversion", importe: usd ? m.importeUSD : (m.importe||0), moneda: usd?"USD":"ARS", ticker:m.ticker||"", subcat:sub, saleDeAhorro:false}, flags:{mep:m.mep===true, saleDeAhorro:false}};
  }
  if(m.tipo!=="Gasto" && m.tipo!=="Ingreso") return {motivo:"Este tipo de movimiento no se puede repetir"};
  const usd=m.moneda==="USD";
  return {r:{...base, tipo:m.tipo, importe: usd ? (m.importeOrig||0) : (m.importe||0), moneda: usd?"USD":"ARS"},
    flags: m.tipo==="Gasto" ? {esAhorro:!!m.esAhorro, usaAhorro:!!m.usaAhorro, traspaso:!!m.traspaso, recuperable:m.recuperable>0 ? m.recuperable : 0} : {}};
}

// Pone en el formulario de Cargar lo que devolvió datosParaRepetir().
function aplicarRepeticion(d){
  aplicarCargaRapida(d.r);
  const f=d.flags||{}, chk=(id,v)=>{ const e=document.getElementById(id); if(e) e.checked=!!v; };
  if(d.r.tipo==="Gasto"){
    chk("inp-ahorro", f.esAhorro); chk("inp-usa-ahorro", f.usaAhorro); chk("inp-traspaso", f.traspaso);
    if(typeof ahorroTocado!=="undefined") ahorroTocado=true;   // lo que se repite es lo que ya decidiste: no se vuelve a sugerir
    const sw=document.getElementById("inp-recup-switch"), monto=document.getElementById("inp-recup");
    if(sw){ sw.checked=f.recuperable>0; if(typeof toggleRecuperable==="function") toggleRecuperable(); if(f.recuperable>0 && monto) monto.value=String(f.recuperable); }
  }
  if(d.r.tipo==="Inversion"){ chk("inv-mep", f.mep); chk("inv-sale-ahorro", false); if(typeof actualizarSaleDeAhorro==="function") actualizarSaleDeAhorro(); }
}

// Lo que hace el botón: arma el formulario, lleva a Cargar y avisa. `id` = id del movimiento; `esTc` = es una compra con tarjeta.
function repetirMovimiento(id, esTc){
  const m=esTc ? tcs.find(x=>x.id===id) : movs.find(x=>x.id===id);
  const d=datosParaRepetir(m, currentYMD());
  if(!d.r){ showToast(d.motivo); return false; }
  showPage('cargar', document.querySelector('.nav-btn[onclick*="\'cargar\'"]'));
  aplicarRepeticion(d);
  window.scrollTo(0,0);
  showToast("🔁 Repetido con la fecha de hoy: ajustá lo que haga falta y tocá Guardar");
  return true;
}
// Desde el editor: cierra la hoja y repite el movimiento que se estaba mirando.
function repetirDesdeEditor(){
  const id=editingId;
  closeEditModal();
  repetirMovimiento(id, false);
}
