// ═══════════════════════════════════════════
// FONDO DE EMERGENCIA: cuántos meses de gastos cubre tu ahorro
// ═══════════════════════════════════════════
// meses = ahorro / gasto mensual promedio. El ahorro es el saldo de las categorías de ahorro que elijas (por defecto, todas las que
// tienen saldo a favor): para el fondo de emergencia a veces no querés contar, por ejemplo, un fondo de retiro. El gasto mensual es el
// consumo en pesos promedio de los últimos meses COMPLETOS (sin contar lo que ahorraste ni los traspasos). Se compara con un objetivo
// en meses (por defecto 6). Es una preferencia: localStorage llano.

const EMERG_KEY="femerg";
const EMERG_MESES_DEFECTO=6;
const EMERG_MESES_OPCIONES=[3,6,9,12];
const EMERG_VENTANA=6;   // meses completos para el promedio de gasto

function leerFondoEmergencia(){
  try{
    const o=JSON.parse(localStorage.getItem(EMERG_KEY)||"{}");
    const meses=Number.isInteger(o.meses) && o.meses>=1 && o.meses<=60 ? o.meses : EMERG_MESES_DEFECTO;
    const cats=Array.isArray(o.cats) ? o.cats.filter(c=>typeof c==="string") : null;
    return {cats, meses};
  }catch(e){ return {cats:null, meses:EMERG_MESES_DEFECTO}; }
}
function guardarFondoEmergencia(cfg){
  const meses=Number.isInteger(cfg.meses) && cfg.meses>=1 && cfg.meses<=60 ? cfg.meses : EMERG_MESES_DEFECTO;
  return guardarPreferencia(EMERG_KEY, JSON.stringify({cats:Array.isArray(cfg.cats)?cfg.cats:null, meses}));
}

// Consumo en pesos de un mes. `mesFn(ym)` devuelve los movimientos del mes con los frecuentes ya expandidos (getMesMov).
const consumoDelMes=(ym, mesFn)=>Math.round((mesFn(ym)||[]).filter(esConsumo).reduce((s,m)=>s+montoARS(m),0)*100)/100;

// Promedio de consumo mensual de los `n` meses completos anteriores a `hoyYM`. Los meses vacíos del principio (antes de que
// empezaras a cargar) no cuentan; devuelve null si no hay ningún mes con gastos. Pura.
function gastoMensualPromedio(hoyYM, mesFn, n){
  const cantidad=n||EMERG_VENTANA;
  const meses=[]; for(let i=cantidad;i>=1;i--) meses.push(addMonths(hoyYM,-i));
  const montos=meses.map(ym=>consumoDelMes(ym, mesFn));
  const primero=montos.findIndex(x=>x>0);
  if(primero<0) return null;
  const con=montos.slice(primero);
  return {promedio:Math.round(con.reduce((s,x)=>s+x,0)/con.length*100)/100, meses:con.length};
}

// El ahorro que cuenta: saldo de las categorías elegidas (null = todas las que tienen saldo a favor).
function ahorroParaEmergencia(lista, cats){
  const todas=categoriasDeAhorroARS(lista).filter(c=>c.saldo>0);
  const elegidas=cats ? todas.filter(c=>cats.includes(c.cat)) : todas;
  return {monto:Math.round(elegidas.reduce((s,c)=>s+c.saldo,0)*100)/100, cats:elegidas};
}

// estado: "sinDatos" (no hay gastos para promediar) · "bajo" (cubre menos de 1 mes) · "enCamino" · "cumplido"
function planFondoEmergencia(lista, cfg, hoyYM, mesFn){
  const aho=ahorroParaEmergencia(lista, cfg.cats);
  const g=gastoMensualPromedio(hoyYM, mesFn);
  const out={fondo:aho.monto, categorias:aho.cats, gastoMensual:g?g.promedio:null, mesesDeDatos:g?g.meses:0, meses:null, objetivo:cfg.meses, objetivoMonto:null, falta:null, pct:0, estado:"sinDatos"};
  if(!g || !(g.promedio>0)) return out;
  out.meses=Math.round(aho.monto/g.promedio*10)/10;
  out.objetivoMonto=Math.round(g.promedio*cfg.meses*100)/100;
  out.falta=Math.max(Math.round((out.objetivoMonto-aho.monto)*100)/100,0);
  out.pct=Math.max(0,Math.min(100,Math.round(aho.monto/out.objetivoMonto*100)));
  out.estado=aho.monto>=out.objetivoMonto ? "cumplido" : out.meses<1 ? "bajo" : "enCamino";
  return out;
}

// ── Pantalla ──
const mesesTxt=x=>String(x).replace(".",",");
function fondoEmergenciaHTML(p){
  const cab=`<div class="card-title" style="display:flex;justify-content:space-between;align-items:center">🛟 Fondo de emergencia <button type="button" class="field-link" onclick="abrirFondoEmergencia()">Configurar</button></div>`;
  if(p.estado==="sinDatos") return `${cab}<p class="txt-sm txt-muted" style="margin:0">Todavía no hay gastos de meses completos para calcular cuántos meses cubre tu ahorro.</p>`;
  const color=p.estado==="cumplido" ? "var(--save)" : p.estado==="bajo" ? "var(--danger)" : "var(--warning)";
  const cats=p.categorias.map(c=>escapeHtml(c.cat)).join(", ")||"ninguna categoría";
  return `${cab}
    <div class="emerg-num" style="color:${color}">${mesesTxt(p.meses)} <span>${p.meses===1?"mes":"meses"} de gastos</span></div>
    <div class="emerg-barra"><div style="width:${p.pct}%;background:${color}"></div></div>
    <div class="txt-xs txt-muted" style="margin-top:4px">Objetivo: ${p.objetivo} meses · ${p.estado==="cumplido" ? "✓ objetivo cumplido" : `te faltan ${fmtTotal(p.falta)}`}</div>
    <p class="txt-xs txt-muted" style="margin:8px 0 0;line-height:1.45">Ahorro que cuenta: <strong>${fmtTotal(p.fondo)}</strong> (${cats}). Tu gasto mensual promedio, en los últimos ${p.mesesDeDatos} ${p.mesesDeDatos===1?"mes completo":"meses completos"}, es <strong>${fmtTotal(p.gastoMensual)}</strong>.</p>`;
}
function renderFondoEmergencia(){
  const el=document.getElementById("emerg-card");
  if(!el) return;
  el.innerHTML=fondoEmergenciaHTML(planFondoEmergencia(movs, leerFondoEmergencia(), currentYM(), getMesMov));
}

function abrirFondoEmergencia(){
  const cfg=leerFondoEmergencia();
  const todas=categoriasDeAhorroARS(movs).filter(c=>c.saldo>0);
  const sel=document.getElementById("emerg-meses");
  if(!sel||!document.getElementById("emerg-cats")) return;
  sel.innerHTML=EMERG_MESES_OPCIONES.concat(EMERG_MESES_OPCIONES.includes(cfg.meses)?[]:[cfg.meses]).sort((a,b)=>a-b).map(n=>`<option value="${n}"${n===cfg.meses?" selected":""}>${n} meses</option>`).join("");
  document.getElementById("emerg-cats").innerHTML=todas.length
    ? todas.map((c,i)=>`<label class="emerg-cat"><input type="checkbox" class="chk-custom" id="emerg-cat-${i}" data-cat="${escapeHtml(c.cat)}"${!cfg.cats||cfg.cats.includes(c.cat)?" checked":""}><span>${escapeHtml(c.cat)}</span><strong>${fmtTotal(c.saldo)}</strong></label>`).join("")
    : `<p class="txt-sm txt-muted">No tenés ahorros con saldo a favor todavía.</p>`;
  document.getElementById("modal-emerg").classList.add("open");
}
function cerrarFondoEmergencia(){
  const m=document.getElementById("modal-emerg");
  if(m) m.classList.remove("open");
}
function guardarConfigEmergencia(){
  const meses=parseInt((document.getElementById("emerg-meses")||{}).value,10)||EMERG_MESES_DEFECTO;
  const checks=[...document.querySelectorAll("#emerg-cats input[type=checkbox]")];
  const todasMarcadas=checks.length>0 && checks.every(c=>c.checked);
  const cats=checks.length ? (todasMarcadas ? null : checks.filter(c=>c.checked).map(c=>c.dataset.cat)) : null;
  guardarFondoEmergencia({cats, meses});
  cerrarFondoEmergencia();
  renderFondoEmergencia();
  showToast("Fondo de emergencia actualizado ✓");
}
