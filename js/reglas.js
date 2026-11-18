// ═══════════════════════════════════════════
// REGLAS AUTOMÁTICAS DE CATEGORÍA
// ═══════════════════════════════════════════
// "Si la nota dice Netflix, es Suscripciones": una regla tuya manda sobre cualquier
// sugerencia (tu historial o la tabla de comercios conocidos), y se aplica sola al cargar,
// en la carga rápida y al importar un Excel. Opcionalmente también pone la cuenta.
// Cada regla: {id, texto, tipo:"Gasto"|"Ingreso", cat, subcat|null, cuenta|null}.
// Se guardan cifradas (freglas) y viajan en la copia de seguridad.

let reglasCat = [];
const REGLA_MIN_LARGO = 3;      // "ab" coincidiría con media lista de notas
const REGLA_MAX_LARGO = 60;
const REGLA_IDEA_MIN = 3;       // una nota repetida 3 veces con la misma categoría ya es un patrón

// Pura. Limpia lo que venga de localStorage o de una copia: descarta lo que no tiene forma de
// regla y deja una sola por texto y tipo (la última gana, igual que al editar).
function normalizarReglas(arr){
  const out=[], vistos=new Map();
  (Array.isArray(arr) ? arr : []).forEach(r=>{
    if(!r || typeof r!=="object") return;
    const texto=typeof r.texto==="string" ? r.texto.trim().slice(0,REGLA_MAX_LARGO) : "";
    if(normalizarTexto(texto).length<REGLA_MIN_LARGO) return;
    if(r.tipo!=="Gasto" && r.tipo!=="Ingreso") return;
    if(typeof r.cat!=="string" || !r.cat.trim()) return;
    const id=typeof r.id==="number" && isFinite(r.id) ? r.id : Date.now()+out.length;
    const regla={id, texto:nombreSeguro(texto), tipo:r.tipo, cat:nombreSeguro(r.cat.trim()),
      subcat: typeof r.subcat==="string" && r.subcat.trim() ? nombreSeguro(r.subcat.trim()) : null,
      cuenta: typeof r.cuenta==="string" && r.cuenta.trim() ? nombreSeguro(r.cuenta.trim()) : null};
    const k=r.tipo+"|"+normalizarTexto(texto);
    if(vistos.has(k)) out[vistos.get(k)]=regla; else { vistos.set(k, out.length); out.push(regla); }
  });
  return out;
}

// Pura. La regla que corresponde a una nota: la del texto MÁS LARGO que esté contenido en la
// nota ("mercado pago" gana sobre "mercado" si escribiste "Mercado Pago - recarga").
function reglaParaNota(texto, tipo, reglas){
  const n=normalizarTexto(texto);
  if(n.length<REGLA_MIN_LARGO) return null;
  let mejor=null, largo=0;
  (reglas||[]).forEach(r=>{
    if(r.tipo!==tipo) return;
    const t=normalizarTexto(r.texto);
    if(t.length>=REGLA_MIN_LARGO && n.includes(t) && t.length>largo){ mejor=r; largo=t.length; }
  });
  return mejor ? {cat:mejor.cat, subcat:mejor.subcat, cuenta:mejor.cuenta, fuente:"regla", regla:mejor.texto, reglaId:mejor.id, casos:0} : null;
}

// Un movimiento al que una regla NO debe tocar: los que son parte de otra cosa (ahorro, retiro,
// traspaso, pago de un resumen, ajuste de saldo, cambio de moneda…) tienen su categoría por algo.
function movimientoConLogicaPropia(m){
  return !m || !!(m.esAhorro || m.usaAhorro || m.traspaso || m.pagoTarjeta || m.origenInvId || m.devolucionDeId || m.cambioId || m.ajusteSaldo || m.recuperable>0);
}

// Pura. Los movimientos ya cargados que coinciden con la regla y tienen OTRA categoría (o subcategoría).
function movsQueCambiariaLaRegla(regla, lista){
  if(!regla) return [];
  // Solo los que ESTA regla ganaría: si otra con un texto más largo también coincide, esa manda.
  const todas=[regla].concat(reglasCat.filter(x=>x.id!==regla.id));
  return (lista||[]).filter(m=>m && m.tipo===regla.tipo && !movimientoConLogicaPropia(m) && m.nota
    && (reglaParaNota(m.nota, m.tipo, todas)||{}).reglaId===regla.id
    && (m.cat!==regla.cat || (regla.subcat && m.subcat!==regla.subcat)));
}

// Pura. Ideas de reglas: notas que se repiten con SIEMPRE la misma categoría y que ninguna regla cubre todavía.
function ideasDeReglas(lista, reglas){
  const grupos={};
  (lista||[]).forEach(m=>{
    if(!m || (m.tipo!=="Gasto" && m.tipo!=="Ingreso") || movimientoConLogicaPropia(m) || !m.nota || !m.cat) return;
    const n=normalizarTexto(m.nota);
    if(n.length<REGLA_MIN_LARGO || n.length>REGLA_MAX_LARGO) return;
    const k=m.tipo+"|"+n;
    const g=grupos[k]||(grupos[k]={tipo:m.tipo, texto:m.nota.trim(), n:0, cats:{}});
    g.n++; const ck=m.cat+"||"+(m.subcat||""); g.cats[ck]=(g.cats[ck]||0)+1;
  });
  return Object.values(grupos)
    .filter(g=>g.n>=REGLA_IDEA_MIN && Object.keys(g.cats).length===1 && !reglaParaNota(g.texto, g.tipo, reglas))
    .map(g=>{ const [cat,subcat]=Object.keys(g.cats)[0].split("||"); return {tipo:g.tipo, texto:g.texto, cat, subcat:subcat||null, veces:g.n}; })
    .sort((a,b)=>b.veces-a.veces)
    .slice(0,3);
}

// Pura. Aplica las reglas a una lista de movimientos importados que vienen SIN categoría ("Otros").
// Devuelve cuántos tocó. La cuenta solo se completa si el archivo no traía ninguna.
function aplicarReglasAImportados(items, reglas){
  let n=0;
  (items||[]).forEach(m=>{
    if(!m || (m.cat && m.cat!=="Otros")) return;
    const r=reglaParaNota(m.nota, m.tipo, reglas);
    if(!r) return;
    m.cat=r.cat; m.subcat=r.subcat||m.subcat||"Otros";
    if(r.cuenta && !m.cuenta) m.cuenta=r.cuenta;
    n++;
  });
  return n;
}

// Lleva a Configuración, abre la sección de categorías y muestra las reglas (manual y novedades).
function irAReglas(){
  showPage("config", document.querySelector('.nav-btn[onclick*="\'config\'"]'));
  if(typeof abrirSeccionConfig==="function") abrirSeccionConfig("cfg-sec-organizar");
  setTimeout(()=>{ const c=document.getElementById("reglas-card"); if(c) c.scrollIntoView({behavior:"smooth", block:"start"}); }, 250);
}

function guardarReglas(){
  reglasCat=normalizarReglas(reglasCat);
  setSensitiveRaw("freglas", JSON.stringify(reglasCat));
  if(typeof marcarDatosSucios==="function") marcarDatosSucios();
}

// ── Pantalla: Configuración › Cuentas, tarjetas y categorías › Reglas automáticas ──
function textoRegla(r){
  return `${getIcon(r.cat,"🏷")} ${escapeHtml(r.cat)}${r.subcat?" / "+escapeHtml(r.subcat):""}${r.cuenta?` · <span class="txt-muted">cuenta ${escapeHtml(r.cuenta)}</span>`:""}`;
}
function renderReglasManager(){
  const el=document.getElementById("reglas-manager");
  if(!el) return;
  const filas=reglasCat.length ? reglasCat.map(r=>`<div class="regla-fila">
      <div class="regla-txt"><div class="regla-si">${r.tipo==="Ingreso"?"⬇️":"⬆️"} Si la nota dice <strong>«${escapeHtml(r.texto)}»</strong></div><div class="regla-entonces">→ ${textoRegla(r)}</div></div>
      <div class="u-row-6"><button type="button" class="btn-sm" aria-label="Editar la regla ${escapeHtml(r.texto)}" onclick="abrirModalRegla(${Number(r.id)})">Editar</button>
      <button type="button" class="btn-sm" aria-label="Borrar la regla ${escapeHtml(r.texto)}" onclick="borrarRegla(${Number(r.id)})">✕</button></div>
    </div>`).join("") : `<p class="txt-sm txt-muted" style="padding:4px 0 8px">Todavía no tenés reglas.</p>`;
  const ideas=ideasDeReglas(movs, reglasCat);
  const ideasHTML=ideas.length ? `<div class="regla-ideas"><div class="regla-ideas-tit">💡 Ideas según lo que ya cargaste</div>${ideas.map((x,i)=>`<div class="regla-idea">
      <span>«${escapeHtml(x.texto)}» → ${escapeHtml(x.cat)}${x.subcat?" / "+escapeHtml(x.subcat):""} <span class="txt-muted">· ${x.veces} veces</span></span>
      <button type="button" class="btn-sm" onclick="crearReglaDeIdea(${i})">Crear</button></div>`).join("")}</div>` : "";
  el._ideas=ideas;
  el.innerHTML=filas+ideasHTML;
}
function crearReglaDeIdea(i){
  const el=document.getElementById("reglas-manager");
  const x=el && el._ideas ? el._ideas[i] : null;
  if(x) abrirModalRegla(null, x);
}

let editandoReglaId=null;
// `id`: la regla a editar. `pre`: datos para precargar una nueva ({texto, tipo, cat, subcat, cuenta}).
function abrirModalRegla(id, pre){
  const r=id ? reglasCat.find(x=>x.id===id) : null;
  editandoReglaId=r ? r.id : null;
  const d=r || pre || {};
  document.getElementById("regla-modal-title").textContent=r ? "Editar regla" : "Nueva regla";
  document.getElementById("regla-texto").value=d.texto||"";
  setTipoRegla(d.tipo==="Ingreso" ? "Ingreso" : "Gasto", d.cat, d.subcat);
  const selC=document.getElementById("regla-cuenta");
  selC.innerHTML=`<option value="">No cambiar la cuenta</option>`+getCuentas().map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  selC.value=d.cuenta && getCuentas().includes(d.cuenta) ? d.cuenta : "";
  document.getElementById("regla-aplicar-viejos").checked=false;
  document.getElementById("modal-regla").classList.add("open");
  previsualizarRegla();
}
function cerrarModalRegla(){ document.getElementById("modal-regla").classList.remove("open"); editandoReglaId=null; }
function setTipoRegla(tp, cat, subcat){
  document.querySelectorAll("#regla-tipo button").forEach(b=>{ const on=b.dataset.tipo===tp; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
  document.getElementById("regla-tipo").dataset.tipo=tp;
  const cats=getCats(tp);
  const sel=document.getElementById("regla-cat");
  sel.innerHTML=Object.keys(cats).map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(getIcon(c,""))} ${escapeHtml(c)}</option>`).join("");
  if(cat && cats[cat]) sel.value=cat;
  actualizarSubcatsRegla(subcat);
  previsualizarRegla();
}
function actualizarSubcatsRegla(subcat){
  const tp=document.getElementById("regla-tipo").dataset.tipo||"Gasto";
  const subs=getCats(tp)[document.getElementById("regla-cat").value]||[];
  const sel=document.getElementById("regla-subcat");
  sel.innerHTML=`<option value="">(la que tenga)</option>`+subs.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  sel.value=subcat && subs.includes(subcat) ? subcat : (subs[0]||"");
}
function reglaDelFormulario(){
  return {id:editandoReglaId||Date.now(), texto:document.getElementById("regla-texto").value.trim(),
    tipo:document.getElementById("regla-tipo").dataset.tipo||"Gasto", cat:document.getElementById("regla-cat").value,
    subcat:document.getElementById("regla-subcat").value||null, cuenta:document.getElementById("regla-cuenta").value||null};
}
function previsualizarRegla(){
  const box=document.getElementById("regla-viejos"), info=document.getElementById("regla-viejos-txt");
  if(!box || !info) return;
  const r=reglaDelFormulario();
  const n=normalizarTexto(r.texto).length>=REGLA_MIN_LARGO && r.cat ? movsQueCambiariaLaRegla(r, movs).length : 0;
  box.style.display=n ? "" : "none";
  info.textContent=`Corregir también ${n} ${n===1?"movimiento que ya cargaste":"movimientos que ya cargaste"} con otra categoría`;
}
function guardarRegla(){
  const r=reglaDelFormulario();
  if(normalizarTexto(r.texto).length<REGLA_MIN_LARGO){ showToast("Escribí al menos 3 letras de la nota"); return; }
  if(!r.cat){ showToast("Elegí una categoría"); return; }
  const antes=reglasCat.map(x=>({...x}));
  // Si ya había una regla con el mismo texto y tipo, esta la reemplaza.
  const k=r.tipo+"|"+normalizarTexto(r.texto);
  reglasCat=reglasCat.filter(x=>x.id!==r.id && x.tipo+"|"+normalizarTexto(x.texto)!==k).concat([r]);
  const cambios=[];
  if(document.getElementById("regla-aplicar-viejos").checked){
    movsQueCambiariaLaRegla(r, movs).forEach(m=>{
      cambios.push({m, cat:m.cat, subcat:m.subcat});
      m.cat=r.cat; if(r.subcat) m.subcat=r.subcat;
    });
  }
  guardarReglas();
  if(cambios.length) save();
  cerrarModalRegla();
  renderReglasManager();
  if(cambios.length && typeof refrescarVistas==="function") refrescarVistas();
  ofrecerDeshacerCambio(cambios.length ? `Regla guardada · ${cambios.length} ${cambios.length===1?"movimiento cambiado":"movimientos cambiados"} ✓` : "Regla guardada ✓", ()=>{
    reglasCat=antes; guardarReglas();
    cambios.forEach(c=>{ c.m.cat=c.cat; c.m.subcat=c.subcat; });
    renderReglasManager();
  });
}
function borrarRegla(id){
  const r=reglasCat.find(x=>x.id===id);
  if(!r) return;
  const antes=reglasCat.map(x=>({...x}));
  reglasCat=reglasCat.filter(x=>x.id!==id);
  guardarReglas();
  renderReglasManager();
  ofrecerDeshacerCambio(`Regla «${r.texto}» borrada`, ()=>{ reglasCat=antes; guardarReglas(); renderReglasManager(); });
}
