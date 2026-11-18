// ═══════════════════════════════════════════
// GASTOS QUE SE REPITEN → ¿PASARLOS A FRECUENTE?
// ═══════════════════════════════════════════
// detectarRecurrentes() (analisis.js) ya encuentra lo que pagás todos los meses. Acá se
// filtra lo que en realidad es un gasto FIJO que cargás a mano (Netflix, el gimnasio, la
// prepaga) y se ofrece volverlo frecuente de un toque: desde ahí aparece solo cada mes.
// No es fijo lo que aparece varias veces por mes (Uber, el súper) ni lo que dejaste de pagar.

const REP_IGN_KEY="frepnofijo";       // los que marcaste "No es fijo" (no se vuelven a sugerir)
const REP_UNA_VEZ_MIN=0.8;            // en el 80% de los meses tiene que aparecer UNA sola vez

const repetidosIgnorados=()=>new Set(typeof leerJSONSeguro==="function" ? leerJSONSeguro(REP_IGN_KEY, "[]", "array") : []);

// Pura. Los gastos sueltos que se repiten como un fijo. Cada uno: lo de detectarRecurrentes()
// más {ultimoId, montoUltimo, cuenta}: el movimiento que se volvería frecuente.
function candidatosAFrecuente(lista, tcsLista, hoyYM, ignorados){
  const ign=ignorados instanceof Set ? ignorados : new Set(ignorados||[]);
  const sueltos=(lista||[]).filter(m=>m && m.tipo==="Gasto" && typeof puedeVolverseFrecuente==="function" && puedeVolverseFrecuente(m));
  // Lo que ya tiene un frecuente (o un gasto fijo en tarjeta) con la misma nota no se sugiere.
  const fijos=new Set([
    ...(lista||[]).filter(m=>m && m.frecuente).map(m=>normalizarTexto(m.nota)),
    ...(tcsLista||[]).filter(t=>t && t.frecuente).map(t=>normalizarTexto(t.desc))
  ].filter(Boolean));
  // La clave de cada gasto se calcula una sola vez (normalizarTexto no es gratis y esto corre en cada repintado).
  const porClave={};
  sueltos.forEach(m=>{ const k=normalizarTexto(m.nota)+"|"+(m.moneda==="USD"?"USD":"ARS"); (porClave[k]=porClave[k]||[]).push(m); });
  const out=[];
  detectarRecurrentes(sueltos, hoyYM).forEach(r=>{
    if(ign.has(r.clave) || fijos.has(r.clave.split("|")[0])) return;
    if(r.ultimoYM<addMonths(hoyYM,-1)) return;   // si el último pago es de hace 2 meses o más, ya no se paga
    const del=porClave[r.clave]||[];
    const porMes={};
    del.forEach(m=>{ const ym=String(m.fecha||"").slice(0,7); porMes[ym]=(porMes[ym]||0)+1; });
    const meses=Object.keys(porMes);
    if(meses.filter(ym=>porMes[ym]===1).length/meses.length<REP_UNA_VEZ_MIN) return;
    const ultimo=del.slice().sort((a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||"")) || (b.id||0)-(a.id||0))[0];
    out.push({...r, ultimoId:ultimo.id, montoUltimo: r.moneda==="USD" ? (ultimo.importeOrig||0) : (ultimo.importe||0), cuenta:ultimo.cuenta||""});
  });
  return out;
}

// Pura. Vuelve frecuente al movimiento `m` igual que el editor ("Hacerlo frecuente"): se repite
// desde el mes de su fecha, con su monto. Ese mes queda pago (es el que ya pagaste).
function volverFrecuente(m){
  m.frecuente=true;
  m.mesInicio=String(m.fecha||"").slice(0,7) || currentYM();
  m.mesFin=null; m.cambios=[];
  m.pagos={...(m.pagos||{}), [m.mesInicio]:true};
  return m;
}

const candidatosActuales=()=>candidatosAFrecuente(movs, tcs, currentYM(), repetidosIgnorados());

// El candidato al que pertenece un gasto recién cargado (para ofrecerlo en el momento), o null.
function candidatoDeMovimiento(m){
  if(!m || m.tipo!=="Gasto" || !m.nota || !(typeof funcionActiva!=="function" || funcionActiva("repetidos"))) return null;
  const clave=normalizarTexto(m.nota)+"|"+(m.moneda==="USD"?"USD":"ARS");
  return candidatosActuales().find(c=>c.clave===clave) || null;
}

function pasarAFrecuente(clave){
  const c=candidatosActuales().find(x=>x.clave===clave);
  const m=c ? movs.find(x=>x.id===c.ultimoId) : null;
  if(!m){ showToast("No encontré ese gasto"); return; }
  const antes=JSON.parse(JSON.stringify(m));
  volverFrecuente(m);
  save();
  if(typeof refrescarVistas==="function") refrescarVistas();
  pintarRepetidos(); pintarAvisoRepetidos();
  ofrecerDeshacerCambio(`🔁 «${m.nota}» ahora es frecuente: aparece solo cada mes, no hace falta cargarlo`, ()=>{
    Object.keys(m).forEach(k=>{ delete m[k]; }); Object.assign(m, antes); pintarRepetidos();
  });
}
function noEsFijo(clave){
  guardarJSONSeguro(REP_IGN_KEY, [...new Set([...repetidosIgnorados(), clave])]);
  pintarRepetidos(); pintarAvisoRepetidos();
  if(typeof renderAlertas==="function") renderAlertas();
  showToast("Listo, no te lo vuelvo a sugerir");
}

// ── Aviso arriba de Movimientos (mes en curso), descartable hasta el mes que viene ──
const REP_AVISO_KEY="frepaviso";
function pintarAvisoRepetidos(){
  const el=document.getElementById("mov-repetidos-aviso");
  if(!el) return;
  const ym=currentYM();
  const lista=(filtro==="Todos" && mesActual===ym && localStorage.getItem(REP_AVISO_KEY)!==ym && (typeof funcionActiva!=="function" || funcionActiva("repetidos"))) ? candidatosActuales() : [];
  if(!lista.length){ el.style.display="none"; el.innerHTML=""; return; }
  const n=lista.length;
  el.style.display="block";
  el.innerHTML=`<div class="cierre-aviso"><span>🔁 ${n===1?`<strong>${escapeHtml(lista[0].desc)}</strong> lo cargás todos los meses`:`<strong>${n} gastos</strong> los cargás todos los meses`}: ¿${n===1?"lo hacés":"los hacés"} frecuente${n===1?"":"s"}?</span>
    <button type="button" class="btn-sm" onclick="abrirRepetidos()">Ver</button>
    <button type="button" class="cierre-x" aria-label="Descartar el aviso" onclick="descartarAvisoRepetidos()">×</button></div>`;
}
function descartarAvisoRepetidos(){
  guardarPreferencia(REP_AVISO_KEY, currentYM());
  pintarAvisoRepetidos();
}

// ── Pantalla ──
function abrirRepetidos(){
  pintarRepetidos();
  document.getElementById("modal-repetidos").classList.add("open");
}
function cerrarRepetidos(){ document.getElementById("modal-repetidos").classList.remove("open"); }
function pintarRepetidos(){
  const cont=document.getElementById("repetidos-contenido");
  if(!cont) return;
  const lista=candidatosActuales();
  if(!lista.length){
    cont.innerHTML=`<div class="empty" style="padding:24px 8px"><div class="empty-icon">✅</div>No hay gastos que se repitan sin ser frecuentes. Cuando cargues lo mismo varios meses seguidos, va a aparecer acá.</div>`;
    return;
  }
  const m$=(n,mon)=>mon==="USD" ? fmtMoneda(n,"USD") : fmtS(n);
  cont.innerHTML=`<p class="txt-xs txt-muted" style="margin:0 0 10px;line-height:1.45">Los cargás a mano todos los meses. Si es un gasto fijo, hacelo <strong>frecuente</strong>: aparece solo cada mes con su monto y lo marcás como pagado. Si su monto cambia, se edita desde el frecuente.</p>`+
    lista.map(c=>`<div class="rep-fila">
      <div class="rep-txt"><div class="rep-nom">🔁 ${escapeHtml(c.desc)}</div>
        <div class="rep-det">${escapeHtml(c.cat||"")}${c.subcat&&!SUBCAT_SIN_VALOR.includes(c.subcat)?" / "+escapeHtml(c.subcat):""} · ${c.n===c.span ? `${c.n} meses seguidos` : `${c.n} de los últimos ${c.span} meses`} · último ${m$(c.montoUltimo, c.moneda)}${c.faltaEsteMes?` · <span style="color:var(--warning)">este mes todavía no</span>`:""}</div></div>
      <div class="rep-acc"><button type="button" class="btn-sm rep-si" onclick="pasarAFrecuente(${attrJS(c.clave)})">Hacerlo frecuente</button>
        <button type="button" class="btn-sm" onclick="noEsFijo(${attrJS(c.clave)})">No es fijo</button></div>
    </div>`).join("");
}
