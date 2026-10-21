// ═══════════════════════════════════════════
// MOVIMIENTOS SIN CUENTA: sugerir y asignar en lote
// ═══════════════════════════════════════════
// Un movimiento con la cuenta "Cuentas" (la opción por defecto del selector) o vacía no dice de qué banco o billetera es.
// Para ordenarlos sin tocar uno por uno se aprende de lo que YA tiene cuenta: si el 90% de "Supermercado › Verdulería" salió de
// Mercado Libre, los que no tienen cuenta probablemente también. Las sugerencias se agrupan por categoría (y subcategoría si hay
// datos suficientes) y se aplican por grupo, a elección del usuario. Nada se cambia solo.

const SUG_MIN_SUB=3;       // con al menos 3 movimientos ya asignados en esa subcategoría…
const SUG_MIN_CAT=5;       // …o 5 en la categoría
const SUG_UMBRAL=0.7;      // y que una misma cuenta tenga el 70% o más

const sinCuentaElegida=m=>{ const c=String((m&&m.cuenta)||"").trim(); return !c || c===CUENTA_SIN_ELEGIR; };
// Gastos, ingresos e inversiones sueltos. Las patas de un cambio de moneda y las compras con tarjeta tienen su propia lógica.
const esMovParaCuenta=m=>!!m && (m.tipo==="Gasto"||m.tipo==="Ingreso"||m.tipo==="Inversion") && !m.cambioId;

// Función pura. Devuelve {total, conSugerencia, sinSugerencia, grupos}. Cada grupo:
//   {key, tipo, cat, sub (null = toda la categoría), cuenta (sugerida o null), confianza (0-1), muestras, ids:[…], monto}
function sugerirCuentas(lista){
  const todos=(lista||[]).filter(esMovParaCuenta);
  const statSub={}, statCat={};
  const sumar=(mapa,k,c)=>{ (mapa[k]=mapa[k]||{})[c]=((mapa[k]||{})[c]||0)+1; };
  todos.forEach(m=>{
    if(sinCuentaElegida(m)) return;
    const c=String(m.cuenta).trim();
    sumar(statSub, `${m.tipo}|${m.cat||""}|${m.subcat||""}`, c);
    sumar(statCat, `${m.tipo}|${m.cat||""}`, c);
  });
  const dominante=(est, min)=>{
    if(!est) return null;
    const total=Object.values(est).reduce((s,n)=>s+n,0);
    if(total<min) return null;
    const [cuenta,n]=Object.entries(est).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
    return n/total>=SUG_UMBRAL ? {cuenta, confianza:n/total, muestras:total} : null;
  };
  const grupos=new Map();
  todos.filter(sinCuentaElegida).forEach(m=>{
    const cat=m.cat||"", sub=m.subcat||"";
    const porSub=dominante(statSub[`${m.tipo}|${cat}|${sub}`], SUG_MIN_SUB);
    const porCat=porSub ? null : dominante(statCat[`${m.tipo}|${cat}`], SUG_MIN_CAT);
    const sug=porSub||porCat;
    const nivelSub=!!porSub;
    const key=`${m.tipo}|${cat}|${nivelSub?sub:"*"}|${sug?sug.cuenta:""}`;
    let g=grupos.get(key);
    if(!g){ g={key, tipo:m.tipo, cat, sub:nivelSub?sub:null, cuenta:sug?sug.cuenta:null, confianza:sug?sug.confianza:0, muestras:sug?sug.muestras:0, ids:[], monto:0}; grupos.set(key,g); }
    g.ids.push(m.id); g.monto+=montoARS(m);
  });
  const lista2=[...grupos.values()].sort((a,b)=>b.ids.length-a.ids.length || a.cat.localeCompare(b.cat));
  const total=lista2.reduce((s,g)=>s+g.ids.length,0);
  const conSug=lista2.filter(g=>g.cuenta).reduce((s,g)=>s+g.ids.length,0);
  return {total, conSugerencia:conSug, sinSugerencia:total-conSug, grupos:lista2};
}

// Pone `cuenta` a los movimientos de `ids`. Devuelve cuántos cambió. Solo toca los que siguen sin cuenta.
function asignarCuentaAMovimientos(lista, ids, cuenta){
  const set=new Set(ids), c=String(cuenta||"").trim();
  if(!c || c===CUENTA_SIN_ELEGIR) return 0;
  let n=0;
  (lista||[]).forEach(m=>{ if(set.has(m.id) && sinCuentaElegida(m)){ m.cuenta=c; n++; } });
  return n;
}

// ── Pantalla ──
let sinCuentaGrupos=[];
let sinCuentaCopiaHecha=false;
const cuentasParaElegir=()=>getCuentas().filter(c=>c!==CUENTA_SIN_ELEGIR);
const nombreGrupoSinCuenta=g=>`${escapeHtml(g.cat||"Sin categoría")}${g.sub?` › ${escapeHtml(g.sub)}`:""}`;

function sinCuentaGruposHTML(r){
  if(!r.total) return `<p class="txt-sm" style="margin:12px 0"><strong>✓ Todos tus movimientos tienen cuenta.</strong></p>`;
  const cuentas=cuentasParaElegir();
  const opciones=sel=>`<option value="">Elegí una cuenta…</option>`+cuentas.map(c=>`<option value="${escapeHtml(c)}"${c===sel?" selected":""}>${escapeHtml(c)}</option>`).join("");
  const MAX=60;
  const filas=r.grupos.slice(0,MAX).map((g,i)=>`<div class="sc-grupo">
      <div class="sc-top"><span><strong>${nombreGrupoSinCuenta(g)}</strong> <span class="txt-xs txt-muted">${g.tipo==="Ingreso"?"ingresos":g.tipo==="Inversion"?"inversiones":"gastos"}</span></span><span class="sc-n">${g.ids.length} ${g.ids.length===1?"movimiento":"movimientos"}</span></div>
      <div class="sc-det">${g.cuenta ? `Sugerida: <strong>${escapeHtml(g.cuenta)}</strong> · ${Math.round(g.confianza*100)}% de los ${g.muestras} que ya tienen cuenta` : "Sin sugerencia: no hay suficientes movimientos parecidos con cuenta, o están repartidos."}</div>
      <div class="sc-acc"><select class="form-select" id="sc-sel-${i}" aria-label="Cuenta para ${escapeHtml(g.cat)}">${opciones(g.cuenta||"")}</select>
        <button type="button" class="btn-sm" onclick="aplicarGrupoSinCuenta(${i})">Asignar</button></div>
    </div>`).join("");
  const mas=r.grupos.length>MAX ? `<p class="txt-xs txt-muted" style="margin-top:8px">Y ${r.grupos.length-MAX} grupos más: se muestran cuando termines con estos.</p>` : "";
  const todas=r.conSugerencia ? `<button type="button" class="btn-primary" style="background:var(--save);color:#fff;margin:6px 0 4px" onclick="aplicarSugerenciasSinCuenta()">Aplicar todas las sugerencias (${r.conSugerencia})</button>` : "";
  return `<p class="txt-sm" style="margin:12px 0 4px"><strong>${r.total} ${r.total===1?"movimiento":"movimientos"} sin cuenta</strong>: ${r.conSugerencia} con sugerencia y ${r.sinSugerencia} sin ella.</p>
    <p class="txt-xs txt-muted" style="margin:0 0 8px;line-height:1.4">La sugerencia sale de lo que ya tiene cuenta en la misma categoría. Revisá cada grupo: no se cambia nada hasta que tocás "Asignar".</p>${todas}${filas}${mas}`;
}

function renderSinCuentaDetalle(){
  const el=document.getElementById("sin-cuenta-detalle");
  if(!el) return;
  const r=sugerirCuentas(movs);
  sinCuentaGrupos=r.grupos;
  el.innerHTML=sinCuentaGruposHTML(r);
}
function renderSinCuentaCard(){
  const card=document.getElementById("sin-cuenta-card");
  if(!card) return;
  const r=sugerirCuentas(movs);
  card.style.display=r.total ? "" : "none";
  const el=document.getElementById("sin-cuenta-resumen");
  if(el) el.textContent=`${r.total} ${r.total===1?"movimiento no tiene":"movimientos no tienen"} cuenta elegida (${r.conSugerencia} con sugerencia).`;
}
function abrirSinCuenta(){
  if(!document.getElementById("sin-cuenta-detalle")) return;
  sinCuentaCopiaHecha=false;
  renderSinCuentaDetalle();
  document.getElementById("modal-sin-cuenta").classList.add("open");
}
function cerrarSinCuenta(){
  const m=document.getElementById("modal-sin-cuenta");
  if(m) m.classList.remove("open");
  renderSinCuentaCard();
  if(typeof renderMovs==="function" && document.getElementById("tx-list")) renderMovs();
}

// Antes del primer cambio se guarda una copia de seguridad local, una vez por apertura de la hoja.
async function copiaAntesDeAsignarCuentas(){
  if(sinCuentaCopiaHecha) return;
  try{ await guardarCopiaLocal("seguridad"); }catch(e){ console.warn("No se pudo guardar la copia de seguridad previa:", e); }
  sinCuentaCopiaHecha=true;
}
async function aplicarGrupoSinCuenta(i){
  const g=sinCuentaGrupos[i];
  const cuenta=((document.getElementById("sc-sel-"+i)||{}).value)||"";
  if(!g) return;
  if(!cuenta){ showToast("Elegí una cuenta para este grupo"); return; }
  await copiaAntesDeAsignarCuentas();
  const n=asignarCuentaAMovimientos(movs, g.ids, cuenta);
  if(n) save();
  showToast(`${n} ${n===1?"movimiento":"movimientos"} → ${cuenta} ✓`);
  renderSinCuentaDetalle();
}
async function aplicarSugerenciasSinCuenta(){
  const r=sugerirCuentas(movs);
  const con=r.grupos.filter(g=>g.cuenta);
  if(!con.length) return;
  if(!await mostrarConfirm(`¿Asignar la cuenta sugerida a ${r.conSugerencia} movimientos (${con.length} grupos)? Antes guardo una copia de seguridad.`, {textoOk:"Asignar"})) return;
  await copiaAntesDeAsignarCuentas();
  let n=0;
  con.forEach(g=>{ n+=asignarCuentaAMovimientos(movs, g.ids, g.cuenta); });
  if(n) save();
  showToast(`${n} movimientos con cuenta ✓`);
  renderSinCuentaDetalle();
}
