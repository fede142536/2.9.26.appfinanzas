// ═══════════════════════════════════════════
// AUMENTOS EN GASTOS FIJOS
// ═══════════════════════════════════════════
// Un gasto fijo (alquiler, prepaga, cuota del club) repite el monto que cargaste hasta que registrás un aumento; si te olvidás, la
// app te muestra un gasto más chico que el real. Acá se detectan dos cosas:
//   · Fijos que llevan AUM_MIN_MESES meses o más con el mismo monto (con la inflación acumulada de ese tiempo, si la serie está cargada).
//   · Fijos que venís actualizando todos los meses (los últimos AUM_SEGUIDOS) y este mes todavía no, pasado el día AUM_DIA_AVISO.
//   · Gastos que cargás a mano todos los meses (luz, internet…) y que este mes subieron AUM_UMBRAL_SUBA o más contra los meses anteriores.
// Registrar un aumento es el mismo mecanismo de siempre (`cambios: [{desde:"YYYY-MM", monto}]`): no toca el historial. Nada cambia solo.

const AUM_MIN_MESES=6;
const AUM_UMBRAL_SUBA=0.08;
const AUM_SEGUIDOS=3;
const AUM_DIA_AVISO=10;      // antes de ese día del mes todavía es pronto para decir que falta actualizar
const AUM_SILENCIO_MESES=6;
const AUM_KEY="faumentos";   // {clave: "YYYY-MM"} = no avisar hasta ese mes

const ymValido=s=>/^\d{4}-\d{2}$/.test(String(s||""));

// Pura. Inflación acumulada (en %) de los meses posteriores a `desde` hasta `hasta` inclusive, o null si a la serie le falta algún mes.
function inflacionAcumulada(desde, hasta, tabla){
  if(!ymValido(desde) || !ymValido(hasta) || hasta<=desde) return null;
  let factor=1, ym=desde, guard=0;
  while(ym<hasta && guard++<600){
    ym=addMonths(ym,1);
    const v=tabla ? tabla[ym] : undefined;
    if(typeof v!=="number" || !isFinite(v)) return null;
    factor*=1+v/100;
  }
  return Math.round((factor-1)*1000)/10;
}

// Pura. El mes desde el que rige el monto actual: el último aumento ya vigente, o el mes en que empezó.
function mesDelMontoVigente(x, hoyYM){
  const ajustes=(Array.isArray(x.cambios)?x.cambios:[]).map(c=>c&&c.desde).filter(d=>ymValido(d) && d<=hoyYM);
  return [x.mesInicio, ...ajustes].filter(ymValido).sort().pop()||"";
}

// Pura. Devuelve la lista de cambios con `monto` desde `desde` (reemplaza si ya había uno ese mes). No modifica la original.
function conCambioDeMonto(cambios, desde, monto){
  const m=Math.round(Number(monto)*100)/100;
  const base=(Array.isArray(cambios)?cambios:[]).filter(c=>c && c.desde!==desde).map(c=>({...c}));
  base.push({desde, monto:m});
  return base.sort((a,b)=>a.desde.localeCompare(b.desde));
}

// Recorre los gastos fijos en pesos activos en `hoyYM` (movimientos y compras con tarjeta) y llama a `fn(kind, x, desc, monto)`.
function recorrerFijosEnPesos(movsLista, tcsLista, hoyYM, fn){
  (movsLista||[]).forEach(m=>{
    if(!m || !m.frecuente || m.tipo!=="Gasto" || m.moneda==="USD" || esDepositoAhorro(m)) return;
    if(!gastoFrecActivoEnMes(m, hoyYM)) return;
    fn("mov", m, m.nota || (m.cat ? m.cat+(m.subcat && m.subcat!=="Otros" ? " › "+m.subcat : "") : "Gasto fijo"), getGastoFrecMontoEnMes(m, hoyYM));
  });
  (tcsLista||[]).forEach(t=>{
    if(!t || !t.frecuente || t.moneda==="USD" || !getCuotaEnMes(t, hoyYM)) return;
    fn("tc", t, t.desc||"Gasto fijo con tarjeta", getMontoEnMes(t, hoyYM));
  });
}
const montoFijoEn=(kind, x, ym)=> kind==="tc" ? getMontoEnMes(x, ym) : getGastoFrecMontoEnMes(x, ym);
const silenciado=(sil, clave, hoyYM)=> !!(sil && sil[clave] && sil[clave]>hoyYM);

// Pura. Gastos fijos en pesos, activos hoy, cuyo monto no cambia hace `minMeses` o más.
// Cada uno: {clave, kind:"mov"|"tc", id, desc, monto, desde, meses, inflacion (% o null), sugerido (monto con esa inflación o null)}.
function fijosSinActualizar(movsLista, tcsLista, hoyYM, silenciados, tabla, minMeses){
  const minimo=minMeses===undefined ? AUM_MIN_MESES : minMeses;
  const out=[];
  recorrerFijosEnPesos(movsLista, tcsLista, hoyYM, (kind, x, desc, monto)=>{
    const clave=kind+":"+x.id;
    if(silenciado(silenciados, clave, hoyYM)) return;
    const desde=mesDelMontoVigente(x, hoyYM);
    if(!desde || !(monto>0)) return;
    const meses=mesesEntre(desde, hoyYM);
    if(meses<minimo) return;
    const infl=inflacionAcumulada(desde, addMonths(hoyYM,-1), tabla);
    out.push({clave, kind, id:x.id, desc, monto, desde, meses, inflacion:infl, sugerido: infl!==null && infl>0 ? Math.round(monto*(1+infl/100)/100)*100 : null});
  });
  return out.sort((a,b)=>b.meses-a.meses || b.monto-a.monto);
}

// Pura. Fijos que tuvieron un cambio de monto en CADA uno de los últimos `seguidos` meses y todavía no en `hoyYM`. Si ya cargaste un
// cambio para este mes o para uno futuro, no entran (ya los estás al día). Cada uno: {clave, kind, id, desc, monto, seguidos, mensual (% promedio por mes), sugerido}.
function fijosQueSuelenCambiar(movsLista, tcsLista, hoyYM, silenciados, seguidos){
  const n=seguidos||AUM_SEGUIDOS;
  const out=[];
  recorrerFijosEnPesos(movsLista, tcsLista, hoyYM, (kind, x, desc, monto)=>{
    const clave=kind+":"+x.id;
    if(silenciado(silenciados, clave, hoyYM) || !(monto>0)) return;
    const desdes=(Array.isArray(x.cambios)?x.cambios:[]).map(c=>c&&c.desde).filter(ymValido);
    if(desdes.some(d=>d>=hoyYM)) return;
    for(let k=1;k<=n;k++) if(!desdes.includes(addMonths(hoyYM,-k))) return;
    const antes=montoFijoEn(kind, x, addMonths(hoyYM,-(n+1)));
    const mensual=antes>0 ? Math.round((Math.pow(monto/antes, 1/n)-1)*1000)/10 : null;
    out.push({clave, kind, id:x.id, desc, monto, seguidos:n, mensual, sugerido: mensual!==null && mensual>0 ? Math.round(monto*(1+mensual/100)/100)*100 : null});
  });
  return out.sort((a,b)=>b.monto-a.monto);
}

// Pura. Gastos que cargás todos los meses y que el último mes (este o el pasado) subieron contra la mediana de los 3 anteriores.
// Cada uno: {clave, desc, moneda, ultimoYM, actual, base, pct (0.27 = 27%)}.
function gastosQueSubieron(lista, hoyYM, silenciados, umbral){
  const minimo=umbral===undefined ? AUM_UMBRAL_SUBA : umbral;
  const sil=silenciados||{};
  const sueltos=(lista||[]).filter(m=>m && !m.frecuente);
  const out=[];
  detectarRecurrentes(sueltos, hoyYM).forEach(r=>{
    if(r.ultimoYM<addMonths(hoyYM,-1)) return;   // si el último pago es viejo ya no es noticia
    const clave="rec:"+r.clave;
    if(silenciado(sil, clave, hoyYM)) return;
    const porMes={};
    sueltos.forEach(m=>{
      if(!esGasto(m) || esDepositoAhorro(m)) return;
      const mon=m.moneda==="USD" ? "USD" : "ARS";
      if(normalizarTexto(m.nota)+"|"+mon!==r.clave) return;
      const ym=String(m.fecha||"").slice(0,7);
      porMes[ym]=(porMes[ym]||0)+(mon==="USD" ? (m.importeOrig||0) : (m.importe||0));
    });
    const previos=Object.keys(porMes).filter(ym=>ym<r.ultimoYM).sort().slice(-3);
    if(previos.length<2) return;
    const base=mediana(previos.map(ym=>porMes[ym]));
    const actual=porMes[r.ultimoYM];
    if(!(base>0) || !(actual>0)) return;
    const pct=(actual-base)/base;
    if(pct<minimo) return;
    out.push({clave, desc:r.desc, moneda:r.moneda, ultimoYM:r.ultimoYM, actual, base, pct});
  });
  return out.sort((a,b)=>b.pct-a.pct);
}

// ── Silencios (no avisar de nuevo por un tiempo) ──
function leerSilenciosAumentos(){
  try{ const o=JSON.parse(localStorage.getItem(AUM_KEY)||"{}"); return o && typeof o==="object" && !Array.isArray(o) ? o : {}; }catch(e){ return {}; }
}
function silenciarAumento(clave, meses){
  const o=leerSilenciosAumentos();
  o[clave]=addMonths(currentYM(), meses||AUM_SILENCIO_MESES);
  try{ localStorage.setItem(AUM_KEY, JSON.stringify(o)); }catch(e){ /* sin almacenamiento */ }
}

// `dia` (1-31) es el día del mes de hoy: antes de AUM_DIA_AVISO todavía no se avisa de lo que "suele actualizarse y falta". Sin `dia`, se avisa.
function avisosDeAumentos(lista, tcsLista, hoyYM, dia){
  const sil=leerSilenciosAumentos();
  const sinActualizar=fijosSinActualizar(lista, tcsLista, hoyYM, sil, typeof tablaInflacion==="function" ? tablaInflacion() : {});
  const yaEstancados=new Set(sinActualizar.map(f=>f.clave));
  return {
    sinActualizar,
    habituales: (dia!==undefined && dia<AUM_DIA_AVISO) ? [] : fijosQueSuelenCambiar(lista, tcsLista, hoyYM, sil).filter(f=>!yaEstancados.has(f.clave)),
    subieron: gastosQueSubieron(lista, hoyYM, sil)
  };
}

// El aviso para el Dashboard (lo arma alertasDelMomento). null si no hay nada que revisar. `dia` = día del mes de hoy.
function alertaDeAumentos(lista, tcsLista, hoyYM, dia){
  const r=avisosDeAumentos(lista, tcsLista, hoyYM, dia);
  if(!r.sinActualizar.length && !r.habituales.length && !r.subieron.length) return null;
  const montoDe=(moneda, v)=> moneda==="USD" ? fmtMoneda(v,"USD") : fmtS(v);
  const nombres=(arr, max)=>arr.slice(0,max).map(f=>f.desc).join(", ")+(arr.length>max?` y ${arr.length-max} más`:"");
  let titulo;
  if(r.subieron.length){
    const s=r.subieron[0];
    titulo=`${s.desc} subió ${Math.round(s.pct*100)}% contra los meses anteriores`+(r.subieron.length>1?` · y ${r.subieron.length-1} más`:"");
  }else if(r.habituales.length){
    titulo= r.habituales.length===1
      ? `${r.habituales[0].desc} suele actualizarse todos los meses y este mes todavía no`
      : `${r.habituales.length} gastos fijos suelen actualizarse todos los meses y este mes todavía no`;
  }else if(r.sinActualizar.length===1){
    titulo=`${r.sinActualizar[0].desc} lleva ${r.sinActualizar[0].meses} meses sin cambio de monto`;
  }else{
    titulo=`${r.sinActualizar.length} gastos fijos llevan ${AUM_MIN_MESES} meses o más sin cambio de monto`;
  }
  const partes=[];
  if(r.subieron.length) partes.push(r.subieron.slice(0,3).map(s=>`${s.desc}: ${montoDe(s.moneda,s.actual)} (antes ≈ ${montoDe(s.moneda,s.base)})`).join(" · ")+".");
  if(r.habituales.length) partes.push(`Venías cambiando ${nombres(r.habituales,3)} cada mes: si ya llegó el nuevo valor, registralo para que tus balances reflejen lo que pagás.`);
  if(r.sinActualizar.length){
    partes.push(r.sinActualizar.slice(0,3).map(f=>`${f.desc} (${f.meses} meses${f.inflacion!==null?`, inflación ≈ ${String(f.inflacion).replace(".",",")}%`:""})`).join(" · ")+". Llevan mucho con el mismo monto: si subió, registrá el aumento.");
  }
  return {nivel: r.subieron.length?"warn":"info", icono:"📈", titulo, detalle:partes.join(" "), accion:{texto:"Revisar y registrar aumentos", fn:"abrirAumentos"}};
}

// ── Hoja para revisar y registrar ──
let aumentosFilas={fijos:[], subieron:[]};   // `fijos` = habituales primero y después sin actualizar; el índice es el de cada fila en pantalla
const fmtMesCorto=ym=> (typeof mesLbl==="function" ? mesLbl(ym) : ym);
const fmtPct=n=>String(n).replace(".",",");

function aumentoFijoHTML(f, i){
  const det= f.motivo==="habitual"
    ? `Lo cambiaste en cada uno de los últimos ${f.seguidos} meses${f.mensual!==null?` (≈ ${f.mensual>0?"+":""}${fmtPct(f.mensual)}% por mes)`:""} y este mes todavía figura igual.${f.sugerido?` Con ese ritmo quedaría cerca de ${fmtS(f.sugerido)}.`:""}`
    : `Mismo monto desde ${escapeHtml(fmtMesCorto(f.desde))} (${f.meses} meses).${f.inflacion!==null?` La inflación de ese tiempo fue ≈ ${fmtPct(f.inflacion)}%${f.sugerido?`: ajustado quedaría cerca de ${fmtS(f.sugerido)}`:""}.`:""}`;
  const silencio= f.motivo==="habitual" ? "Todavía no cambió · avisarme el mes que viene" : `Sigue igual · no avisar por ${AUM_SILENCIO_MESES} meses`;
  return `<div class="aum-fila">
      <div class="aum-top"><strong>${escapeHtml(f.desc)}</strong><span>${fmtS(f.monto)}</span></div>
      <div class="aum-det">${det}</div>
      <div class="aum-acc"><input type="text" class="form-input" id="aum-in-${i}" inputmode="decimal" placeholder="Nuevo monto" aria-label="Nuevo monto de ${escapeHtml(f.desc)}" oninput="aplicarMascaraMiles(this,formatearNumeroConMiles)" onkeydown="if(event.key==='Enter'){event.preventDefault();registrarAumento(${i});}">
        <button type="button" class="btn-sm" onclick="registrarAumento(${i})">Registrar</button></div>
      <button type="button" class="aum-link" onclick="silenciarFijo(${i})">${silencio}</button>
    </div>`;
}
function aumentosHTML(fijos, subieron){
  if(!fijos.length && !subieron.length)
    return `<p class="txt-sm" style="margin:12px 0"><strong>✓ Tus gastos fijos están al día.</strong> Te aviso si uno que venías actualizando todos los meses queda sin cambiar, si alguno lleva ${AUM_MIN_MESES} meses o más igual, o si un gasto mensual que cargás a mano sube.</p>`;
  const habituales=fijos.map((f,i)=>({f,i})).filter(x=>x.f.motivo==="habitual");
  const estancados=fijos.map((f,i)=>({f,i})).filter(x=>x.f.motivo!=="habitual");
  const nota=`<p class="txt-xs txt-muted" style="margin:0 0 8px;line-height:1.4">Al registrar, el nuevo monto rige desde este mes. Los meses anteriores no cambian. Para otra fecha, editá el gasto.</p>`;
  const subio=subieron.map((s,i)=>`<div class="aum-fila">
      <div class="aum-top"><strong>${escapeHtml(s.desc)}</strong><span>${s.moneda==="USD"?fmtMoneda(s.actual,"USD"):fmtS(s.actual)}</span></div>
      <div class="aum-det">Subió ${Math.round(s.pct*100)}% contra la mediana de los meses anteriores (≈ ${s.moneda==="USD"?fmtMoneda(s.base,"USD"):fmtS(s.base)}). Es un gasto que cargás a mano cada mes, así que no hay nada para registrar.</div>
      <button type="button" class="aum-link" onclick="silenciarSubio(${i})">Entendido</button>
    </div>`).join("");
  return (subieron.length?`<div class="aum-sec">Subieron este mes</div>${subio}`:"")
    + (habituales.length?`<div class="aum-sec">Suelen actualizarse todos los meses</div>${nota}${habituales.map(x=>aumentoFijoHTML(x.f,x.i)).join("")}`:"")
    + (estancados.length?`<div class="aum-sec">Fijos sin actualizar</div>${habituales.length?"":nota}${estancados.map(x=>aumentoFijoHTML(x.f,x.i)).join("")}`:"");
}
function renderAumentos(){
  const el=document.getElementById("aumentos-cuerpo");
  if(!el) return;
  const r=avisosDeAumentos(movs, tcs, currentYM());   // sin `dia`: si abrís la hoja a propósito, se muestra todo
  aumentosFilas={
    fijos: r.habituales.map(f=>({...f, motivo:"habitual"})).concat(r.sinActualizar.map(f=>({...f, motivo:"estancado"}))),
    subieron: r.subieron
  };
  el.innerHTML=aumentosHTML(aumentosFilas.fijos, aumentosFilas.subieron);
}
function abrirAumentos(){
  if(!document.getElementById("aumentos-cuerpo")) return;
  renderAumentos();
  document.getElementById("modal-aumentos").classList.add("open");
}
function cerrarAumentos(){
  const m=document.getElementById("modal-aumentos");
  if(m) m.classList.remove("open");
  if(typeof refrescarVistas==="function") refrescarVistas();
  if(typeof renderAlertas==="function") try{ renderAlertas(); }catch(e){ /* sin Dashboard */ }
}

// Registra el aumento de la fila `i`: el nuevo monto rige desde el mes en curso.
function registrarAumento(i){
  const f=(aumentosFilas.fijos||[])[i];
  const inp=document.getElementById("aum-in-"+i);
  if(!f || !inp) return false;
  const monto=parseFloat(limpiarImporte(inp.value));
  if(!(monto>0)){ showToast("Escribí el nuevo monto"); return false; }
  if(Math.abs(monto-f.monto)<0.005){ showToast("Es el mismo monto que ya tenés"); return false; }
  const item=(f.kind==="tc" ? tcs : movs).find(x=>x.id===f.id);
  if(!item) return false;
  const revertir=capturarCampos([item], ["cambios"]);
  item.cambios=conCambioDeMonto(item.cambios, currentYM(), monto);
  save();
  ofrecerDeshacerCambio(`${f.desc}: ${fmtS(monto)} desde ${fmtMesCorto(currentYM())} ✓`, ()=>{ revertir(); renderAumentos(); });
  renderAumentos();
  return true;
}
function silenciarFijo(i){
  const f=(aumentosFilas.fijos||[])[i];
  if(!f) return;
  silenciarAumento(f.clave, f.motivo==="habitual" ? 1 : AUM_SILENCIO_MESES);
  renderAumentos();
}
function silenciarSubio(i){
  const s=(aumentosFilas.subieron||[])[i];
  if(!s) return;
  silenciarAumento(s.clave, 2);
  renderAumentos();
}
