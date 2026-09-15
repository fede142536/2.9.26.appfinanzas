// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
function init(){
  // Limpieza de claves de IA (feature removida)
  localStorage.removeItem("fanthropickey");
  localStorage.removeItem("fiacache");
  const hoy=new Date();
  document.getElementById("fecha-hoy").textContent=hoy.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
  const iso=currentYMD();
  const ym=currentYM();
  ["inp-fecha","inv-fecha","tc-fecha"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=iso;});
  const mesInicioEl=document.getElementById("tc-mes-inicio");
  if(mesInicioEl) mesInicioEl.value=ym;
  const mesInicioFrecEl=document.getElementById("tc-mes-inicio-frec");
  if(mesInicioFrecEl) mesInicioFrecEl.value=ym;
  document.getElementById("exp-desde").value=ym;
  document.getElementById("exp-hasta").value=ym;
  migrarCategoriasHuerfanas();
  // Sin esto, los toggles de "Es ahorro"/"Sale de mis ahorros"/"Gasto frecuente" quedaban
  // ocultos (display:none del HTML) hasta que el usuario tocaba manualmente una pestaña de
  // tipo — setTipo() es lo único que los muestra, y antes solo se disparaba por click/swipe.
  setTipo('Gasto');
  buildCats();
  buildTcCats();
  buildInvCats();
  buildCuentaSelect("inp-cuenta");
  buildCuentaSelect("inv-cuenta");
  buildCuentaSelect("tc-cuenta");
  buildTarjetaSelect("tc-tarjeta");
  document.getElementById("mes-label").textContent=mesLbl(mesActual);
  renderAlertasFrecuentes();
}

// Alerta sobre gastos frecuentes que caen este mes (mostrada en Cargar)
function renderAlertasFrecuentes(){
  const el=document.getElementById("alertas-frecuentes");
  if(!el) return;
  const hoyYM=currentYM();
  const movsMes=getTcMovsEnMes(hoyYM).filter(m=>m.frecuente);
  if(!movsMes.length){el.innerHTML="";return;}
  const total=movsMes.reduce((s,m)=>s+m.importe,0);
  el.innerHTML=`<div style="background:var(--warning-light);color:var(--warning);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:14px;font-size:12px">
    <strong>🔁 Gastos frecuentes este mes:</strong> ${movsMes.length} ${movsMes.length===1?"servicio":"servicios"} por un total de <strong>${fmtS(total)}</strong>
    <div style="font-size:11px;margin-top:4px;color:var(--muted)">${movsMes.map(m=>`${escapeHtml(m.desc)} (${fmtAbbr(m.importe)})`).join(" · ")}</div>
  </div>`;
}

// ═══════════════════════════════════════════
// CARGAR
// ═══════════════════════════════════════════
function buildCats(){
  if(tipo==="Tarjeta"||tipo==="Inversion")return;
  const cats=getCats(tipo);
  let sorted;
  if(catOrder[tipo] && catOrder[tipo].length){
    // El usuario definió un orden manual: respetarlo
    sorted=ordenarCats(tipo, cats);
  } else {
    // Sin orden manual: ordenar por uso (las más usadas arriba), comportamiento original
    const useCount={};
    movs.forEach(m=>{
      if(m.tipo===tipo && m.cat) useCount[m.cat]=(useCount[m.cat]||0)+1;
    });
    sorted=Object.keys(cats).sort((a,b)=>(useCount[b]||0)-(useCount[a]||0));
  }
  // useCount para las estrellitas (siempre calculado, aunque el orden sea manual)
  const useCount={};
  movs.forEach(m=>{
    if(m.tipo===tipo && m.cat) useCount[m.cat]=(useCount[m.cat]||0)+1;
  });
  document.getElementById("inp-cat").innerHTML=sorted.map(c=>{
    const star=(useCount[c]||0)>=5?" ⭐":"";
    return `<option value="${escapeHtml(c)}">${getIcon(c)} ${escapeHtml(c)}${star}</option>`;
  }).join("");
  updateSubcats();
}
// Llena el select de categorías de la pestaña Tarjeta combinando defaults + personalizadas
function buildTcCats(){
  const cats=getCats("Tarjeta");
  const sel=document.getElementById("tc-cat");
  if(!sel) return;
  const valActual=sel.value;
  sel.innerHTML=ordenarCats("Tarjeta", cats).map(c=>`<option>${escapeHtml(c)}</option>`).join("");
  if(valActual && cats[valActual]) sel.value=valActual;
  autoSeleccionarCuenta();
}
// Llena los selects de categoría y subcategoría del formulario de Inversión
function buildInvCats(){
  const cats=getCats("Inversion");
  const sel=document.getElementById("inv-cat");
  if(!sel) return;
  const valActual=sel.value;
  sel.innerHTML=ordenarCats("Inversion", cats).map(c=>`<option>${escapeHtml(c)}</option>`).join("");
  if(valActual && cats[valActual]) sel.value=valActual;
  updateInvSubcats();
}
// ═══════════════════════════════════════════
// PREDICCIÓN DE CUENTA (frecuencia/moda estadística sobre el historial)
// ═══════════════════════════════════════════
// Busca, entre los movimientos ya cargados con el mismo tipo+categoría (y subcategoría si
// hay datos suficientes), cuál es la cuenta que más se repitió — y la devuelve. null si no
// hay datos o si hay empate (para no "adivinar" cuando en realidad no hay un patrón claro).
function predecirCuenta(tipoAct, catAct, subcatAct){
  if(!catAct) return null;
  // Tarjeta no tiene campo "tipo" en sus objetos (tcs), así que ese filtro no aplica ahí
  const fuente = tipoAct==="Tarjeta" ? tcs : movs;
  let candidatos = fuente.filter(m=>{
    if(tipoAct!=="Tarjeta" && m.tipo!==tipoAct) return false;
    return m.cat===catAct;
  });
  if(!candidatos.length) return null;
  // Si además coincide la subcategoría y hay al menos 2 casos, usamos ese subconjunto más
  // específico en vez de todo el universo de la categoría (mejor predicción cuando se puede)
  if(subcatAct){
    const conSubcatExacta = candidatos.filter(m=>m.subcat===subcatAct);
    if(conSubcatExacta.length>=2) candidatos = conSubcatExacta;
  }
  const conteo={};
  candidatos.forEach(m=>{
    if(!m.cuenta) return;
    conteo[m.cuenta]=(conteo[m.cuenta]||0)+1;
  });
  const entradas=Object.entries(conteo).sort((a,b)=>b[1]-a[1]);
  if(!entradas.length) return null;
  // Empate entre la más frecuente y la segunda: no hay un patrón claro, mejor no sugerir nada
  if(entradas.length>1 && entradas[0][1]===entradas[1][1]) return null;
  return entradas[0][0];
}

// Lee el formulario visible según el tipo activo, predice la cuenta, y si hay resultado
// la aplica al <select> correspondiente con un feedback visual breve.
function autoSeleccionarCuenta(){
  let catAct, subcatAct, selectCuentaId;
  if(tipo==="Inversion"){
    catAct=document.getElementById("inv-cat").value;
    subcatAct=document.getElementById("inv-subcat").value;
    selectCuentaId="inv-cuenta";
  } else if(tipo==="Tarjeta"){
    catAct=document.getElementById("tc-cat").value;
    subcatAct=null; // Tarjeta no tiene subcategoría en el form de carga
    selectCuentaId="tc-cuenta";
  } else {
    catAct=document.getElementById("inp-cat").value;
    subcatAct=document.getElementById("inp-subcat").value;
    selectCuentaId="inp-cuenta";
  }
  const sugerida=predecirCuenta(tipo, catAct, subcatAct);
  if(!sugerida) return;
  const sel=document.getElementById(selectCuentaId);
  if(!sel) return;
  const opciones=[...sel.options].map(o=>o.value);
  if(!opciones.includes(sugerida)) return; // por las dudas de que ya no exista esa cuenta
  if(sel.value===sugerida) return; // ya estaba seleccionada, no hace falta ni flash ni toast
  sel.value=sugerida;
  sel.classList.add("cuenta-sugerida-flash");
  setTimeout(()=>sel.classList.remove("cuenta-sugerida-flash"), 700);
  showToast(`💡 Cuenta sugerida aplicada: ${sugerida}`);
}

function updateInvSubcats(){
  const cat=document.getElementById("inv-cat").value;
  const subList=getCats("Inversion")[cat]||["Otros"];
  document.getElementById("inv-subcat").innerHTML=subList.map(s=>`<option>${escapeHtml(s)}</option>`).join("");
  autoSeleccionarCuenta();
}
function updateSubcats(){
  const cat=document.getElementById("inp-cat").value;
  document.getElementById("inp-subcat").innerHTML=(getCats(tipo)[cat]||["Otros"]).map(s=>`<option>${escapeHtml(s)}</option>`).join("");
  autoSeleccionarCuenta();
}

// ═══════════════════════════════════════════
// CATEGORIZACIÓN AUTOMÁTICA
// ═══════════════════════════════════════════
// Mapa de palabras clave de comercios/servicios comunes en Argentina.
// Formato: {keyword regex, tipo, cat, subcat?}
// Se evalúa de más específico a menos específico (primer match gana).
const AUTO_CAT_RULES = [
  // Supermercados / Almacén
  {re:/\b(disco|carrefour|coto|jumbo|dia|diarco|vea|toledo|chango\s*m[aá]s|la\s*anonima|wal\s*mart|super)\b/i, tipo:"Gasto", cat:"Supermercado", subcat:"Almacen"},
  {re:/\b(verdulería|verduler[ií]a|frutas?\s*y\s*verduras|fruver)\b/i, tipo:"Gasto", cat:"Supermercado", subcat:"Verduleria"},
  {re:/\b(carnicer[ií]a|carniceria|pollería|pollos?)\b/i, tipo:"Gasto", cat:"Supermercado", subcat:"Carnicería"},
  {re:/\b(panader[ií]a|panaderia|facturas|medialunas)\b/i, tipo:"Gasto", cat:"Supermercado", subcat:"Panadería"},

  // Transporte / Auto
  {re:/\b(ypf|shell|axion|puma|esso|nafta|gas\s*oil|gasoil|combustible)\b/i, tipo:"Gasto", cat:"Auto", subcat:"Nafta"},
  {re:/\b(peaje|autopista|telepase)\b/i, tipo:"Gasto", cat:"Auto", subcat:"Peajes"},
  {re:/\b(uber|cabify|didi|taxi|remis)\b/i, tipo:"Gasto", cat:"Transporte"},
  {re:/\b(sube|colectivo|subte|tren|bondi)\b/i, tipo:"Gasto", cat:"Transporte"},
  {re:/\b(patente|vtv|seguro\s*auto|cocheras?)\b/i, tipo:"Gasto", cat:"Auto"},

  // Delivery / Comida
  {re:/\b(rappi|pedidos\s*ya|pedidosya|mcdonalds|burger\s*king|kfc|mostaza|delivery)\b/i, tipo:"Gasto", cat:"Delivery"},

  // Suscripciones / Salidas
  {re:/\b(spotify|netflix|disney|hbo|amazon\s*prime|youtube\s*premium|apple\s*music|paramount)\b/i, tipo:"Gasto", cat:"Salidas", subcat:"Suscripción"},
  {re:/\b(cine|cinemark|hoyts|showcase|teatro)\b/i, tipo:"Gasto", cat:"Salidas"},
  {re:/\b(bar|cerveza|restaurant|cervecer[ií]a|pizzer[ií]a)\b/i, tipo:"Gasto", cat:"Salidas"},

  // Casa / Servicios
  {re:/\b(edenor|edesur|metrogas|aguas\s*argentinas|aysa|aysa|gas\s*natural|luz)\b/i, tipo:"Gasto", cat:"Casa"},
  {re:/\b(telecentro|fibertel|movistar|claro|personal|tuenti|internet|wifi|cablevisi[oó]n)\b/i, tipo:"Gasto", cat:"Casa"},
  {re:/\b(expensas|alquiler|abl|rentas|inmobiliaria)\b/i, tipo:"Gasto", cat:"Casa"},

  // Salud
  {re:/\b(farmacity|farmac[ií]a|farmacia|dr\.?|m[eé]dico|cl[ií]nica|hospital|kinesi|odont|dentista)\b/i, tipo:"Gasto", cat:"Salud"},
  {re:/\b(osde|swiss\s*medical|galeno|medicus|omint|prepaga|obra\s*social)\b/i, tipo:"Gasto", cat:"Salud"},

  // Mascota (Enola)
  {re:/\b(enola|veterinari[ao]|petshop|pet\s*shop|alimento\s*balanceado|royal\s*canin)\b/i, tipo:"Gasto", cat:"Enola"},

  // Ingresos típicos
  {re:/\b(sueldo|salario|haberes|liquidaci[oó]n|bono|aguinaldo|sac)\b/i, tipo:"Ingreso", cat:"Salario", subcat:"Salario"},
  {re:/\b(alquiler\s*cobrado|inquilin[oa])\b/i, tipo:"Ingreso", cat:"Alquiler Luján"},
];

// Busca una sugerencia para el texto. Prioriza:
// 1. Historial del usuario (movs anteriores con la misma palabra)
// 2. Reglas hardcoded de comercios conocidos
function buscarSugerencia(texto, tipoActual){
  const limpio=String(texto||"").trim().toLowerCase();
  if(limpio.length<3) return null;

  // 1. HISTORIAL: buscar movs anteriores cuya nota tenga palabras en común con la nota actual
  // Solo del tipo actual (Gasto sugiere de Gastos, Ingreso de Ingresos)
  const palabras=limpio.split(/\s+/).filter(p=>p.length>=3);
  if(palabras.length){
    const candidatos={};
    movs.forEach(m=>{
      if(m.tipo!==tipoActual) return;
      if(!m.nota) return;
      const notaLow=String(m.nota).toLowerCase();
      // Cuenta cuántas palabras de la nota actual aparecen en la nota del histórico
      let matches=0;
      palabras.forEach(p=>{ if(notaLow.includes(p)) matches++; });
      if(matches>0){
        const key=m.cat+"||"+(m.subcat||"");
        candidatos[key]=(candidatos[key]||0)+matches;
      }
    });
    const top=Object.entries(candidatos).sort((a,b)=>b[1]-a[1])[0];
    if(top){
      const [cat,subcat]=top[0].split("||");
      return {cat, subcat: subcat||null, fuente:"historial"};
    }
  }

  // 2. REGLAS de comercios conocidos
  for(const rule of AUTO_CAT_RULES){
    if(rule.tipo!==tipoActual) continue;
    if(rule.re.test(limpio)){
      return {cat: rule.cat, subcat: rule.subcat||null, fuente:"reglas"};
    }
  }
  return null;
}

// Llamado cuando el usuario escribe en la nota
function sugerirCategoria(){
  if(tipo!=="Gasto" && tipo!=="Ingreso"){
    document.getElementById("sugerencia-cat").style.display="none";
    return;
  }
  const nota=document.getElementById("inp-nota").value;
  const sug=buscarSugerencia(nota, tipo);
  const el=document.getElementById("sugerencia-cat");
  if(!sug){
    el.style.display="none";
    return;
  }
  // Verificar que la categoría existe en el sistema (puede ser default o custom del usuario)
  const cats=getCats(tipo);
  if(!cats[sug.cat]){
    el.style.display="none";
    return;
  }
  // Guardar la sugerencia para aplicarla cuando se toca
  el._sugerencia=sug;
  const icon=getIcon(sug.cat,"💡");
  const fuenteLabel=sug.fuente==="historial"?"según tu historial":"sugerido";
  el.innerHTML=`💡 <strong>${icon} ${escapeHtml(sug.cat)}${sug.subcat?" / "+escapeHtml(sug.subcat):""}</strong> <span style="opacity:.7;font-size:11px">· ${fuenteLabel} · tocá para aplicar</span>`;
  el.style.display="block";
}

// Aplica la sugerencia al selector de categoría
function aplicarSugerenciaCat(){
  const el=document.getElementById("sugerencia-cat");
  const sug=el._sugerencia;
  if(!sug) return;
  // Setear cat
  const catSel=document.getElementById("inp-cat");
  const opcion=Array.from(catSel.options).find(o=>o.value===sug.cat);
  if(opcion){
    catSel.value=sug.cat;
    updateSubcats();
    // Setear subcat si fue sugerida y existe
    if(sug.subcat){
      const subSel=document.getElementById("inp-subcat");
      const subOpt=Array.from(subSel.options).find(o=>o.value===sug.subcat);
      if(subOpt) subSel.value=sug.subcat;
    }
  }
  el.style.display="none";
  showToast("✓ Categoría aplicada");
}
function toggleUSD(){
  const isUSD=document.getElementById("inp-moneda").value==="USD";
  document.getElementById("inp-importe-prefix").textContent=isUSD?"USD":"$";
  const lbl=document.getElementById("inp-importe-label");
  if(lbl) lbl.textContent=isUSD?"Importe (USD)":"Importe (ARS)";
}
// ═══════════════════════════════════════════
// SWIPE para cambiar de tipo en Cargar (Gasto ↔ Ingreso ↔ Inversión ↔ Tarjeta)
// ═══════════════════════════════════════════
// El área de detección es TODA la pantalla de Cargar (#page-cargar), no solo la card —
// así el swipe funciona sin importar en qué parte de la pantalla estés tocando.
(function(){
  const TIPOS=["Gasto","Ingreso","Inversion","Tarjeta"];
  const pageCargar=document.getElementById("page-cargar");
  if(!pageCargar) return;
  // Elementos que ya tienen su propio gesto horizontal (carruseles, inputs numéricos con
  // spinner nativo, el futuro <tx-item> con swipe para borrar): si el toque arranca ahí,
  // abortamos. Ojo: NO excluimos inputs de texto/selects/botones en general — el campo del
  // monto (#inp-importe) es lo primero que toca cualquiera al abrir Cargar, y excluir todo
  // el formulario dejaba casi sin superficie donde arrancar el swipe. El umbral de 50px ya
  // protege de sobra contra que un simple tap (que casi no se mueve) dispare un cambio de tipo.
  const SELECTOR_EXCLUIR=".hscroll,.filter-row,.year-tabs,input[type='number'],input[type='range'],tx-item";
  let startX=0, startY=0, tracking=false;
  pageCargar.addEventListener("touchstart", e=>{
    if(!pageCargar.classList.contains("active")){ tracking=false; return; }
    if(e.target.closest(SELECTOR_EXCLUIR)){ tracking=false; return; }
    startX=e.touches[0].clientX;
    startY=e.touches[0].clientY;
    tracking=true;
  }, {passive:true});
  pageCargar.addEventListener("touchmove", ()=>{ /* el umbral se evalúa recién al soltar, en touchend */ }, {passive:true});
  const onEnd=e=>{
    if(!tracking) return;
    tracking=false;
    if(!pageCargar.classList.contains("active")) return;
    const t=e.changedTouches[0];
    const deltaX=t.clientX-startX;
    const deltaY=t.clientY-startY;
    // Umbral (slop) estricto: swipe horizontal deliberado, nunca interfiere con el scroll vertical
    if(Math.abs(deltaX)<=50 || Math.abs(deltaY)>=30) return;
    const idx=TIPOS.indexOf(tipo);
    const siguiente = deltaX<0 ? TIPOS[(idx+1)%TIPOS.length] : TIPOS[(idx-1+TIPOS.length)%TIPOS.length];
    setTipo(siguiente);
  };
  pageCargar.addEventListener("touchend", onEnd);
  pageCargar.addEventListener("touchcancel", ()=>{ tracking=false; });
})();

// ═══════════════════════════════════════════
// RIPPLE EFFECT (.btn-primary, .pin-key, .type-btn)
// ═══════════════════════════════════════════
// Un solo listener delegado en document (no uno por botón — estos elementos se re-crean
// constantemente vía innerHTML en toda la app, así que delegar es lo único que no requiere
// re-adjuntar listeners cada vez que algo se re-renderiza).
document.addEventListener("click", e=>{
  const btn=e.target.closest(".btn-primary,.pin-key,.type-btn");
  if(!btn) return;
  const rect=btn.getBoundingClientRect();
  const size=Math.max(rect.width, rect.height)*2; // cubre de sobra hasta la esquina más lejana
  const span=document.createElement("span");
  span.className="ripple-effect";
  span.style.width=span.style.height=size+"px";
  span.style.left=(e.clientX-rect.left-size/2)+"px";
  span.style.top=(e.clientY-rect.top-size/2)+"px";
  btn.appendChild(span);
  span.addEventListener("animationend", ()=>span.remove());
});

function setTipo(t){
  tipo=t;
  const pageCargar=document.getElementById("page-cargar");
  if(pageCargar){
    pageCargar.classList.remove("theme-gasto","theme-ingreso","theme-inversion","theme-tarjeta");
    pageCargar.classList.add("theme-"+t.toLowerCase());
  }
  ["gasto","ingreso","inversion","tarjeta"].forEach(x=>document.getElementById("btn-"+x).className="type-btn");
  document.getElementById("btn-"+t.toLowerCase()).className="type-btn active-"+t.toLowerCase();
  document.getElementById("campos-gi").style.display=(t==="Gasto"||t==="Ingreso")?"block":"none";
  document.getElementById("campos-inv").style.display=t==="Inversion"?"block":"none";
  document.getElementById("campos-tc").style.display=t==="Tarjeta"?"block":"none";
  // El toggle de ahorro solo aparece en Gasto
  document.getElementById("ahorro-toggle-group").style.display=(t==="Gasto")?"block":"none";
  document.getElementById("frecuente-toggle-group").style.display=(t==="Gasto")?"block":"none";
  document.getElementById("recuperable-group").style.display=(t==="Gasto")?"block":"none";
  if(t!=="Gasto"){
    document.getElementById("inp-ahorro").checked=false;
    document.getElementById("inp-usa-ahorro").checked=false;
    const frecEl=document.getElementById("inp-frecuente");
    if(frecEl) frecEl.checked=false;
    document.getElementById("inp-recup").value="";
  }
  const labels={Gasto:"Guardar gasto",Ingreso:"Guardar ingreso",Inversion:"Guardar inversión",Tarjeta:"Guardar tarjeta"};
  const cls={Gasto:"btn-gasto",Ingreso:"btn-ingreso",Inversion:"btn-inversion",Tarjeta:"btn-tarjeta"};
  const btn=document.getElementById("btn-guardar");
  btn.className="btn-primary "+cls[t];btn.textContent=labels[t];
  if(t==="Gasto"||t==="Ingreso")buildCats();
  if(t==="Tarjeta"){ buildTcCats(); buildTarjetaSelect("tc-tarjeta"); }
  if(t==="Inversion") buildInvCats();
}
function toggleFrecuente(){
  const isFrec=document.getElementById("tc-frecuente").checked;
  document.getElementById("tc-cuotas-row").style.display=isFrec?"none":"grid";
  document.getElementById("tc-frec-row").style.display=isFrec?"grid":"none";
  const isUSD=document.getElementById("tc-moneda").value==="USD";
  document.getElementById("tc-total-label").textContent=(isFrec?"Monto mensual":"Monto total")+(isUSD?" (USD)":" ($)");
  // Sincronizar el mes de inicio si se vuelve a cuotas
  if(!isFrec){
    const v=document.getElementById("tc-mes-inicio-frec").value;
    if(v) document.getElementById("tc-mes-inicio").value=v;
  } else {
    const v=document.getElementById("tc-mes-inicio").value;
    if(v) document.getElementById("tc-mes-inicio-frec").value=v;
  }
  calcCuota();
}
// Cambia entre ARS y USD en el form de tarjeta
function toggleTcMoneda(){
  const isUSD=document.getElementById("tc-moneda").value==="USD";
  document.getElementById("tc-amount-prefix").textContent=isUSD?"USD":"$";
  const isFrec=document.getElementById("tc-frecuente").checked;
  document.getElementById("tc-total-label").textContent=(isFrec?"Monto mensual":"Monto total")+(isUSD?" (USD)":" ($)");
  calcCuota();
}
function calcCuota(){
  const total=parseFloat(limpiarImporte(document.getElementById("tc-total").value))||0;
  const isFrec=document.getElementById("tc-frecuente").checked;
  const isUSD=document.getElementById("tc-moneda").value==="USD";
  const prev=document.getElementById("tc-preview");
  const lbl=document.getElementById("tc-cuota-label")||document.querySelector("#tc-preview span:first-child");
  const fmtCur=(v)=>isUSD?`USD ${v.toFixed(2)}`:fmt(v);
  if(isFrec){
    if(total>0){
      prev.style.display="block";
      if(lbl) lbl.textContent="Monto mensual";
      document.getElementById("tc-cuota-val").textContent=fmtCur(total);
    } else prev.style.display="none";
  } else {
    const c=parseInt(document.getElementById("tc-cuotas").value)||1;
    if(total>0&&c>0){
      prev.style.display="block";
      if(lbl) lbl.textContent="Valor por cuota";
      document.getElementById("tc-cuota-val").textContent=fmtCur(total/c);
    } else prev.style.display="none";
  }
}
// Compara un monto nuevo contra el historial del usuario (mismo tipo, misma moneda) para detectar
// posibles errores de tipeo (ej: un cero de más). Solo actúa si hay suficiente historial para comparar
// y el monto es desproporcionado tanto en términos relativos como en términos absolutos.
function importeParaceAbsurdo(importe, tipoMov, moneda){
  if(moneda==="USD") return false; // sin base de comparación confiable para USD acá
  const historicos=movs.filter(m=>m.tipo===tipoMov && m.moneda!=="USD" && (m.importe||0)>0).map(m=>m.importe);
  if(historicos.length<5) return false; // muy poco historial para juzgar
  const sorted=[...historicos].sort((a,b)=>a-b);
  const mediana=sorted[Math.floor(sorted.length/2)];
  return importe > mediana*30 && importe > mediana+1000;
}

async function guardar(){
  if(tipo==="Tarjeta"){
    const desc=document.getElementById("tc-desc").value.trim();
    const total=parseFloat(limpiarImporte(document.getElementById("tc-total").value))||0;
    const isFrec=document.getElementById("tc-frecuente").checked;
    if(!desc||total<=0){showToast("Completá descripción e importe");return;}
    let mesInicio,mesFin=null,cuotasT=1;
    if(isFrec){
      mesInicio=document.getElementById("tc-mes-inicio-frec").value;
      mesFin=document.getElementById("tc-mes-fin").value||null;
      if(!mesInicio){showToast("Indicá el mes de inicio del gasto frecuente");return;}
      if(mesFin&&mesFin<mesInicio){showToast("El mes de fin no puede ser antes del inicio");return;}
    } else {
      cuotasT=parseInt(document.getElementById("tc-cuotas").value)||1;
      mesInicio=document.getElementById("tc-mes-inicio").value;
      if(!mesInicio){showToast("Indicá en qué mes cae la 1ª cuota");return;}
    }
    tcs.unshift({
      id:Date.now(),
      desc,
      tarjeta:document.getElementById("tc-tarjeta").value,
      cat:document.getElementById("tc-cat").value,
      cuenta:document.getElementById("tc-cuenta")?document.getElementById("tc-cuenta").value:"",
      moneda:document.getElementById("tc-moneda").value,  // "ARS" o "USD"
      total,                      // si frecuente: monto mensual; si cuotas: monto total
      cuotasTotal:cuotasT,        // 1 si frecuente
      mesInicio,                  // "YYYY-MM"
      mesFin,                     // null o "YYYY-MM" (solo frecuentes)
      frecuente:isFrec,
      cambios:[],                 // historial de aumentos: [{desde:"YYYY-MM", monto:N}]
      fecha:document.getElementById("tc-fecha").value,
      nota:document.getElementById("tc-nota").value.trim()
    });
    save();vibrar([15,50,15]);showToast("Tarjeta guardada ✓");
    resetForm("Tarjeta");
    return;
  }
  if(tipo==="Inversion"){
    const ars=parseFloat(limpiarImporte(document.getElementById("inv-ars").value))||0;
    const usd=parseFloat(limpiarImporte(document.getElementById("inv-usd").value))||0;
    const ticker=document.getElementById("inv-ticker").value.trim();
    if(ars<=0&&usd<=0){showToast("Ingresá al menos un importe");return;}
    if(!ticker){showToast("Ingresá el ticker o fondo");return;}
    const cat=document.getElementById("inv-cat").value;
    const subcat=document.getElementById("inv-subcat").value;
    const cuentaInvEl=document.getElementById("inv-cuenta");
    movs.unshift({id:Date.now(),tipo:"Inversion",importe:ars,importeUSD:usd,
      cat,subcat:cat+" "+subcat,ticker,fecha:document.getElementById("inv-fecha").value,
      cuenta:cuentaInvEl?cuentaInvEl.value:"",
      nota:document.getElementById("inv-nota").value.trim()});
    save();vibrar([15,50,15]);showToast("Inversión guardada ✓");
    resetForm("Inversion");
    return;
  }
  let importe=evalImporte(document.getElementById("inp-importe").value)||0;
  if(importe<=0){showToast("Ingresá un importe válido");return;}
  const moneda=document.getElementById("inp-moneda").value;
  if(importeParaceAbsurdo(importe, tipo, moneda)){
    if(!await mostrarConfirm(`El monto ${fmtS(importe)} es mucho más alto que tus ${tipo==="Gasto"?"gastos":"ingresos"} habituales.\n\n¿Es correcto? (revisá que no sobre algún cero)`, {textoOk:"Sí, es correcto"})) return;
  }
  // En ARS: importe va a `importe` y `importeOrig` queda null
  // En USD: importe queda como `importeOrig` (nativo USD); `importe` se setea a 0
  // así no se mezcla con el flujo ARS y los cálculos de saldo final ARS no lo cuentan
  const isUSD=moneda==="USD";
  const esFrec=tipo==="Gasto" && document.getElementById("inp-frecuente")?.checked;
  const fechaCarga=document.getElementById("inp-fecha").value;
  const mov={id:Date.now(),tipo,
    importe: isUSD ? 0 : importe,
    importeOrig: isUSD ? importe : null,
    moneda,cat:document.getElementById("inp-cat").value,subcat:document.getElementById("inp-subcat").value,
    cuenta:document.getElementById("inp-cuenta").value,fecha:fechaCarga,
    nota:document.getElementById("inp-nota").value.trim(),
    tags: extraerTags(document.getElementById("inp-nota").value),
    esAhorro: tipo==="Gasto" && document.getElementById("inp-ahorro").checked,
    usaAhorro: tipo==="Gasto" && document.getElementById("inp-usa-ahorro").checked,
    recuperable: tipo==="Gasto" ? (parseFloat(document.getElementById("inp-recup").value)||0) : 0};
  // Si es gasto frecuente, agregamos los flags. El "mesInicio" es el mes de la fecha cargada.
  if(esFrec){
    mov.frecuente=true;
    mov.mesInicio=String(fechaCarga||"").slice(0,7) || currentYM();
    mov.cambios=[]; // historial de aumentos vacío
    mov.mesFin=null;
  }
  movs.unshift(mov);
  save();
  let msg="Ingreso guardado ✓";
  if(tipo==="Gasto"){
    if(esFrec) msg="🔁 Gasto frecuente guardado ✓";
    else if(document.getElementById("inp-ahorro").checked) msg="Ahorro guardado ✓";
    else if(document.getElementById("inp-usa-ahorro").checked) msg="Retiro de ahorros guardado ✓";
    else msg="Gasto guardado ✓";
  }
  showToast(msg);
  vibrar([15,50,15]);
  resetForm(tipo);
}

// Tras guardar, el formulario se resetea pero la página sigue scrolleada abajo, donde está el
// botón "Guardar". Dar foco al campo no alcanza para traerlo a la vista: en el celular se abre
// el teclado sobre un campo que quedó arriba del borde de la pantalla y escribís a ciegas.
// Por eso se sube explícitamente al principio del formulario DESPUÉS de enfocar (focus() puede
// mover el scroll por su cuenta, así que el scrollTo tiene que ir último para ganar).
function enfocarCampoDeArriba(id){
  const el=document.getElementById(id);
  if(!el) return;
  el.focus();
  window.scrollTo(0,0);
}

// Resetea el formulario al estado inicial para cargar otro movimiento
function resetForm(t){
  const iso=currentYMD();
  const ym=currentYM();
  if(t==="Gasto"||t==="Ingreso"){
    document.getElementById("inp-importe").value="";
    document.getElementById("inp-nota").value="";
    document.getElementById("inp-moneda").value="ARS";
    document.getElementById("inp-ahorro").checked=false;
    document.getElementById("inp-usa-ahorro").checked=false;
    document.getElementById("inp-recup").value="";
    const sugEl=document.getElementById("sugerencia-cat");
    if(sugEl){sugEl.style.display="none";sugEl._sugerencia=null;}
    document.getElementById("inp-importe-prefix").textContent="$";
    const lblReset=document.getElementById("inp-importe-label");
    if(lblReset) lblReset.textContent="Importe (ARS)";
    document.getElementById("inp-fecha").value=iso;
    // Volver categoría/subcategoría al primer valor
    const catSel=document.getElementById("inp-cat");
    if(catSel.options.length) catSel.selectedIndex=0;
    updateSubcats();
    // Foco en el importe para cargar el siguiente
    enfocarCampoDeArriba("inp-importe");
  } else if(t==="Inversion"){
    ["inv-ars","inv-usd","inv-ticker","inv-nota"].forEach(id=>document.getElementById(id).value="");
    document.getElementById("inv-fecha").value=iso;
    enfocarCampoDeArriba("inv-ticker");
  } else if(t==="Tarjeta"){
    ["tc-desc","tc-total","tc-cuotas","tc-nota","tc-mes-fin"].forEach(id=>document.getElementById(id).value="");
    document.getElementById("tc-frecuente").checked=false;
    document.getElementById("tc-moneda").value="ARS";
    document.getElementById("tc-amount-prefix").textContent="$";
    document.getElementById("tc-preview").style.display="none";
    document.getElementById("tc-fecha").value=iso;
    document.getElementById("tc-mes-inicio").value=ym;
    document.getElementById("tc-mes-inicio-frec").value=ym;
    // Volver a vista de cuotas (no frecuente)
    document.getElementById("tc-cuotas-row").style.display="grid";
    document.getElementById("tc-frec-row").style.display="none";
    document.getElementById("tc-total-label").textContent="Monto total ($)";
    enfocarCampoDeArriba("tc-desc");
  }
}

