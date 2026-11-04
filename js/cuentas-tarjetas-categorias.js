// ═══════════════════════════════════════════
// CUENTAS (default + agregadas por el usuario)
// ═══════════════════════════════════════════
const CUENTAS_DEFAULT=["Cuentas","Efectivo","Tarjetas de crédito","Balanz","Cuenta DNI","Galicia","Naranja X","BPat","MODO"];
let cuentasCustom = [];
function saveCuentasCustom(){ setSensitiveRaw("fcuentas", JSON.stringify(cuentasCustom)); marcarDatosSucios(); }
// Devuelve la lista completa de cuentas: default + las agregadas por el usuario (sin duplicar)
function getCuentas(){
  const todas=[...CUENTAS_DEFAULT];
  cuentasCustom.forEach(c=>{ if(!todas.includes(c)) todas.push(c); });
  return todas;
}
// Llena un <select> de cuentas, preservando el valor actual si se pasa
function buildCuentaSelect(selectId, valorActual){
  const sel=document.getElementById(selectId);
  if(!sel) return;
  const actual = valorActual!==undefined ? valorActual : sel.value;
  const cuentas=getCuentas();
  let opts=cuentas.map(c=>`<option ${c===actual?"selected":""}>${escapeHtml(c)}</option>`);
  // Si el valor actual no está en la lista (cuenta vieja de un import, por ejemplo), agregarla igual
  if(actual && !cuentas.includes(actual)){
    opts.unshift(`<option selected>${escapeHtml(actual)}</option>`);
  }
  sel.innerHTML=opts.join("");
}
// Pide el nombre de una cuenta nueva, la guarda y actualiza el select indicado
async function agregarCuentaRapida(selectId){
  const nombre=await mostrarPrompt("Nombre de la cuenta nueva:", {titulo:"Nueva cuenta", placeholder:"Ej: Mercado Pago, Ualá, Brubank", textoOk:"Agregar"});
  if(!nombre) return;
  const limpio=nombreSeguro(nombre.trim());
  if(!limpio) return;
  if(getCuentas().some(c=>c.toLowerCase()===limpio.toLowerCase())){
    showToast("Esa cuenta ya existe");
    buildCuentaSelect(selectId, limpio);
    return;
  }
  cuentasCustom.push(limpio);
  saveCuentasCustom();
  showToast(`Cuenta "${limpio}" agregada ✓`);
  buildCuentaSelect(selectId, limpio);
}
// Elimina una cuenta custom (no se puede borrar una cuenta default)
async function borrarCuentaCustom(nombre){
  if(!cuentasCustom.includes(nombre)) return;
  if(!await mostrarConfirm(`¿Eliminar la cuenta "${nombre}" de la lista? (los movimientos que ya la tienen asignada no se modifican)`, {textoOk:"Eliminar", peligroso:true})) return;
  cuentasCustom=cuentasCustom.filter(c=>c!==nombre);
  saveCuentasCustom();
  showToast("Cuenta eliminada de la lista");
  renderCuentasManager();
  buildCuentaSelect("inp-cuenta");
  buildCuentaSelect("inv-cuenta");
  buildCuentaSelect("tc-cuenta");
}
// Renderiza el listado de cuentas en Config (para poder agregarlas/borrarlas ahí también)
function renderCuentasManager(){
  const el=document.getElementById("cuentas-manager");
  if(!el) return;
  const html=getCuentas().map(c=>{
    const esCustom=cuentasCustom.includes(c);
    return `<span class="cfg-chip${esCustom?' cfg-chip-propio':''}"><span class="cfg-chip-txt">💳 ${escapeHtml(c)}</span>${esCustom?`<button type="button" class="cfg-chip-x" aria-label="Quitar la cuenta ${escapeHtml(c)}" onclick="borrarCuentaCustom(${attrJS(c)})">×</button>`:''}</span>`;
  }).join("");
  el.innerHTML=`<div class="cfg-chips">${html}</div><div class="cfg-acciones"><button class="btn-sm" onclick="agregarCuentaRapida('inp-cuenta')">+ Agregar cuenta</button></div>`;
}

// ═══════════════════════════════════════════
// NOMBRES DE TARJETAS (default + agregadas por el usuario + renombrado con propagación)
// ═══════════════════════════════════════════
const TARJETAS_DEFAULT=["Visa","Mastercard","Amex","Cabal","Naranja","Otra"];
let tarjetasCustom = [];
function saveTarjetasCustom(){ setSensitiveRaw("ftarjetas", JSON.stringify(tarjetasCustom)); marcarDatosSucios(); }
// Devuelve todos los nombres de tarjeta: default + agregados por el usuario + cualquiera que
// ya esté en uso en gastos cargados (por si vino de un import viejo con un nombre no listado)
function getTarjetas(){
  const todas=[...TARJETAS_DEFAULT];
  tcs.forEach(t=>{
    if(t.tarjeta && !todas.includes(t.tarjeta)) todas.push(t.tarjeta);
    (t.tarjetas||[]).forEach(c=>{ if(c.tarjeta && !todas.includes(c.tarjeta)) todas.push(c.tarjeta); });
  });
  tarjetasCustom.forEach(t=>{ if(!todas.includes(t)) todas.push(t); });
  return todas;
}
// ── Banco de cada tarjeta ──
// Cada tarjeta puede asociarse a una cuenta (su banco o billetera): {"Visa":"BPat","Mastercard":"Galicia"}. Sirve para que
// las compras con tarjeta digan de qué banco son sin tener que cargarlo en cada una. Es una preferencia: localStorage llano.
const BANCOS_TC_KEY="fbancotc";
function normalizarBancosTc(o){
  const out={};
  if(o && typeof o==="object" && !Array.isArray(o)) Object.entries(o).forEach(([t,b])=>{ if(typeof b==="string" && b.trim() && t) out[t]=b.trim(); });
  return out;
}
function leerBancosTc(){
  try{ return normalizarBancosTc(JSON.parse(localStorage.getItem(BANCOS_TC_KEY)||"{}")); }catch(e){ return {}; }
}
function guardarBancosTc(mapa){ return guardarPreferencia(BANCOS_TC_KEY, JSON.stringify(normalizarBancosTc(mapa))); }
// Copia del mapa con el banco de UNA tarjeta cambiado (vacío lo quita). Pura.
function conBancoDeTarjeta(mapa, tarjeta, banco){
  const nuevo=normalizarBancosTc(mapa), b=String(banco||"").trim();
  if(b) nuevo[tarjeta]=b; else delete nuevo[tarjeta];
  return nuevo;
}
const bancoDeTarjeta=(tarjeta, mapa)=>(mapa||leerBancosTc())[tarjeta]||"";
// "Visa · BPat" (con el banco en gris) o solo "Visa".
function tarjetaConBancoHTML(tarjeta, mapa){
  const b=bancoDeTarjeta(tarjeta, mapa);
  return escapeHtml(tarjeta||"Sin tarjeta")+(b?` <span class="tc-banco">· ${escapeHtml(b)}</span>`:"");
}
function setBancoTarjeta(tarjeta, banco){
  guardarBancosTc(conBancoDeTarjeta(leerBancosTc(), tarjeta, banco));
  showToast(banco ? `${tarjeta}: banco ${banco} ✓` : `${tarjeta}: sin banco`);
  if(typeof renderTarjetas==="function") renderTarjetas();
  if(typeof renderMovs==="function" && document.getElementById("tx-list")) renderMovs();
}

// Llena un <select> de tarjetas, preservando el valor actual si se pasa
function buildTarjetaSelect(selectId, valorActual){
  const sel=document.getElementById(selectId);
  if(!sel) return;
  const actual = valorActual!==undefined ? valorActual : sel.value;
  const tarjetas=getTarjetas();
  let opts=tarjetas.map(t=>`<option ${t===actual?"selected":""}>${escapeHtml(t)}</option>`);
  if(actual && !tarjetas.includes(actual)){
    opts.unshift(`<option selected>${escapeHtml(actual)}</option>`);
  }
  sel.innerHTML=opts.join("");
}
// Pide el nombre de una tarjeta nueva, la guarda y actualiza el select indicado
async function agregarTarjetaRapida(selectId){
  const nombre=await mostrarPrompt("Nombre de la tarjeta:", {titulo:"Nueva tarjeta", placeholder:"Ej: Visa Santander, Mastercard BBVA", textoOk:"Agregar"});
  if(!nombre) return;
  const limpio=nombreSeguro(nombre.trim());
  if(!limpio) return;
  if(getTarjetas().some(t=>t.toLowerCase()===limpio.toLowerCase())){
    showToast("Esa tarjeta ya existe");
    buildTarjetaSelect(selectId, limpio);
    return;
  }
  tarjetasCustom.push(limpio);
  saveTarjetasCustom();
  showToast(`Tarjeta "${limpio}" agregada ✓`);
  buildTarjetaSelect(selectId, limpio);
}
// Elimina una tarjeta custom de la lista (no se puede borrar si hay gastos usándola)
async function borrarTarjetaCustom(nombre){
  if(!tarjetasCustom.includes(nombre)) return;
  if(tcs.some(t=>t.tarjeta===nombre || (t.tarjetas||[]).some(c=>c.tarjeta===nombre))){
    showToast("No se puede borrar: hay gastos cargados con esa tarjeta. Renombrala en su lugar.");
    return;
  }
  if(!await mostrarConfirm(`¿Eliminar "${nombre}" de la lista de tarjetas?`, {textoOk:"Eliminar", peligroso:true})) return;
  tarjetasCustom=tarjetasCustom.filter(t=>t!==nombre);
  saveTarjetasCustom();
  guardarBancosTc(conBancoDeTarjeta(leerBancosTc(), nombre, ""));
  showToast("Tarjeta eliminada de la lista");
  renderTarjetasManager();
  buildTarjetaSelect("tc-tarjeta");
}
// Renombra una tarjeta en TODOS los gastos que ya la usan (propaga el cambio),
// y actualiza también la lista de tarjetas custom si corresponde.
async function renombrarTarjeta(nombreActual){
  const nuevo=await mostrarPrompt(`Nuevo nombre para "${nombreActual}":`, {titulo:"Renombrar tarjeta", valorInicial:nombreActual, textoOk:"Renombrar"});
  if(nuevo===null) return;
  const limpio=nombreSeguro(nuevo.trim());
  if(!limpio || limpio===nombreActual) return;
  if(getTarjetas().some(t=>t.toLowerCase()===limpio.toLowerCase() && t!==nombreActual)){
    showToast("Ya existe una tarjeta con ese nombre");
    return;
  }
  let cambios=0;
  tcs.forEach(t=>{
    if(t.tarjeta===nombreActual){ t.tarjeta=limpio; cambios++; }
    (t.tarjetas||[]).forEach(c=>{ if(c.tarjeta===nombreActual){ c.tarjeta=limpio; cambios++; } });
  });
  const idx=tarjetasCustom.indexOf(nombreActual);
  if(idx>=0) tarjetasCustom[idx]=limpio;
  else if(!TARJETAS_DEFAULT.includes(nombreActual)) tarjetasCustom.push(limpio);
  saveTarjetasCustom();
  // El día de vencimiento acompaña a la tarjeta: si no se mueve, el aviso se pierde en silencio.
  const venc=leerVencTc();
  if(venc[nombreActual]!==undefined){ venc[limpio]=venc[nombreActual]; delete venc[nombreActual]; guardarVencTc(venc); }
  const bancos=leerBancosTc();   // y el banco también
  if(bancos[nombreActual]){ guardarBancosTc(conBancoDeTarjeta(conBancoDeTarjeta(bancos, limpio, bancos[nombreActual]), nombreActual, "")); }
  if(cambios>0) save();
  showToast(`Renombrada${cambios>0?` · ${cambios} gasto(s) actualizado(s)`:""} ✓`);
  renderTarjetasManager();
  renderTarjetas();
  buildTarjetaSelect("tc-tarjeta");
}
// Renderiza el listado de tarjetas en Config (para agregarlas/renombrarlas/borrarlas)
function renderTarjetasManager(){
  const el=document.getElementById("tarjetas-manager");
  if(!el) return;
  const bancos=leerBancosTc();
  const cuentas=getCuentas().filter(c=>c!=="Cuentas");
  const html=getTarjetas().map(t=>{
    const esCustom=tarjetasCustom.includes(t);
    const esDefault=TARJETAS_DEFAULT.includes(t);
    const tEsc=attrJS(t);
    const actual=bancos[t]||"";
    const opciones=[`<option value="">Sin banco</option>`, ...(actual && !cuentas.includes(actual)?[actual]:[]).concat(cuentas).map(c=>`<option value="${escapeHtml(c)}"${c===actual?" selected":""}>${escapeHtml(c)}</option>`)].join("");
    return `<div class="cfg-tc-fila">
      <div class="cfg-tc-top">
        <span class="cfg-tc-nombre">💳 ${escapeHtml(t)}${esDefault?"":' <span class="badge badge-accent">propia</span>'}</span>
        <div class="cfg-tc-acc">
          <button type="button" class="cfg-ico-btn cfg-ico-plano" aria-label="Renombrar la tarjeta ${escapeHtml(t)}" title="Renombrar" onclick="renombrarTarjeta(${tEsc})">✎</button>
          ${esCustom?`<button type="button" class="cfg-ico-btn cfg-ico-plano cfg-ico-peligro" aria-label="Eliminar la tarjeta ${escapeHtml(t)}" title="Eliminar" onclick="borrarTarjetaCustom(${tEsc})">×</button>`:""}
        </div>
      </div>
      <label class="tc-banco-fila"><span>Banco</span><select class="form-select" aria-label="Banco de ${escapeHtml(t)}" onchange="setBancoTarjeta(${tEsc}, this.value)">${opciones}</select></label>
    </div>`;
  }).join("");
  el.innerHTML=html+`<div class="cfg-acciones"><button class="btn-sm" onclick="agregarTarjetaRapida('tc-tarjeta')">+ Agregar tarjeta</button></div>`;
}

// ═══════════════════════════════════════════
// CATEGORÍAS
// ═══════════════════════════════════════════
function openCatModal(){
  nuevoCatIcono=null;
  const prev=document.getElementById("new-cat-icon-preview");
  if(prev) prev.textContent="📦";
  document.getElementById("modal-cat").classList.add("open");
}
function closeCatModal(){
  document.getElementById("modal-cat").classList.remove("open");
  // Cancelar (tocar afuera) también tiene que soltar la bandera: si no, la próxima vez que se
  // abra "+ Cat." desde el ALTA (sin pasar por Editar) esta función igual intentaría refrescar
  // el select de edición.
  catModalDesdeEdit=false;
}
function guardarNuevaCat(){
  const t=document.getElementById("new-cat-tipo").value;
  const nombre=nombreSeguro(document.getElementById("new-cat-name").value.trim());
  const subsRaw=document.getElementById("new-cat-subs").value.trim();
  if(!nombre){showToast("Ingresá un nombre");return;}
  const subs=subsRaw?subsRaw.split(",").map(s=>nombreSeguro(s.trim())).filter(Boolean):["Otros"];
  if(!custom[t])custom[t]={};custom[t][nombre]=subs;
  if(iconoSeguro(nuevoCatIcono)){ iconsCustom[nombre]=iconoSeguro(nuevoCatIcono); saveIconsCustom(); }
  save();
  document.getElementById("new-cat-name").value="";document.getElementById("new-cat-subs").value="";
  nuevoCatIcono=null; document.getElementById("new-cat-icon-preview").textContent="📦";
  // Se guarda ANTES de closeCatModal(): esa función también apaga la bandera (para el caso de
  // cancelar tocando afuera), así que leerla después de cerrarla siempre daría false.
  const veniaDeEdit=catModalDesdeEdit;
  closeCatModal();showToast("Categoría agregada ✓");buildCats();buildTcCats();buildInvCats();renderCatManager();
  // El "+ Cat." del modal de edición usa este mismo modal (no hay uno aparte), pero
  // buildCats() de arriba solo refresca el select del alta (#inp-cat). Sin esto, la categoría
  // recién creada quedaba invisible en el modal de edición hasta cerrarlo y volver a abrirlo.
  if(veniaDeEdit){
    const em=editingId!=null && movs.find(x=>x.id===editingId);
    if(em && (em.tipo==="Gasto"||em.tipo==="Ingreso") && document.getElementById("edit-cat")){
      const catActual=document.getElementById("edit-cat").value||em.cat;
      const subActual=document.getElementById("edit-subcat").value||em.subcat;
      populateEditCatSelect(em.tipo, catActual, subActual);
    }
  }
}
function renderCatManager(){
  const el=document.getElementById("cat-manager");let html="";
  ["Gasto","Ingreso","Inversion","Tarjeta"].forEach(t=>{
    const cats=getCats(t);
    if(!Object.keys(cats).length) return;
    html+=`<p class="seccion-label txt-medium mt-14 mb-6">${t}</p>`;
    const nombresOrdenados=ordenarCats(t, cats);
    nombresOrdenados.forEach((cat,idx)=>{
      const subs=cats[cat];
      const esDefault=DEFAULT_CATS[t]&&DEFAULT_CATS[t][cat];
      const catEsc=attrJS(cat);
      const subsDefault=esDefault?DEFAULT_CATS[t][cat]:[];
      const subsCustom=(custom[t]&&custom[t][cat])||[];
      // Render subs como chips, marcando cuáles son del usuario (se pueden borrar)
      const subsHtml=subs.map(s=>{
        const esSubCustom=subsCustom.includes(s)&&!subsDefault.includes(s);
        if(esSubCustom){
          return `<span class="cfg-chip cfg-chip-sub cfg-chip-propio"><span class="cfg-chip-txt">${escapeHtml(s)}</span><button type="button" class="cfg-chip-x" aria-label="Quitar la subcategoría ${escapeHtml(s)} de ${escapeHtml(cat)}" onclick="borrarSubcat('${t}',${catEsc},${attrJS(s)})">×</button></span>`;
        }
        return `<span class="cfg-chip cfg-chip-sub"><span class="cfg-chip-txt">${escapeHtml(s)}</span></span>`;
      }).join("");
      const esPrimera=idx===0, esUltima=idx===nombresOrdenados.length-1;
      const flecha=(dir)=>`<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="${dir<0?'M2 8l4-4 4 4':'M2 4l4 4 4-4'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      html+=`<div class="cat-row cfg-cat">
        <div class="cfg-cat-head">
          <button type="button" class="cfg-cat-ico" onclick="openIconPicker({mode:'edit',cat:${catEsc}})" title="Cambiar ícono" aria-label="Cambiar el ícono de ${escapeHtml(cat)}">${getIcon(cat)}</button>
          <div class="cfg-cat-nombre">${escapeHtml(cat)}${esDefault?'':' <span class="badge badge-accent">propia</span>'}</div>
          <div class="cfg-cat-orden">
            <button type="button" class="cfg-ico-btn"${esPrimera?' disabled':''} onclick="moverCategoriaOrden('${t}',${catEsc},-1)" title="Subir" aria-label="Subir ${escapeHtml(cat)}">${flecha(-1)}</button>
            <button type="button" class="cfg-ico-btn"${esUltima?' disabled':''} onclick="moverCategoriaOrden('${t}',${catEsc},1)" title="Bajar" aria-label="Bajar ${escapeHtml(cat)}">${flecha(1)}</button>
          </div>
        </div>
        <div class="cfg-chips cfg-chips-sub">${subsHtml||'<span class="txt-xs txt-muted cfg-sin-sub">Sin subcategorías</span>'}<button type="button" class="cfg-chip cfg-chip-btn" onclick="agregarSubcat('${t}',${catEsc})" aria-label="Agregar una subcategoría a ${escapeHtml(cat)}">+ Sub</button>${esDefault?'':`<button type="button" class="cfg-chip cfg-chip-btn cfg-chip-peligro" onclick="borrarCat('${t}',${catEsc})" aria-label="Eliminar la categoría ${escapeHtml(cat)}">Eliminar categoría</button>`}</div>
      </div>`;
    });
  });
  if(!html)html=`<p style="font-size:13px;color:var(--muted);padding:8px 0">Sin categorías</p>`;
  el.innerHTML=html;
}

// Pide al usuario una nueva subcategoría y la agrega a la categoría indicada
async function agregarSubcat(tipo, cat){
  const nombre=await mostrarPrompt(`Nueva subcategoría para "${cat}":`, {titulo:"Nueva subcategoría", textoOk:"Agregar"});
  if(!nombre) return;
  const limpio=nombreSeguro(nombre.trim());
  if(!limpio) return;
  // Verificar duplicado
  const actuales=getCats(tipo)[cat]||[];
  if(actuales.includes(limpio)){
    showToast("Esa subcategoría ya existe");
    return;
  }
  // Agregar al custom store
  if(!custom[tipo]) custom[tipo]={};
  if(!custom[tipo][cat]) custom[tipo][cat]=[];
  custom[tipo][cat].push(limpio);
  save();
  buildCats();buildTcCats();buildInvCats();
  renderCatManager();
  showToast("Subcategoría agregada ✓");
}

// Borra una subcategoría custom (solo las que agregó el usuario, no las default)
async function borrarSubcat(tipo, cat, sub){
  if(!custom[tipo]||!custom[tipo][cat]) return;
  if(!await mostrarConfirm(`¿Eliminar subcategoría "${sub}" de "${cat}"?`, {textoOk:"Eliminar", peligroso:true})) return;
  custom[tipo][cat]=custom[tipo][cat].filter(s=>s!==sub);
  // Si la cat custom queda vacía y NO es default, conservar (puede ser cat nueva sin subs)
  // Si la cat es default y custom queda vacío, eliminar la entry
  if(custom[tipo][cat].length===0 && DEFAULT_CATS[tipo] && DEFAULT_CATS[tipo][cat]){
    delete custom[tipo][cat];
  }
  save();
  buildCats();buildTcCats();buildInvCats();
  renderCatManager();
  showToast("Subcategoría eliminada");
}

function borrarCat(t,cat){if(custom[t])delete custom[t][cat];save();buildCats();buildTcCats();buildInvCats();renderCatManager();showToast("Categoría eliminada");}

// Evalúa una expresión simple de suma/resta para el campo importe
// Acepta: 1500, 1500.50, 1500+750+300, 1500-200, etc. Solo dígitos, +, -, ., ,
