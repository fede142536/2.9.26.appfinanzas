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
  let opts=cuentas.map(c=>`<option ${c===actual?"selected":""}>${c}</option>`);
  // Si el valor actual no está en la lista (cuenta vieja de un import, por ejemplo), agregarla igual
  if(actual && !cuentas.includes(actual)){
    opts.unshift(`<option selected>${actual}</option>`);
  }
  sel.innerHTML=opts.join("");
}
// Pide el nombre de una cuenta nueva, la guarda y actualiza el select indicado
async function agregarCuentaRapida(selectId){
  const nombre=await mostrarPrompt("Nombre de la cuenta nueva:", {titulo:"Nueva cuenta", placeholder:"Ej: Mercado Pago, Ualá, Brubank", textoOk:"Agregar"});
  if(!nombre) return;
  const limpio=nombre.trim();
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
    return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;background:${esCustom?'var(--accent-light)':'var(--bg)'};color:${esCustom?'var(--accent)':'var(--muted)'};padding:4px 10px;border-radius:12px;margin:3px">💳 ${escapeHtml(c)}${esCustom?`<button onclick="borrarCuentaCustom(${attrJS(c)})" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:14px;padding:0;line-height:1">×</button>`:''}</span>`;
  }).join("");
  el.innerHTML=html+`<div style="margin-top:10px"><button class="btn-sm" onclick="agregarCuentaRapida('inp-cuenta')">+ Agregar cuenta</button></div>`;
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
  tcs.forEach(t=>{ if(t.tarjeta && !todas.includes(t.tarjeta)) todas.push(t.tarjeta); });
  tarjetasCustom.forEach(t=>{ if(!todas.includes(t)) todas.push(t); });
  return todas;
}
// Llena un <select> de tarjetas, preservando el valor actual si se pasa
function buildTarjetaSelect(selectId, valorActual){
  const sel=document.getElementById(selectId);
  if(!sel) return;
  const actual = valorActual!==undefined ? valorActual : sel.value;
  const tarjetas=getTarjetas();
  let opts=tarjetas.map(t=>`<option ${t===actual?"selected":""}>${t}</option>`);
  if(actual && !tarjetas.includes(actual)){
    opts.unshift(`<option selected>${actual}</option>`);
  }
  sel.innerHTML=opts.join("");
}
// Pide el nombre de una tarjeta nueva, la guarda y actualiza el select indicado
async function agregarTarjetaRapida(selectId){
  const nombre=await mostrarPrompt("Nombre de la tarjeta:", {titulo:"Nueva tarjeta", placeholder:"Ej: Visa Santander, Mastercard BBVA", textoOk:"Agregar"});
  if(!nombre) return;
  const limpio=nombre.trim();
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
  if(tcs.some(t=>t.tarjeta===nombre)){
    showToast("No se puede borrar: hay gastos cargados con esa tarjeta. Renombrala en su lugar.");
    return;
  }
  if(!await mostrarConfirm(`¿Eliminar "${nombre}" de la lista de tarjetas?`, {textoOk:"Eliminar", peligroso:true})) return;
  tarjetasCustom=tarjetasCustom.filter(t=>t!==nombre);
  saveTarjetasCustom();
  showToast("Tarjeta eliminada de la lista");
  renderTarjetasManager();
  buildTarjetaSelect("tc-tarjeta");
}
// Renombra una tarjeta en TODOS los gastos que ya la usan (propaga el cambio),
// y actualiza también la lista de tarjetas custom si corresponde.
async function renombrarTarjeta(nombreActual){
  const nuevo=await mostrarPrompt(`Nuevo nombre para "${nombreActual}":`, {titulo:"Renombrar tarjeta", valorInicial:nombreActual, textoOk:"Renombrar"});
  if(nuevo===null) return;
  const limpio=nuevo.trim();
  if(!limpio || limpio===nombreActual) return;
  if(getTarjetas().some(t=>t.toLowerCase()===limpio.toLowerCase() && t!==nombreActual)){
    showToast("Ya existe una tarjeta con ese nombre");
    return;
  }
  let cambios=0;
  tcs.forEach(t=>{ if(t.tarjeta===nombreActual){ t.tarjeta=limpio; cambios++; } });
  const idx=tarjetasCustom.indexOf(nombreActual);
  if(idx>=0) tarjetasCustom[idx]=limpio;
  else if(!TARJETAS_DEFAULT.includes(nombreActual)) tarjetasCustom.push(limpio);
  saveTarjetasCustom();
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
  const html=getTarjetas().map(t=>{
    const esCustom=tarjetasCustom.includes(t);
    const esDefault=TARJETAS_DEFAULT.includes(t);
    const tEsc=attrJS(t);
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:13px">💳 ${escapeHtml(t)}${esDefault?"":' <span class="badge badge-accent">custom</span>'}</span>
      <div style="display:flex;gap:10px">
        <button style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0" onclick="renombrarTarjeta(${tEsc})" title="Renombrar">✎</button>
        ${esCustom?`<button style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;padding:0" onclick="borrarTarjetaCustom(${tEsc})" title="Eliminar">×</button>`:""}
      </div>
    </div>`;
  }).join("");
  el.innerHTML=html+`<div style="margin-top:10px"><button class="btn-sm" onclick="agregarTarjetaRapida('tc-tarjeta')">+ Agregar tarjeta</button></div>`;
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
function closeCatModal(){document.getElementById("modal-cat").classList.remove("open");}
function guardarNuevaCat(){
  const t=document.getElementById("new-cat-tipo").value;
  const nombre=document.getElementById("new-cat-name").value.trim();
  const subsRaw=document.getElementById("new-cat-subs").value.trim();
  if(!nombre){showToast("Ingresá un nombre");return;}
  const subs=subsRaw?subsRaw.split(",").map(s=>s.trim()).filter(Boolean):["Otros"];
  if(!custom[t])custom[t]={};custom[t][nombre]=subs;
  if(iconoSeguro(nuevoCatIcono)){ iconsCustom[nombre]=iconoSeguro(nuevoCatIcono); saveIconsCustom(); }
  save();
  document.getElementById("new-cat-name").value="";document.getElementById("new-cat-subs").value="";
  nuevoCatIcono=null; document.getElementById("new-cat-icon-preview").textContent="📦";
  closeCatModal();showToast("Categoría agregada ✓");buildCats();buildTcCats();buildInvCats();renderCatManager();
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
          return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;background:var(--accent-light);color:var(--accent);padding:2px 8px;border-radius:10px;margin:2px">${escapeHtml(s)}<button onclick="borrarSubcat('${t}',${catEsc},${attrJS(s)})" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;padding:0;line-height:1">×</button></span>`;
        }
        return `<span style="display:inline-block;font-size:11px;background:var(--bg);color:var(--muted);padding:2px 8px;border-radius:10px;margin:2px">${escapeHtml(s)}</span>`;
      }).join("");
      const esPrimera=idx===0, esUltima=idx===nombresOrdenados.length-1;
      html+=`<div class="cat-row" style="flex-direction:column;align-items:stretch">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
          <div style="display:flex;align-items:center;gap:4px;flex:1;min-width:0">
            <div style="display:flex;flex-direction:column">
              <button class="btn-sm" style="padding:1px 6px;font-size:10px;line-height:1;${esPrimera?'opacity:.3;pointer-events:none':''}" onclick="moverCategoriaOrden('${t}',${catEsc},-1)" title="Subir">▲</button>
              <button class="btn-sm" style="padding:1px 6px;font-size:10px;line-height:1;${esUltima?'opacity:.3;pointer-events:none':''}" onclick="moverCategoriaOrden('${t}',${catEsc},1)" title="Bajar">▼</button>
            </div>
            <button type="button" onclick="openIconPicker({mode:'edit',cat:${catEsc}})" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;width:30px;height:30px;font-size:15px;cursor:pointer;flex-shrink:0" title="Cambiar ícono">${getIcon(cat)}</button>
            <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(cat)}${esDefault?'':' <span class="badge badge-accent">custom</span>'}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn-sm" onclick="agregarSubcat('${t}',${catEsc})">+ Sub</button>
            ${esDefault?'':`<button class="btn-sm" style="color:var(--danger)" onclick="borrarCat('${t}',${catEsc})">×</button>`}
          </div>
        </div>
        <div style="margin-top:6px">${subsHtml||'<span class="txt-xs txt-muted">Sin subcategorías</span>'}</div>
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
  const limpio=nombre.trim();
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
