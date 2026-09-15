// ═══════════════════════════════════════════
// MOVIMIENTOS
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// MENÚ LATERAL (reemplaza el tab bar inferior)
// ═══════════════════════════════════════════
function openSideMenu(){
  document.getElementById("side-menu").classList.add("open");
  document.getElementById("side-menu-overlay").classList.add("open");
}
function closeSideMenu(){
  document.getElementById("side-menu").classList.remove("open");
  document.getElementById("side-menu-overlay").classList.remove("open");
}
function toggleSideMenu(){
  const abierto=document.getElementById("side-menu").classList.contains("open");
  if(abierto) closeSideMenu(); else openSideMenu();
}

// Todas las pestañas viven en el MISMO documento (son divs que se muestran y ocultan con la
// clase .active), así que comparten UN solo scroll. Si no se toca, al cambiar de pestaña te
// quedás con el scroll de la anterior: entrabas a "Cargar" a mitad del formulario y el campo
// Importe quedaba arriba del borde de la pantalla.
// Acá se guarda a mano dónde dejaste cada pestaña para reponerlo al volver.
const scrollPorPagina={};
// "cargar" es un formulario, no una lista: siempre se abre arriba de todo, con el Importe a
// la vista. No tiene sentido devolverte al medio del formulario que ya guardaste.
const PAGINAS_SIEMPRE_ARRIBA=["cargar"];

function showPage(id,btn){
  // Anotar dónde queda la pestaña que estás dejando, antes de ocultarla.
  const saliendo=document.querySelector(".page.active");
  if(saliendo) scrollPorPagina[saliendo.id.replace(/^page-/,"")]=window.scrollY;
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  document.getElementById("page-"+id).classList.add("active");
  if(btn) btn.classList.add("active");
  // El FAB abre directo a Cargar — no tiene sentido mostrarlo ESTANDO ya en Cargar.
  // Se chequea que exista antes de tocarlo: si faltara, un TypeError acá cortaría toda la
  // función y la pantalla quedaría a medio renderizar.
  const fabEl=document.getElementById('fab-cargar');
  if(fabEl) fabEl.style.display = (id === 'cargar') ? 'none' : 'flex';
  // Solo se re-renderiza si los datos cambiaron desde la última vez que se pintó ESTA
  // pestaña. Si no, alcanza con las clases CSS de arriba (mostrar/ocultar) sin recalcular
  // ni reinyectar HTML — eso es lo caro, no el cambio de pestaña en sí.
  const yaAlDia = paginaVersionRenderizada[id]===datosVersion;
  if(id==="mov"){
    document.getElementById("mes-label").textContent=mesLbl(mesActual); // barato, siempre
    if(!yaAlDia) renderMovs();
  }
  if(id==="dash" && !yaAlDia) renderDash();
  if(id==="tc" && !yaAlDia) renderTarjetas();
  if(id==="inv" && !yaAlDia) renderInv();
  if(id==="ahorro" && !yaAlDia) renderAhorro();
  if(id==="import") renderImportHistory(); // liviano, y depende de importHistory (no cubierto por datosVersion)
  if(id==="config"){renderExportStats();renderCatManager();renderPresupManager();renderPinStatus();mostrarVersionApp();renderCuentasManager();renderTarjetasManager();} // liviano
  if(["mov","dash","tc","inv","ahorro"].includes(id)) paginaVersionRenderizada[id]=datosVersion;
  // Reponer el scroll AL FINAL, no antes: los render de arriba cambian el alto de la página y
  // si se hace primero el navegador recorta la posición al alto viejo (más corto) y quedás
  // más arriba de donde estabas.
  window.scrollTo(0, PAGINAS_SIEMPRE_ARRIBA.includes(id) ? 0 : (scrollPorPagina[id]||0));
}
// El menú lateral ya no tiene botón para "Cargar" (ver punto 1) — showPage() ahora
// acepta btn=null (ver el chequeo agregado ahí) para este caso.
function abrirCarga(){
  showPage('cargar', null);
  closeSideMenu();
}

function cambiarMes(d){
  if(filtroFecha) limpiarFiltroFecha(); // navegar mes desactiva el filtro custom
  mesActual = addMonths(mesActual, d);
  document.getElementById("mes-label").textContent = mesLbl(mesActual);
  renderMovs();
}

// ═══════════════════════════════════════════
// FILTRO POR FECHA (día específico / rango / mes / año)
// ═══════════════════════════════════════════
// null = comportamiento normal (usa mesActual). Si está seteado, reemplaza la selección de mes.
let filtroFecha = null;
let filtroFechaTab = "dia";

function openFiltroFechaModal(){
  // Poblar selector de año con años que tengan datos (o al menos el actual ± unos)
  const anioSel=document.getElementById("ff-anio");
  const anioActual=parseInt(currentYM().slice(0,4));
  const aniosConDatos=new Set(movs.map(m=>parseInt(String(m.fecha||"").slice(0,4))).filter(a=>!isNaN(a)));
  aniosConDatos.add(anioActual);
  const anios=Array.from(aniosConDatos).sort((a,b)=>b-a);
  anioSel.innerHTML=anios.map(a=>`<option value="${a}">${a}</option>`).join("");
  // Prefills razonables
  if(!document.getElementById("ff-dia").value) document.getElementById("ff-dia").value=currentYMD();
  if(!document.getElementById("ff-mes").value) document.getElementById("ff-mes").value=mesActual;
  setFiltroFechaTab(filtroFechaTab);
  document.getElementById("modal-filtro-fecha").classList.add("open");
}
function closeFiltroFechaModal(){
  document.getElementById("modal-filtro-fecha").classList.remove("open");
}
function setFiltroFechaTab(tab){
  filtroFechaTab=tab;
  ["dia","rango","mes","anio"].forEach(t=>{
    document.getElementById("ff-panel-"+t).style.display=(t===tab)?"block":"none";
    const btn=document.getElementById("ff-tab-"+t);
    if(t===tab){ btn.style.background="var(--accent)"; btn.style.color="#fff"; }
    else { btn.style.background=""; btn.style.color=""; }
  });
}
function aplicarFiltroFecha(){
  let desde, hasta, label;
  if(filtroFechaTab==="dia"){
    const v=document.getElementById("ff-dia").value;
    if(!v){showToast("Elegí una fecha");return;}
    desde=v; hasta=v;
    label=v.split("-").reverse().join("/");
  } else if(filtroFechaTab==="rango"){
    const d=document.getElementById("ff-rango-desde").value;
    const h=document.getElementById("ff-rango-hasta").value;
    if(!d||!h){showToast("Completá ambas fechas");return;}
    if(d>h){showToast("La fecha 'desde' no puede ser posterior a 'hasta'");return;}
    desde=d; hasta=h;
    label=`${d.split("-").reverse().join("/")} — ${h.split("-").reverse().join("/")}`;
  } else if(filtroFechaTab==="mes"){
    const v=document.getElementById("ff-mes").value;
    if(!v){showToast("Elegí un mes");return;}
    desde=v+"-01"; hasta=v+"-31";
    label=mesLbl(v);
  } else if(filtroFechaTab==="anio"){
    const v=document.getElementById("ff-anio").value;
    desde=v+"-01-01"; hasta=v+"-12-31";
    label="Año "+v;
  }
  filtroFecha={desde,hasta,label};
  closeFiltroFechaModal();
  document.getElementById("mes-label").textContent=`📅 ${label}`;
  document.getElementById("btn-mes-prev").style.visibility="hidden";
  document.getElementById("btn-mes-next").style.visibility="hidden";
  renderMovs();
}
// Vuelve al modo normal (mes actual con flechas)
function limpiarFiltroFecha(){
  filtroFecha=null;
  document.getElementById("mes-label").textContent=mesLbl(mesActual);
  document.getElementById("btn-mes-prev").style.visibility="visible";
  document.getElementById("btn-mes-next").style.visibility="visible";
  renderMovs();
}
// Devuelve todos los movimientos (incluyendo virtuales de gastos frecuentes) cuya fecha
// cae dentro de [desde, hasta] inclusive, recorriendo mes a mes el rango.
function getMovsEnRango(desde, hasta){
  const [dY,dM]=desde.slice(0,7).split("-").map(Number);
  const [hY,hM]=hasta.slice(0,7).split("-").map(Number);
  const res=[];
  let y=dY, m=dM;
  while(y<hY || (y===hY && m<=hM)){
    const ym=y+"-"+String(m).padStart(2,"0");
    getMesMov(ym).forEach(mv=>{
      const f=String(mv.fecha||"").slice(0,10);
      if(f>=desde && f<=hasta) res.push(mv);
    });
    m++; if(m>12){m=1;y++;}
  }
  return res;
}
// Igual que getMovsEnRango pero para los movimientos virtuales de tarjetas
function getTcMovsEnRango(desde, hasta){
  const [dY,dM]=desde.slice(0,7).split("-").map(Number);
  const [hY,hM]=hasta.slice(0,7).split("-").map(Number);
  const res=[];
  let y=dY, m=dM;
  while(y<hY || (y===hY && m<=hM)){
    const ym=y+"-"+String(m).padStart(2,"0");
    getTcMovsEnMes(ym).forEach(mv=>{
      const f=String(mv.fecha||"").slice(0,10);
      if(f>=desde && f<=hasta) res.push(mv);
    });
    m++; if(m>12){m=1;y++;}
  }
  return res;
}

function setFiltro(f,el){
  // Reseteo sub-filtros cuando cambio el filtro principal
  if(f!=="Tarjeta") filtroTarjeta="";
  if(f!=="Gasto" && f!=="Ingreso") filtroCategoria="";
  filtro=f;
  document.querySelectorAll(".filter-chip").forEach(c=>c.classList.remove("active"));
  el.classList.add("active");
  renderMovs();
}
// Aplica el sub-filtro por nombre de tarjeta (Visa, Mastercard, etc.)
function setFiltroTarjeta(t){
  filtroTarjeta=t;
  renderMovs();
}
// Aplica el sub-filtro por categoría dentro de Gastos / Ingresos
function setFiltroCategoria(c){
  filtroCategoria=c;
  renderMovs();
}
function onSearchMovs(){
  searchQuery=(document.getElementById("mov-search").value||"").trim().toLowerCase();
  renderMovs();
}
// Aplica el filtro de búsqueda a un movimiento (busca en nota, cat, subcat, ticker, desc)
function matchSearch(m){
  if(!searchQuery) return true;
  const fields=[m.nota, m.cat, m.subcat, m.ticker, m.desc, m.tarjeta].filter(Boolean).join(" ").toLowerCase();
  return fields.includes(searchQuery);
}
// Helper para gastos frecuentes (tipo="Gasto" + frecuente=true):
// Calcula el monto aplicable en el mes ym, aplicando los aumentos cargados.
function getGastoFrecMontoEnMes(g, ym){
  let monto=g.moneda==="USD" ? (g.importeOrig||0) : (g.importe||0);
  if(Array.isArray(g.cambios)){
    const aplicables=g.cambios.filter(c=>c.desde<=ym).sort((a,b)=>a.desde.localeCompare(b.desde));
    if(aplicables.length) monto=aplicables[aplicables.length-1].monto;
  }
  return Math.round(monto*100)/100;
}

// ¿Está activo el gasto frecuente g en el mes ym?
function gastoFrecActivoEnMes(g, ym){
  if(!g.mesInicio) return false;
  if(ym<g.mesInicio) return false;
  if(g.mesFin && ym>g.mesFin) return false;
  return true;
}

function getMesMov(ym){
  const resultado=[];
  movs.forEach(m=>{
    // Gasto frecuente: expandir a un movimiento virtual por cada mes activo
    if(m.tipo==="Gasto" && m.frecuente){
      if(!gastoFrecActivoEnMes(m, ym)) return;
      const monto=getGastoFrecMontoEnMes(m, ym);
      const isUSD=m.moneda==="USD";
      // Construyo una copia virtual con el monto vigente para ese mes
      resultado.push({
        ...m,
        _isFrecVirtual: true, // bandera para no permitir doble edición/eliminación
        importe: isUSD ? 0 : monto,
        importeOrig: isUSD ? monto : null,
        // La fecha virtual es el día 1 del mes o el mesInicio si es ese mismo mes
        fecha: ym===String(m.fecha||"").slice(0,7) ? m.fecha : (ym+"-01")
      });
      return;
    }
    // Movimiento normal: aparece solo en el mes de su fecha
    if(!m.fecha) return;
    if(String(m.fecha).slice(0,7)===ym) resultado.push(m);
  });
  return resultado;
}

// Arma el HTML de UN item de la lista de movimientos. Extraída como función aparte (en vez de
// vivir inline dentro de un .map()) para poder reusarla tanto en el primer lote como en los
// lotes que se van agregando con el scroll (ver iniciarLazyLoadMovs).
// Arma el HTML INTERNO de una fila (ícono, categoría, monto, botones) — la usa tanto el
// componente <tx-item> como, si hiciera falta, cualquier otro lugar que necesite el mismo look.
// Es EXACTAMENTE la misma lógica que antes vivía inline dentro de renderTxItemHTML.
function construirCuerpoTxItem(m){
    const isInv=m.tipo==="Inversion";
    const isTc=m._isTc;
    const isAhorro=m.esAhorro===true;
    const isRetiro=m.usaAhorro===true;
    // Para inversiones, el color/signo se decide por cash flow:
    // - Rescate/Cupón/Venta = ingreso al bolsillo (verde, +)
    // - Suscripción/Compra = gasto del bolsillo (rojo, -)
    const invEsIngreso=isInv && isInvSalida(m);
    const invEsGasto=isInv && !isInvSalida(m);
    let amtClass;
    if(isAhorro||isRetiro) amtClass="save";
    else if(invEsIngreso) amtClass="ingreso";
    else if(invEsGasto) amtClass="gasto";
    else if(isTc) amtClass="tarjeta";
    else amtClass=m.tipo.toLowerCase();
    let amt;
    if(isInv){
      const invSign=invEsIngreso?"+":"-";
      if(m.importeUSD>0) amt=`${invSign}USD ${(Math.round(m.importeUSD*100)/100).toFixed(2)}`;
      else amt=`${invSign}${fmtS(m.importe||0)}`;
    } else if(isTc && m.moneda==="USD"){
      amt=`-USD ${(Math.round(m.importe*100)/100).toFixed(2)}`;
    } else if(m.moneda==="USD"&&m.importeOrig){
      const sign=m.tipo==="Gasto"?"-":"+";
      amt=`${sign}USD ${(Math.round(m.importeOrig*100)/100).toFixed(2)}`;
    }
    else if(isRetiro) amt=`+${fmtS(m.importe)}`; // retiro del ahorro: entra plata, signo +
    else amt=`${isTc||m.tipo==="Gasto"?"-":"+"}${fmtS(m.importe)}`;
    let cat,sub;
    if(isTc){
      cat=escapeHtml(m.desc);
      const monedaPref=m.moneda==="USD"?"USD ":"";
      const monedaBadge=m.moneda==="USD"?` <span style="font-size:9px;background:var(--accent-light);color:var(--accent);padding:1px 6px;border-radius:8px;font-weight:500">USD</span>`:"";
      cat+=monedaBadge;
      if(m.frecuente){
        sub=`${escapeHtml(m.subcat)} · 🔁 Mensual fijo · ${(m.fecha||"").split("-").reverse().join("/")}`;
      } else {
        const tot=m.moneda==="USD"?`USD ${m.importeTotal.toFixed(2)}`:fmtS(m.importeTotal);
        sub=`${escapeHtml(m.subcat)} · Cuota ${m.nCuota}/${m.cuotasTotal} · ${tot} total`;
      }
    } else if(isInv){
      // Badge de cash flow para diferenciar rescate vs suscripción
      const invBadge=invEsIngreso
        ?` <span style="font-size:9px;background:var(--success-light);color:var(--success);padding:1px 6px;border-radius:8px;font-weight:500">📥 INGRESO</span>`
        :` <span style="font-size:9px;background:var(--danger-light);color:var(--danger);padding:1px 6px;border-radius:8px;font-weight:500">📤 GASTO</span>`;
      cat=`${escapeHtml(m.cat)}<span class="inv-badge">${escapeHtml(m.ticker||"?")}</span>${invBadge}`;
      sub=`${escapeHtml(m.subcat)} · ${(m.fecha||"").split("-").reverse().join("/")}`;
    } else {
      let badge="";
      if(isAhorro) badge=` <span style="font-size:9px;background:var(--save-light);color:var(--save);padding:1px 6px;border-radius:8px;font-weight:500">AHORRO</span>`;
      else if(isRetiro) badge=` <span style="font-size:9px;background:var(--save-light);color:var(--save);padding:1px 6px;border-radius:8px;font-weight:500">DE AHORROS</span>`;
      else if(m.frecuente) badge=` <span style="font-size:9px;background:var(--warning-light);color:var(--warning);padding:1px 6px;border-radius:8px;font-weight:500">🔁 FRECUENTE</span>`;
      cat=`${escapeHtml(m.cat)}${badge}`;
      if(m.recuperable>0) cat+=` <span style="font-size:9px;background:var(--accent-light);color:var(--accent);padding:1px 6px;border-radius:8px;font-weight:500">🔁 ${fmtAbbr(m.recuperable)}</span>`;
      sub=`${escapeHtml(m.subcat||"")} · ${(m.fecha||"").split("-").reverse().join("/")}`;
    }
    // Ícono e iconClass siguen la misma lógica de color
    let icon, iconClass;
    if(isTc){icon="💳";iconClass="tarjeta";}
    else if(isAhorro){icon="🏦";iconClass="save";}
    else if(isRetiro){icon="💸";iconClass="save";}
    else if(invEsIngreso){icon="📥";iconClass="ingreso";}
    else if(invEsGasto){icon="📤";iconClass="gasto";}
    else {icon=getIcon(m.cat);iconClass=m.tipo.toLowerCase();}
    return `<div class="tx-icon ${iconClass}">${icon}</div>
      <div class="tx-info">
        <div class="tx-cat">${cat}</div>
        <div class="tx-sub">${sub}${!isTc&&m.nota?" · "+escapeHtml(m.nota.slice(0,18)):""}</div>
        ${!isTc?renderTagsChips(m):""}
      </div>
      <div class="tx-amount ${amtClass}">${amt}</div>`;
}

// Caché de datos por fila: como <tx-item> se "upgradea" a partir de un string HTML (el que
// arma renderTxListaLazy), no puede recibir un objeto JS complejo por atributo — por eso cada
// fila guarda acá su movimiento y el placeholder solo lleva la clave para recuperarlo.
// Se vacía al arrancar cada render de lista completa (ver renderTxListaLazy) para no acumular.
const txItemDataCache=new Map();

// Devuelve el HTML placeholder de una fila (<tx-item>): guarda el movimiento en el caché y
// deja que el navegador "upgradee" la etiqueta al componente real cuando se inserta en el DOM.
function renderTxItemHTML(m){
  const isTc=!!m._isTc;
  const key=`${m.id}|${isTc?"tc":"mov"}|${m.fecha||""}`;
  txItemDataCache.set(key, m);
  return `<tx-item data-key="${key}"></tx-item>`;
}

// ── WEB COMPONENT <tx-item> ──
// Encapsula la fila de un movimiento: arma su propio HTML a partir del caché de datos,
// conecta los botones de editar/eliminar (mismas funciones globales de siempre) y agrega
// gestos de swipe (deslizar a la izquierda revela "Eliminar", a la derecha revela "Editar").
class TxItem extends HTMLElement{
  connectedCallback(){
    const key=this.dataset.key;
    const m=txItemDataCache.get(key);
    if(!m){ this.remove(); return; } // el dato ya no existe (raro, pero por las dudas)
    this._m=m;
    this._openState=0; // -1: revelado hacia la izq (eliminar) · 0: cerrado · 1: revelado hacia la der (editar)
    const isTc=!!m._isTc;
    this.innerHTML=`
      <div class="tx-swipe-bg tx-swipe-bg-left">✎ Editar</div>
      <div class="tx-swipe-bg tx-swipe-bg-right">🗑 Eliminar</div>
      <div class="tx-item tx-item-content">${construirCuerpoTxItem(m)}</div>`;
    // Botones grandes de las zonas reveladas por swipe (además de los chiquitos de siempre,
    // que quedan intactos dentro de tx-item-content)
    const bgLeft=this.querySelector(".tx-swipe-bg-left");
    const bgRight=this.querySelector(".tx-swipe-bg-right");
    bgLeft.addEventListener("click", ()=>{
      this._cerrar();
      if(isTc) openEditTcModal(m.id); else openEditModal(m.id);
    });
    bgRight.addEventListener("click", (e)=>{
      if(isTc) confirmarBorrarTc(m.id);
      else borrarMov(m.id, e.currentTarget); // mismo botón: respeta el doble-toque de confirmación
    });
    this._attachSwipe();
  }
  _cerrar(){
    const content=this.querySelector(".tx-item-content");
    content.style.transition="transform .18s ease";
    content.style.transform="translateX(0)";
    this._openState=0;
  }
  _attachSwipe(){
    const content=this.querySelector(".tx-item-content");
    const REVEAL=78;
    const SLOP=12; // píxeles mínimos antes de decidir si es swipe horizontal o solo scroll
    let startX=0, startY=0, dx=0, dragging=false, locked=null; // locked: null=sin decidir, "h"=horizontal, "v"=vertical (ignorar)
    const mover=x=>{ content.style.transform=`translateX(${x}px)`; };
    const onStart=e=>{
      startX=e.touches[0].clientX;
      startY=e.touches[0].clientY;
      dragging=true;
      locked=null;
      content.style.transition="none";
    };
    const onMove=e=>{
      if(!dragging) return;
      const touch=e.touches[0];
      const rawDx=touch.clientX-startX;
      const rawDy=touch.clientY-startY;
      if(locked===null){
        // Todavía no decidimos la dirección: esperamos a que el dedo se mueva lo suficiente
        if(Math.abs(rawDx)<SLOP && Math.abs(rawDy)<SLOP) return;
        // Gana la dirección con mayor desplazamiento. Si es más vertical, esto es un scroll
        // normal de la página: no tocamos el translateX en todo el resto del gesto.
        locked = Math.abs(rawDx)>Math.abs(rawDy) ? "h" : "v";
      }
      if(locked==="v") return; // dejamos que el navegador scrollee normal
      dx=rawDx+(this._openState*REVEAL);
      dx=Math.max(-REVEAL, Math.min(REVEAL, dx));
      mover(dx);
    };
    const onEnd=()=>{
      if(!dragging) return;
      dragging=false;
      content.style.transition="transform .18s ease";
      if(locked==="h"){
        // Umbral más exigente (75% del recorrido) para que haga falta un gesto deliberado
        if(dx<=-REVEAL*0.75){ mover(-REVEAL); this._openState=-1; }
        else if(dx>=REVEAL*0.75){ mover(REVEAL); this._openState=1; }
        else { mover(this._openState*REVEAL); } // vuelve a como estaba (abierto o cerrado)
      }
      dx=0; locked=null;
    };
    content.addEventListener("touchstart", onStart, {passive:true});
    content.addEventListener("touchmove", onMove, {passive:true});
    content.addEventListener("touchend", onEnd);
    content.addEventListener("touchcancel", onEnd);
    // Si está revelado y tocás el contenido (no un botón), se cierra en vez de disparar el tap
    content.addEventListener("click", e=>{
      if(this._openState!==0){
        e.stopPropagation();
        e.preventDefault();
        this._cerrar();
      }
    }, true);
  }
}
customElements.define("tx-item", TxItem);

// Devuelve la etiqueta del separador de fecha: "Hoy", "Ayer", o "12 de septiembre"
function formatearFechaSeparador(fecha){
  if(!fecha) return "Sin fecha";
  const hoy=currentYMD();
  const ayerD=new Date();
  ayerD.setDate(ayerD.getDate()-1);
  const ayer=ayerD.getFullYear()+"-"+String(ayerD.getMonth()+1).padStart(2,"0")+"-"+String(ayerD.getDate()).padStart(2,"0");
  if(fecha===hoy) return "Hoy";
  if(fecha===ayer) return "Ayer";
  const partes=fecha.split("-").map(Number);
  const MESES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${partes[2]} de ${MESES[partes[1]-1]}`;
}
// Recorre un lote de movimientos y arma su HTML intercalando un separador cada vez que la
// fecha cambia respecto al ítem anterior (incluso entre lotes: txUltimaFechaSeparador se
// mantiene entre llamadas dentro del mismo render completo — ver renderTxListaLazy).
let txUltimaFechaSeparador=null;
function renderLoteConSeparadores(lote){
  let html="";
  lote.forEach(m=>{
    const fechaItem=m.fecha||"";
    if(fechaItem!==txUltimaFechaSeparador){
      txUltimaFechaSeparador=fechaItem;
      html+=`<div class="tx-date-sep">${formatearFechaSeparador(fechaItem)}</div>`;
    }
    html+=renderTxItemHTML(m);
  });
  return html;
}

// ═══════════════════════════════════════════
// LAZY LOADING de la lista de Movimientos
// ═══════════════════════════════════════════
// Renderizar de una sola vez un mes con cientos de movimientos puede trabar el DOM.
// Se renderiza un primer lote de 25 y, con un IntersectionObserver mirando un "centinela"
// al final de la lista, se van agregando lotes de 25 más a medida que el usuario scrollea.
const TX_LOTE_SIZE=25;
let txListObserver=null;
let txListaCompleta=[]; // la lista filtrada completa (show), para que el observer sepa qué falta
function renderTxListaLazy(show){
  txListaCompleta=show;
  const list=document.getElementById("tx-list");
  // Si había un observer de un render anterior, lo desconecto (evita que se acumulen)
  if(txListObserver){ txListObserver.disconnect(); txListObserver=null; }
  txItemDataCache.clear(); // limpio la caché de datos de <tx-item> del render anterior
  txUltimaFechaSeparador=null; // reset: es un render de lista completa, arranca de cero
  const primerLote=show.slice(0, TX_LOTE_SIZE);
  list.innerHTML=renderLoteConSeparadores(primerLote);
  if(show.length<=TX_LOTE_SIZE) return; // entra todo en un lote, no hace falta centinela
  list.insertAdjacentHTML("beforeend", `<div id="tx-list-sentinel" style="padding:14px;text-align:center;color:var(--muted);font-size:12px">Cargando más…</div>`);
  let renderizados=TX_LOTE_SIZE;
  const sentinel=document.getElementById("tx-list-sentinel");
  txListObserver=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      const siguienteLote=txListaCompleta.slice(renderizados, renderizados+TX_LOTE_SIZE);
      if(!siguienteLote.length) return;
      sentinel.insertAdjacentHTML("beforebegin", renderLoteConSeparadores(siguienteLote));
      renderizados+=siguienteLote.length;
      if(renderizados>=txListaCompleta.length){
        txListObserver.disconnect();
        sentinel.remove();
      }
    });
  }, {rootMargin:"300px"});
  txListObserver.observe(sentinel);
}

function renderMovs(){
  const mesMovs = filtroFecha ? getMovsEnRango(filtroFecha.desde, filtroFecha.hasta) : getMesMov(mesActual);
  const mesTcs = filtroFecha ? getTcMovsEnRango(filtroFecha.desde, filtroFecha.hasta) : getTcMovsEnMes(mesActual);
  // Las tarjetas NO afectan el saldo: solo se muestran como informativas
  // Ingresos del mes
  const ing=mesMovs.filter(m=>m.tipo==="Ingreso").reduce((s,m)=>s+m.importe,0);
  // Separar gastos: normales, ahorros (depósitos al fondo), retiros del fondo
  const gastosArr=mesMovs.filter(m=>m.tipo==="Gasto" && !m.esAhorro && !m.usaAhorro);
  const ahorrosArr=mesMovs.filter(m=>m.tipo==="Gasto" && m.esAhorro);
  const retirosArr=mesMovs.filter(m=>m.tipo==="Gasto" && m.usaAhorro);
  const gas=gastosArr.reduce((s,m)=>s+m.importe,0);
  const aho=ahorrosArr.reduce((s,m)=>s+m.importe,0);
  const retirado=retirosArr.reduce((s,m)=>s+m.importe,0);
  // Inversiones del mes: impactan el balance desde la perspectiva de cash flow
  // - Suscripción/Compra → sale cash (resta del balance, igual que un gasto)
  // - Rescate/Venta → entra cash (suma al balance, igual que un ingreso)
  const invsMes=mesMovs.filter(m=>m.tipo==="Inversion");
  const invIngresos=invsMes.filter(m=>isInvSalida(m)).reduce((s,m)=>s+(m.importe||0),0);
  const invGastos=invsMes.filter(m=>!isInvSalida(m)).reduce((s,m)=>s+(m.importe||0),0);
  // Balance del mes:
  // INGRESOS REALES: ingresos puros + retiros del ahorro (vuelve a la mano) + rescates de inversión (entra cash)
  // GASTOS REALES: gastos puros + compras/suscripciones de inversión (sale cash, queda expuesto a riesgo de mercado)
  // El ahorro (depósito) sigue siendo neutral: es la misma plata líquida, solo cambia de "cajón".
  // Las tarjetas no afectan el balance.
  const balMes=Math.round((ing+retirado+invIngresos-gas-invGastos)*100)/100;

  // ── CHIPS ADAPTADOS AL FILTRO ──
  const arrastreEl=document.getElementById("mov-arrastre");
  if(filtro==="Tarjeta"){
    // Sub-filtro por nombre de tarjeta (Visa, Mastercard, etc.)
    // Listamos las tarjetas únicas que aparecen este mes
    const tarjetasUnicas=Array.from(new Set(mesTcs.map(m=>m.tarjeta).filter(Boolean))).sort();
    // Si la tarjeta seleccionada no está en el mes actual, reset
    if(filtroTarjeta && !tarjetasUnicas.includes(filtroTarjeta)){
      filtroTarjeta="";
    }
    // Render del sub-filtro
    const subFiltroEl=document.getElementById("mov-tarjeta-filtro");
    if(tarjetasUnicas.length>1){
      subFiltroEl.innerHTML=`
        <span role="button" tabindex="0" class="filter-chip ${filtroTarjeta===''?'active':''}" onclick="setFiltroTarjeta('')">Todas</span>
        ${tarjetasUnicas.map(t=>`<span role="button" tabindex="0" class="filter-chip ${filtroTarjeta===t?'active':''}" onclick="setFiltroTarjeta(${attrJS(t)})">${escapeHtml(t)}</span>`).join("")}`;
      subFiltroEl.style.display="flex";
    } else {
      subFiltroEl.style.display="none";
    }

    // Aplicar sub-filtro: si hay tarjeta seleccionada, filtramos
    const mesTcsFiltrados = filtroTarjeta
      ? mesTcs.filter(m=>m.tarjeta===filtroTarjeta)
      : mesTcs;

    // Vista específica de tarjetas: total mes (ARS y USD por separado), cantidad
    const mesTcsARS=mesTcsFiltrados.filter(m=>m.moneda!=="USD");
    const mesTcsUSD=mesTcsFiltrados.filter(m=>m.moneda==="USD");
    const totalTcARS=mesTcsARS.reduce((s,m)=>s+m.importe,0);
    const totalTcUSD=mesTcsUSD.reduce((s,m)=>s+m.importe,0);
    const cantTc=mesTcsFiltrados.length;

    let chipsHtml=`<div class="chip"><div class="chip-label">Total ARS</div><div class="chip-val warn">${fmtS(totalTcARS)}</div></div>`;
    if(totalTcUSD>0){
      chipsHtml+=`<div class="chip"><div class="chip-label">Total USD</div><div class="chip-val warn">USD ${totalTcUSD.toFixed(2)}</div></div>`;
    }
    chipsHtml+=`<div class="chip"><div class="chip-label">Gastos</div><div class="chip-val warn">${cantTc}</div></div>`;
    document.getElementById("mov-summary").innerHTML=chipsHtml;
    // Línea informativa específica de tarjetas
    const nFrec=mesTcsFiltrados.filter(m=>m.frecuente).length;
    const nCuotas=mesTcsFiltrados.length-nFrec;
    if(mesTcsFiltrados.length){
      const tarjLbl=filtroTarjeta?` · ${escapeHtml(filtroTarjeta)}`:"";
      arrastreEl.innerHTML=`💳 ${nCuotas} ${nCuotas===1?"cuota":"cuotas"} · 🔁 ${nFrec} ${nFrec===1?"frecuente":"frecuentes"}${tarjLbl} · No impacta el saldo`;
      arrastreEl.style.display="block";
    } else {
      arrastreEl.innerHTML=filtroTarjeta?`Sin movimientos de ${escapeHtml(filtroTarjeta)} en ${mesLbl(mesActual)}`:`Sin movimientos de tarjeta en ${mesLbl(mesActual)}`;
      arrastreEl.style.display="block";
    }
    document.getElementById("mov-cat-filtro").style.display="none";
  } else if(filtro==="Gasto"){
    // Vista de gastos: la LISTA muestra TODO lo que aparece como gasto (gastos, ahorros, retiros, suscripciones inv).
    // Pero el CHIP principal "Gastos" suma solo gastos REALES (consumo neto), siguiendo la convención:
    // - Depósitos al ahorro no son gasto (sigue siendo plata tuya)
    // - Retiros del ahorro no son gasto (son ingresos, vuelven a la mano)
    // - Suscripciones de inversión no son gasto (sigue siendo plata tuya)
    const gastosVisibles=mesMovs.filter(m=>m.tipo==="Gasto");
    const invSuscripciones=mesMovs.filter(m=>m.tipo==="Inversion"&&!isInvSalida(m));
    const todoGastosOriginal=[...gastosVisibles, ...invSuscripciones];

    // Sub-filtro por categoría: extraer categorías únicas del mes
    const catsUnicas=Array.from(new Set(todoGastosOriginal.map(m=>m.cat).filter(Boolean))).sort();
    if(filtroCategoria && !catsUnicas.includes(filtroCategoria)) filtroCategoria="";
    const catFilterEl=document.getElementById("mov-cat-filtro");
    if(catsUnicas.length>1){
      catFilterEl.innerHTML=`
        <span role="button" tabindex="0" class="filter-chip ${filtroCategoria===''?'active':''}" onclick="setFiltroCategoria('')">Todas</span>
        ${catsUnicas.map(c=>`<span role="button" tabindex="0" class="filter-chip ${filtroCategoria===c?'active':''}" onclick="setFiltroCategoria(${attrJS(c)})">${getIcon(c,"")} ${escapeHtml(c)}</span>`).join("")}`;
      catFilterEl.style.display="flex";
    } else {
      catFilterEl.style.display="none";
    }

    // Aplicar sub-filtro
    const todoGastos = filtroCategoria ? todoGastosOriginal.filter(m=>m.cat===filtroCategoria) : todoGastosOriginal;

    // Sumas para mostrar chips claros:
    // - "Gastos" = gastos puros + compras/suscripciones de inversión (consumo real + plata que salió al mercado)
    // - "Ahorrado" = depósitos al fondo (informativo, sigue siendo neutral)
    const gastosPurosARS=todoGastos.filter(m=>m.tipo==="Gasto"&&!m.esAhorro&&!m.usaAhorro&&m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0);
    const ahorradoARS=todoGastos.filter(m=>m.tipo==="Gasto"&&m.esAhorro&&m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0);
    const suscripcionesARS=todoGastos.filter(m=>m.tipo==="Inversion"&&m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0);
    const gastosPurosUSD=todoGastos.filter(m=>m.tipo==="Gasto"&&!m.esAhorro&&!m.usaAhorro&&m.moneda==="USD"&&m.importeOrig).reduce((s,m)=>s+m.importeOrig,0);
    const suscripcionesUSD=todoGastos.filter(m=>m.tipo==="Inversion"&&(m.importeUSD||0)>0).reduce((s,m)=>s+m.importeUSD,0);
    const gastosTotalARS=gastosPurosARS+suscripcionesARS;
    const gastosTotalUSD=gastosPurosUSD+suscripcionesUSD;

    let labelARS=filtroCategoria?`${escapeHtml(filtroCategoria)} ARS`:"Gastos ARS";
    let chipsHtml=`<div class="chip"><div class="chip-label">${labelARS}</div><div class="chip-val negative">${fmtS(gastosTotalARS)}</div></div>`;
    if(gastosTotalUSD>0){
      chipsHtml+=`<div class="chip"><div class="chip-label">${filtroCategoria?escapeHtml(filtroCategoria)+" USD":"Gastos USD"}</div><div class="chip-val negative">USD ${gastosTotalUSD.toFixed(2)}</div></div>`;
    }
    chipsHtml+=`<div class="chip"><div class="chip-label">Cantidad</div><div class="chip-val">${todoGastos.length}</div></div>`;
    // Chips informativos cuando no hay sub-filtro de categoría (desglose de qué compone el total)
    if(!filtroCategoria){
      if(ahorradoARS>0){
        chipsHtml+=`<div class="chip"><div class="chip-label" style="color:var(--save)">🏦 Ahorrado</div><div class="chip-val" style="color:var(--save)">${fmtS(ahorradoARS)}</div></div>`;
      }
      if(suscripcionesARS>0){
        chipsHtml+=`<div class="chip"><div class="chip-label" style="color:var(--danger)">◈ Suscripciones</div><div class="chip-val" style="color:var(--danger)">${fmtS(suscripcionesARS)}</div></div>`;
      }
      if(suscripcionesUSD>0){
        chipsHtml+=`<div class="chip"><div class="chip-label" style="color:var(--danger)">◈ Suscripciones USD</div><div class="chip-val" style="color:var(--danger)">USD ${suscripcionesUSD.toFixed(2)}</div></div>`;
      }
    }
    document.getElementById("mov-summary").innerHTML=chipsHtml;
    arrastreEl.style.display="none";
    document.getElementById("mov-tarjeta-filtro").style.display="none";
  } else if(filtro==="Ingreso"){
    // Vista de ingresos: TODO lo que cuenta como "plata que entró a la mano"
    // - Ingresos normales
    // - Rescates/cupones de inversión (entran al bolsillo)
    // - Retiros del ahorro (usaAhorro): son tipo="Gasto" internamente, pero la plata vuelve a la mano,
    //   así que para que el total coincida con el chip de la vista Todos, también se incluyen acá.
    const ingresosArr=mesMovs.filter(m=>m.tipo==="Ingreso");
    const invRescates=mesMovs.filter(m=>m.tipo==="Inversion"&&isInvSalida(m));
    const retirosAhorro=mesMovs.filter(m=>m.tipo==="Gasto"&&m.usaAhorro);
    const todoIngresosOriginal=[...ingresosArr, ...invRescates, ...retirosAhorro];

    // Sub-filtro por categoría
    const catsUnicas=Array.from(new Set(todoIngresosOriginal.map(m=>m.cat).filter(Boolean))).sort();
    if(filtroCategoria && !catsUnicas.includes(filtroCategoria)) filtroCategoria="";
    const catFilterEl=document.getElementById("mov-cat-filtro");
    if(catsUnicas.length>1){
      catFilterEl.innerHTML=`
        <span role="button" tabindex="0" class="filter-chip ${filtroCategoria===''?'active':''}" onclick="setFiltroCategoria('')">Todas</span>
        ${catsUnicas.map(c=>`<span role="button" tabindex="0" class="filter-chip ${filtroCategoria===c?'active':''}" onclick="setFiltroCategoria(${attrJS(c)})">${getIcon(c,"")} ${escapeHtml(c)}</span>`).join("")}`;
      catFilterEl.style.display="flex";
    } else {
      catFilterEl.style.display="none";
    }

    const todoIngresos = filtroCategoria ? todoIngresosOriginal.filter(m=>m.cat===filtroCategoria) : todoIngresosOriginal;

    const ingTotalARS = todoIngresos.reduce((s,m)=>{
      if(m.moneda==="USD") return s;
      return s+(m.importe||0);
    }, 0);
    const ingTotalUSD = todoIngresos.reduce((s,m)=>{
      if(m.tipo==="Inversion" && (m.importeUSD||0)>0) return s+m.importeUSD;
      if(m.moneda==="USD" && m.importeOrig) return s+m.importeOrig;
      return s;
    }, 0);
    let labelARS=filtroCategoria?`${escapeHtml(filtroCategoria)} ARS`:"Ingresos ARS";
    let chipsHtml=`<div class="chip"><div class="chip-label">${labelARS}</div><div class="chip-val positive">${fmtS(ingTotalARS)}</div></div>`;
    if(ingTotalUSD>0){
      chipsHtml+=`<div class="chip"><div class="chip-label">${filtroCategoria?escapeHtml(filtroCategoria)+" USD":"Ingresos USD"}</div><div class="chip-val positive">USD ${ingTotalUSD.toFixed(2)}</div></div>`;
    }
    chipsHtml+=`<div class="chip"><div class="chip-label">Cantidad</div><div class="chip-val">${todoIngresos.length}</div></div>`;
    // Chip informativo: resultado neto de inversiones del mes (rescates - suscripciones)
    // Solo cuando no hay sub-filtro de categoría, para no confundir con totales parciales.
    if(!filtroCategoria){
      const rescatesMes=invsMes.filter(m=>isInvSalida(m)).reduce((s,m)=>s+(m.importe||0),0);
      const suscripcionesMes=invsMes.filter(m=>!isInvSalida(m)).reduce((s,m)=>s+(m.importe||0),0);
      if(rescatesMes>0 || suscripcionesMes>0){
        const resultadoInv=rescatesMes-suscripcionesMes;
        const colorRes=resultadoInv>=0?"var(--success)":"var(--danger)";
        const signRes=resultadoInv>=0?"+":"";
        chipsHtml+=`<div class="chip"><div class="chip-label" style="color:${colorRes}">📊 Resultado inv.</div><div class="chip-val" style="color:${colorRes}">${signRes}${fmtS(resultadoInv)}</div></div>`;
      }
    }
    document.getElementById("mov-summary").innerHTML=chipsHtml;
    arrastreEl.style.display="none";
    document.getElementById("mov-tarjeta-filtro").style.display="none";
  } else {
    // Vista "Todos": ingresos / gastos / balance del mes
    // INGRESOS REALES: ingresos puros + retiros del ahorro (vuelve a la mano) + rescates de inversión (entra cash)
    // GASTOS REALES: solo gastos puros (depósitos a ahorro y compras de inversión NO cuentan)
    const ingTotal=ing+invIngresos+retirado;
    const gasTotal=gas+invGastos;

    // Totales USD del mes (gastos e ingresos en moneda extranjera)
    // Gastos USD: gastos puros + compras de inversión en USD (sin ahorros)
    const gastosUSDTodos=mesMovs.filter(m=>m.tipo==="Gasto"&&m.moneda==="USD"&&!m.esAhorro&&!m.usaAhorro&&m.importeOrig).reduce((s,m)=>s+m.importeOrig,0);
    const invComprasUSD=mesMovs.filter(m=>m.tipo==="Inversion"&&!isInvSalida(m)&&(m.importeUSD||0)>0).reduce((s,m)=>s+m.importeUSD,0);
    const gastosUSDTotal=gastosUSDTodos+invComprasUSD;
    // Retiros USD del ahorro (vuelven a la mano = ingreso)
    const retirosUSD=mesMovs.filter(m=>m.tipo==="Gasto"&&m.moneda==="USD"&&m.usaAhorro&&m.importeOrig).reduce((s,m)=>s+m.importeOrig,0);

    const ingresosUSDTodos=mesMovs.filter(m=>m.tipo==="Ingreso"&&m.moneda==="USD"&&m.importeOrig).reduce((s,m)=>s+m.importeOrig,0);
    const invRescatesUSD=mesMovs.filter(m=>m.tipo==="Inversion"&&isInvSalida(m)&&(m.importeUSD||0)>0).reduce((s,m)=>s+m.importeUSD,0);
    const ingresosUSDTotal=ingresosUSDTodos+invRescatesUSD+retirosUSD;

    let chipsHtml=`
      <div class="chip"><div class="chip-label">Ingresos</div><div class="chip-val positive" id="chip-mov-ing">${fmtS(0)}</div></div>
      <div class="chip"><div class="chip-label">Gastos</div><div class="chip-val negative" id="chip-mov-gas">${fmtS(0)}</div></div>
      <div class="chip"><div class="chip-label">Balance</div><div class="chip-val ${balMes>=0?"positive":"negative"}" id="chip-mov-bal">${fmtS(0)}</div></div>`;
    if(ingresosUSDTotal>0){
      chipsHtml+=`<div class="chip"><div class="chip-label">Ingresos USD</div><div class="chip-val positive">USD ${ingresosUSDTotal.toFixed(2)}</div></div>`;
    }
    if(gastosUSDTotal>0){
      chipsHtml+=`<div class="chip"><div class="chip-label">Gastos USD</div><div class="chip-val negative">USD ${gastosUSDTotal.toFixed(2)}</div></div>`;
    }
    document.getElementById("mov-summary").innerHTML=chipsHtml;
    animarNumero(document.getElementById("chip-mov-ing"), ingTotal, 700, fmtS);
    animarNumero(document.getElementById("chip-mov-gas"), gasTotal, 700, fmtS);
    animarNumero(document.getElementById("chip-mov-bal"), balMes, 700, fmtS);
    document.getElementById("mov-tarjeta-filtro").style.display="none";
    document.getElementById("mov-cat-filtro").style.display="none";
    // Línea informativa: extras del mes (sin arrastre)
    const partes=[];
    if(invIngresos>0){
      partes.push(`◈ Rescates: <strong style="color:var(--success)">${fmtS(invIngresos)}</strong>`);
    }
    if(invGastos>0){
      partes.push(`◈ Suscripciones: <strong style="color:var(--danger)">${fmtS(invGastos)}</strong>`);
    }
    if(aho>0){
      partes.push(`🏦 Ahorrado: <strong style="color:var(--save)">${fmtS(aho)}</strong>`);
    }
    if(retirado>0){
      partes.push(`💸 De ahorros: <strong style="color:var(--save)">${fmtS(retirado)}</strong>`);
    }
    // Total a recuperar (gastos compartidos)
    const recup=mesMovs.filter(m=>m.tipo==="Gasto"&&!m.esAhorro&&m.recuperable>0).reduce((s,m)=>s+m.recuperable,0);
    if(recup>0){
      partes.push(`🔁 A recuperar: <strong style="color:var(--accent)">${fmtS(recup)}</strong>`);
    }
    if(partes.length){
      arrastreEl.innerHTML=partes.join(" · ");
      arrastreEl.style.display="block";
    } else {
      arrastreEl.style.display="none";
    }
  }

  // ── RESUMEN DE PRESUPUESTOS (solo cuando filtro = Gasto) ──
  const presupEl=document.getElementById("mov-presup-resumen");
  const presupCats=Object.keys(presupuestos);
  if(filtro==="Gasto" && presupCats.length){
    // Calcular gasto del mes seleccionado por categoría con presupuesto
    const gastoCat={};
    mesMovs.forEach(m=>{
      if(m.tipo!=="Gasto"||m.esAhorro) return;
      gastoCat[m.cat]=(gastoCat[m.cat]||0)+m.importe;
    });
    let html=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px">
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">📊 Presupuestos del mes</div>`;
    presupCats.sort().forEach(cat=>{
      const tope=presupuestos[cat];
      const gastado=gastoCat[cat]||0;
      const pct=Math.min(100, Math.round(gastado/tope*100));
      let color="var(--success)";
      if(pct>=100) color="var(--danger)";
      else if(pct>=80) color="var(--warning)";
      html+=`<div style="margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">
          <span>${getIcon(cat)} ${escapeHtml(cat)}</span>
          <span style="color:${color};font-weight:600">${pct}%</span>
        </div>
        <div style="background:var(--bg);height:5px;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color}"></div>
        </div>
      </div>`;
    });
    html+=`</div>`;
    presupEl.innerHTML=html;
    presupEl.style.display="block";
  } else {
    presupEl.style.display="none";
  }

  // Combinar y filtrar
  // Las inversiones aparecen según su impacto en cash flow:
  //   - Suscripciones/compras → con los Gastos (sale cash)
  //   - Rescates/ventas → con los Ingresos (entra cash)
  // En la pestaña Inversiones se ven todas con su lógica de portfolio.
  // Orden cronológico estricto: más reciente primero; a igual fecha, id más alto primero
  // (estabilidad para que no "salten" de lugar entre renders).
  const todosMovsConInv = [...mesMovs, ...mesTcs].sort((a, b) => {
    const dateA = a.fecha || "";
    const dateB = b.fecha || "";
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return (b.id || 0) - (a.id || 0);
  });
  let show;
  if(filtro==="Todos") show=todosMovsConInv;
  else if(filtro==="Tarjeta") show = filtroTarjeta ? mesTcs.filter(m=>m.tarjeta===filtroTarjeta) : mesTcs;
  else if(filtro==="Gasto"){
    // Gastos normales + suscripciones/compras (salidas de cash)
    show=mesMovs.filter(m=>(m.tipo==="Gasto") || (m.tipo==="Inversion"&&!isInvSalida(m)));
    if(filtroCategoria) show=show.filter(m=>m.cat===filtroCategoria);
  } else if(filtro==="Ingreso"){
    // Ingresos normales + rescates/ventas (entradas de cash)
    show=mesMovs.filter(m=>(m.tipo==="Ingreso") || (m.tipo==="Inversion"&&isInvSalida(m)));
    if(filtroCategoria) show=show.filter(m=>m.cat===filtroCategoria);
  }
  // Aplicar búsqueda
  if(searchQuery) show=show.filter(matchSearch);
  const list=document.getElementById("tx-list");
  if(!show.length){
    if(searchQuery) list.innerHTML=`<div class="empty"><div class="empty-icon">🔍</div>Sin resultados para "${escapeHtml(searchQuery)}"</div>`;
    else if(filtroFecha) list.innerHTML=`<div class="empty"><div class="empty-icon">📅</div>Sin movimientos en ${filtroFecha.label}</div>`;
    else list.innerHTML=`<div class="empty"><div class="empty-icon">📭</div>Sin movimientos este mes</div>`;
    return;
  }
  renderTxListaLazy(show);
}
async function borrarMov(id, btn){
  const m=movs.find(x=>x.id===id);
  // Si es un gasto frecuente, en lugar de borrar todo el historial, ofrecemos darlo de baja
  // desde el MES QUE EL USUARIO ESTÁ VIENDO (mesActual), no el calendario real
  if(m && m.frecuente){
    const mesDeBaja=mesActual; // usa el mes seleccionado en la pestaña Movs
    if(await mostrarConfirm(`Este es un gasto frecuente mensual.\n\n¿Querés darlo de baja desde ${mesLbl(mesDeBaja)}? (los meses anteriores se mantienen)\n\nCancelar = eliminarlo por completo, incluyendo todos los meses anteriores.`, {textoOk:"Dar de baja", textoCancelar:"Eliminar todo"})){
      // mesFin es el último mes INCLUIDO. Para "dar de baja desde X", mesFin = mes anterior a X.
      m.mesFin = addMonths(mesDeBaja, -1);
      save();
      showToast(`Gasto frecuente dado de baja desde ${mesLbl(mesDeBaja)} ✓`);
      renderMovs();
      return;
    }
    // Si dijo cancelar, ofrecemos borrado total con segunda confirmación
    if(!await mostrarConfirm(`⚠️ Vas a eliminar el gasto frecuente y todos sus meses (incluyendo el historial). ¿Confirmás?`, {textoOk:"Eliminar todo", peligroso:true})) return;
    movs=movs.filter(x=>x.id!==id);
    save();
    showToast("Gasto frecuente eliminado");
    renderMovs();
    return;
  }
  // Confirmación con doble toque para movimientos normales
  if(btn && btn.dataset.confirm!=="1"){
    btn.dataset.confirm="1";
    btn.style.color="var(--danger)";
    btn.style.fontWeight="bold";
    btn.textContent="?";
    setTimeout(()=>{
      if(btn){btn.dataset.confirm="0";btn.style.color="";btn.style.fontWeight="";btn.textContent="×";}
    },2500);
    return;
  }
  movs=movs.filter(m=>m.id!==id);
  save();
  renderMovs();
}
async function confirmarBorrarTc(id){
  const t=tcs.find(x=>x.id===id);
  if(!t) return;
  if(await mostrarConfirm(`¿Eliminar "${t.desc}" (${t.cuotasTotal} cuotas, ${fmt(t.total)})?`, {textoOk:"Eliminar", peligroso:true})){
    tcs=tcs.filter(x=>x.id!==id);
    save();
    showToast("Tarjeta eliminada");
    renderMovs();
    if(document.getElementById("page-tc")&&document.getElementById("page-tc").classList.contains("active")) renderTarjetas();
  }
}

// Calcula el balance acumulado de TODOS los meses estrictamente anteriores al mes ymActual.
// Las tarjetas NO se incluyen porque no afectan el saldo (se pagan al cargar el resumen).
function getArrastre(ymActual){
  // El arrastre se acumula desde enero del año del mes actual hasta el mes anterior.
  // Cada 1° de enero se reinicia a 0.
  let acum=0;
  const yrActual=String(ymActual).slice(0,4);
  movs.forEach(m=>{
    const ym=String(m.fecha||"").slice(0,7);
    if(!ym||ym>=ymActual) return;
    // Solo movimientos del mismo año
    if(ym.slice(0,4)!==yrActual) return;
    if(m.tipo==="Ingreso") acum+=m.importe;
    else if(m.tipo==="Gasto" && !m.usaAhorro) acum-=m.importe;
    // Inversiones también afectan el arrastre desde perspectiva cash flow
    else if(m.tipo==="Inversion") acum+=(m.importe||0)*invSignoCash(m);
    // Los retiros de ahorros no afectan el arrastre (la plata ya salió cuando se ahorró)
  });
  return Math.round(acum*100)/100;
}

