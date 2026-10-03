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

// Las cards entran en cascada, no todas juntas.
//
// .card ya traía slideUpFade, pero las cards viven fijas en el HTML: la animación corría UNA vez,
// al cargar la app, y nunca más. Cambiando de pestaña no se veía nada. Acá se reinicia a mano y
// se le da a cada una un arranque escalonado, que es lo que hace que se lea como una secuencia
// y no como un bloque que parpadea.
//
// El retraso se topea a los 6 pasos: con ocho cards, escalonar todas hace que la última tarde
// casi medio segundo en aparecer y deja de sentirse ágil.
function animarEntradaDeCards(pageEl){
  if(!pageEl) return;
  // Si pediste menos movimiento en el sistema, no se toca nada: el CSS ya deja las animaciones
  // en .01ms, y poner delays acá las volvería a alargar.
  try{
    if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  }catch(e){ /* matchMedia puede no existir en entornos de prueba */ }
  const cards=pageEl.querySelectorAll(".card");
  cards.forEach((c,i)=>{
    c.style.animation="none";
    void c.offsetWidth;            // fuerza un reflow: sin esto el navegador agrupa los dos
    c.style.animation="";          // cambios y la animación no se reinicia
    c.style.animationDelay=(Math.min(i,6)*40)+"ms";
  });
}

function showPage(id,btn){
  // Anotar dónde queda la pestaña que estás dejando, antes de ocultarla.
  const saliendo=document.querySelector(".page.active");
  if(saliendo) scrollPorPagina[saliendo.id.replace(/^page-/,"")]=window.scrollY;
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  const entrando=document.getElementById("page-"+id);
  entrando.classList.add("active");
  animarEntradaDeCards(entrando);
  if(btn) btn.classList.add("active");
  // El FAB abre directo a Cargar — no tiene sentido mostrarlo ESTANDO ya en Cargar.
  // Se chequea que exista antes de tocarlo: si faltara, un TypeError acá cortaría toda la
  // función y la pantalla quedaría a medio renderizar.
  const fabEl=document.getElementById('fab-cargar');
  if(fabEl) fabEl.style.display = (id === 'cargar') ? 'none' : 'flex';
  // Movimientos tiene su propio ☰ adentro de la barra unificada (ver .mov-topbar): el botón
  // flotante de siempre quedaría duplicado, uno al lado del otro.
  const hamburgerEl=document.getElementById('hamburger-btn');
  if(hamburgerEl) hamburgerEl.style.display = (id === 'mov') ? 'none' : 'flex';
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
  if(id==="import"){ renderImportHistory(); renderMigrarCambios(); renderTraspasos(); } // liviano, y depende de importHistory (no cubierto por datosVersion)
  if(id==="config"){renderExportStats();renderCatManager();renderPresupManager();renderPinStatus();mostrarVersionApp();renderCuentasManager();renderTarjetasManager();renderEstadoBackup();renderInflacion();} // liviano
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
  animarCambioDeMes(d, document.getElementById("mov-summary"), document.getElementById("tx-list"));
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
  // innerHTML (no textContent) para poder mostrar la "✕" como affordance visible de que
  // se puede tocar para volver al mes actual — antes esto ya funcionaba con un tap (el
  // onclick de #mes-label en index.html), pero sin ningún indicio visual el usuario no lo
  // descubría solo y volvía a abrir el modal para reconfigurar el mes manualmente.
  document.getElementById("mes-label").innerHTML=`📅 ${label} <span class="mes-label-x">✕</span>`;
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

// El selector segmentado (#mov-filtros) se reconstruye entero en cada renderMovs() —igual que
// los sub-filtros de categoría/tarjeta de siempre—, así que alcanza con cambiar la variable y
// volver a renderizar: no hace falta tocar clases a mano sobre un botón puntual.
function setFiltro(f){
  // Reseteo sub-filtros cuando cambio el filtro principal
  if(f!=="Tarjeta") filtroTarjeta="";
  if(f!=="Gasto" && f!=="Ingreso") filtroCategoria="";
  filtro=f;
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
  syncMovSearchBtn();
  renderMovs();
}
// ═══════════════════════════════════════════
// BUSCADOR COLAPSABLE (Movimientos)
// ═══════════════════════════════════════════
// El buscador vive detrás de la lupa: ocupa espacio solo cuando hace falta. Al cerrarlo se
// vacía (si no, quedaría un filtro invisible activo sin forma de saber por qué la lista está
// vacía). La lupa queda "activa" (fondo resaltado) con el panel abierto O con texto cargado,
// así no se pierde la señal de que hay un filtro de búsqueda aplicado al cerrar el panel.
function toggleMovSearch(){
  const row=document.getElementById("mov-search-row");
  const abrir = row.style.display==="none" || !row.style.display;
  row.style.display = abrir ? "block" : "none";
  if(abrir){
    document.getElementById("mov-search").focus();
  } else {
    document.getElementById("mov-search").value="";
    searchQuery="";
    renderMovs();
  }
  syncMovSearchBtn();
}
function syncMovSearchBtn(){
  const btn=document.getElementById("btn-mov-search");
  const row=document.getElementById("mov-search-row");
  if(!btn || !row) return;
  const abierto = row.style.display!=="none" && !!row.style.display;
  btn.classList.toggle("active", abierto || !!searchQuery);
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

// Marca/desmarca como pagado el mes ym de un gasto frecuente. Se guarda en g.pagos (un mapa
// mes -> pagado) separado del importe y de los aumentos: no pisa el historial de otros meses
// ni cambia cuánto vale la cuota, solo si esta ya se pagó.
function toggleFrecPagado(id, ym){
  const g=movs.find(x=>x.id===id && x.frecuente);
  if(!g) return;
  if(!g.pagos) g.pagos={};
  g.pagos[ym]=!g.pagos[ym];
  save();
  actualizarFilaFrecPagado(id, ym, g.pagos[ym]);
}

// Repinta EN EL LUGAR la fila ya montada de un gasto frecuente, en vez de llamar a
// renderMovs(). Un mes viejo con muchos movimientos se muestra por lotes (ver "LAZY LOADING"
// más abajo); un renderMovs() completo tira abajo los lotes que ya se cargaron con el scroll
// y arma un centinela nuevo arriba de donde estaba parado el usuario, que no vuelve a activarse
// si ya lo scrolleó de largo — quedaba "colgado" sin poder seguir cargando (bug reportado).
// El gasto frecuente aparece como mucho una vez por mes en la lista visible, así que alcanza
// con buscar la fila que matchea id+mes entre las montadas.
function actualizarFilaFrecPagado(id, ym, pagado){
  document.querySelectorAll("tx-item").forEach(el=>{
    const m=el._m;
    if(!m || m.id!==id || String(m.fecha||"").slice(0,7)!==ym) return;
    m.pagado=pagado;
    const content=el.querySelector(".tx-item-content");
    if(content) content.innerHTML=construirCuerpoTxItem(m);
    el._conectarBadgePago();
  });
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
        fecha: ym===String(m.fecha||"").slice(0,7) ? m.fecha : (ym+"-01"),
        // El pago es por mes (m.pagos es {ym: true}), no por movimiento: el mismo gasto
        // frecuente puede estar pago en septiembre e impago en octubre.
        pagado: !!(m.pagos && m.pagos[ym])
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
// Arma el subtítulo de una fila juntando solo lo que APORTA algo.
// La fecha NO va: la fila ya vive debajo de un encabezado de fecha ("24 de septiembre"), así
// que repetirla adentro gastaba ancho sin decir nada nuevo. La subcategoría tampoco va cuando
// es "Otros" (el valor por defecto), porque salía idéntica en casi todos los renglones.
const SUBCAT_SIN_VALOR=["Otros","Otro","Sin subcategoría",""];
function subtituloFila(partes){
  return partes.filter(x=>x!==null && x!==undefined && String(x).trim()!=="").join(" · ");
}
function subcatVisible(subcat){
  const s=String(subcat||"").trim();
  return SUBCAT_SIN_VALOR.includes(s) ? "" : escapeHtml(s);
}

// La MISMA clasificación en cinco baldes (gasto/ingreso/inversion/tarjeta/save) que ya
// pintaba el círculo del ícono y el monto, ahora también en el borde izquierdo de la fila
// (ver connectedCallback de <tx-item>): antes cada fila era el mismo rectángulo blanco con
// el mismo borde gris, y con 20-30 movimientos en el mes la lista se volvía una pared de
// tarjetas casi idénticas — había que leer cada una para saber qué era. Se extrae a una
// función propia (antes era un if/else calcado dos veces, uno para el ícono y otro para el
// monto) para que el color de las tres partes de la fila no pueda desalinearse.
function claseTipoDeMov(m){
  const isInv=m.tipo==="Inversion";
  if(m._isTc) return "tarjeta";
  if(m.esAhorro===true || m.usaAhorro===true) return "save";
  if(isInv) return isInvSalida(m) ? "ingreso" : "gasto";
  return m.tipo.toLowerCase();
}

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
    const amtClass=claseTipoDeMov(m);
    let amt;
    let statusBadge=""; // botón de pago/impago de un gasto frecuente, debajo del monto
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
    // Un retiro es una COMPRA pagada con plata del fondo: se muestra con "-", igual que
    // cualquier gasto y que en los totales. El badge "DE AHORROS" aclara de dónde salió.
    else if(isRetiro) amt=`-${fmtS(m.importe)}`;
    else amt=`${isTc||m.tipo==="Gasto"?"-":"+"}${fmtS(m.importe)}`;
    let cat,sub;
    if(isTc){
      cat=escapeHtml(m.desc);
      const monedaPref=m.moneda==="USD"?"USD ":"";
      const monedaBadge=m.moneda==="USD"?` <span class="badge badge-accent">USD</span>`:"";
      cat+=monedaBadge;
      if(m.frecuente){
        sub=subtituloFila([subcatVisible(m.subcat), "🔁 Mensual fijo"]);
      } else {
        const tot=m.moneda==="USD"?`USD ${m.importeTotal.toFixed(2)}`:fmtS(m.importeTotal);
        sub=subtituloFila([subcatVisible(m.subcat), `Cuota ${m.nCuota}/${m.cuotasTotal}`, `${tot} total`]);
      }
    } else if(isInv){
      // Un rescate no es un ingreso y una suscripción no es un gasto: es plata tuya que entra o
      // sale de la inversión. El badge dice eso, no "INGRESO"/"GASTO", que contradecía el
      // balance —donde estas operaciones no suman ni restan— y era lo que más confundía.
      const invBadge=invEsIngreso
        ?` <span class="badge badge-accent">📥 RECUPERO</span>`
        :` <span class="badge badge-accent">📤 INVERTIDO</span>`;
      cat=`${escapeHtml(m.cat)}<span class="inv-badge">${escapeHtml(m.ticker||"?")}</span>${invBadge}`;
      sub=subtituloFila([subcatVisible(m.subcat)]);
    } else {
      let badge="";
      // Las dos patas de un cambio van marcadas: sin el badge, en la lista se ven como un
      // gasto suelto y un ingreso suelto y no se entiende que son una sola operación. El
      // badge dice QUÉ operación fue (compra o venta); cuál de las dos mitades es ya lo dice
      // el color —rojo la que sale, verde la que entra— y repetirlo hacía tan largo el
      // título que se truncaba y el badge no llegaba a verse.
      // Como máximo UN badge en el título (ver handoff de Movimientos): la prioridad es
      // cambio > traspaso > ahorro > de-ahorros > recuperable. El de pago/impago de un gasto
      // frecuente ya NO es un badge de título — vive debajo del monto (ver statusBadge, abajo).
      const infoCambio = esPataDeCambio(m) ? leerCambio(patasDelCambio(m.cambioId, movs)) : null;
      if(esPataDeCambio(m)) badge=` <span class="badge badge-accent">💱 ${infoCambio && infoCambio.sentido==="venta" ? "VENTA" : "COMPRA"}</span>`;
      else if(esTraspaso(m)) badge=` <span class="badge badge-accent">↔️ TRASPASO</span>`;
      else if(isAhorro) badge=` <span class="badge badge-save">AHORRO</span>`;
      else if(isRetiro) badge=` <span class="badge badge-save">DE AHORROS</span>`;
      cat=`${escapeHtml(m.cat)}${badge}`;
      if(!badge && m.recuperable>0) cat+=` <span class="badge badge-accent">🔁 ${fmtAbbr(m.recuperable)}</span>`;
      // El botón de pago/impago de un gasto frecuente (pedido del usuario, solo como ayuda
      // memoria: no cambia ningún cálculo) va debajo del monto, no en el título — ver el
      // texto que arma esta sección en el handoff de Movimientos. El texto en estado impago
      // no dice "Impago" solo, dice "Marcar pagado": un badge que solo INFORMABA el estado no
      // invitaba a tocarlo. Una vez pagado alcanza con informar ("✓ Pagado").
      if(m.frecuente){
        const ym=String(m.fecha||"").slice(0,7);
        statusBadge = m.pagado
          ? `<span class="badge badge-success js-toggle-pago" role="button" tabindex="0" aria-label="Pagado. Tocá para deshacerlo" data-ym="${ym}">✓ Pagado</span>`
          : `<span class="badge badge-danger js-toggle-pago" role="button" tabindex="0" aria-label="Impago. Tocá para marcarlo pagado" data-ym="${ym}">🔁 Marcar pagado</span>`;
      }
      // En un cambio, el tipo de cambio es EL dato de la operación y en la fila no se veía
      // por ningún lado: hay que abrir el editor para saber a cuánto compraste. Se saca de
      // las dos patas juntas, así que se busca la hermana.
      if(esPataDeCambio(m)){
        sub=infoCambio && infoCambio.tc ? `${fmtS(infoCambio.tc)} por dólar` : "";
      } else {
        sub=subtituloFila([subcatVisible(m.subcat)]);
      }
    }
    // El ícono en sí (el emoji) sigue necesitando sus propios casos; el COLOR (iconClass) es
    // el mismo balde de claseTipoDeMov(), para que nunca se desalinee con el borde de la fila.
    let icon;
    if(isTc) icon="💳";
    else if(isAhorro) icon="🏦";
    else if(isRetiro) icon="💸";
    else if(invEsIngreso) icon="📥";
    else if(invEsGasto) icon="📤";
    else icon=getIcon(m.cat);
    const iconClass=claseTipoDeMov(m);
    return `<div class="tx-icon ${iconClass}">${icon}</div>
      <div class="tx-info">
        <div class="tx-cat">${cat}</div>
        <div class="tx-sub">${subtituloFila([sub, !isTc&&m.nota?escapeHtml(m.nota.slice(0,24)):""])}</div>
        ${!isTc?renderTagsChips(m):""}
      </div>
      <div class="tx-amount-wrap">
        <div class="tx-amount ${amtClass}">${amt}</div>
        ${statusBadge}
      </div>`;
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
      <div class="tx-item tx-item-content tx-tipo-${claseTipoDeMov(m)}">${construirCuerpoTxItem(m)}</div>`;
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
    // Badge de pago/impago de un gasto frecuente (ver construirCuerpoTxItem): no es un
    // onclick="" embebido en el HTML (esta fila ya se sacó de ese patrón, ver el badge de
    // arriba), sino un addEventListener igual que bgLeft/bgRight. stopPropagation evita que el
    // toque también dispare el cierre del swipe si la fila estuviera revelada.
    this._conectarBadgePago();
    this._attachSwipe();
  }
  // Separado de connectedCallback para poder reconectarlo después de un repintado puntual
  // (ver actualizarFilaFrecPagado): el innerHTML nuevo trae un <span> nuevo, sin listener.
  _conectarBadgePago(){
    const pagoBtn=this.querySelector(".js-toggle-pago");
    if(pagoBtn){
      pagoBtn.addEventListener("click", e=>{
        e.stopPropagation();
        toggleFrecPagado(this._m.id, pagoBtn.dataset.ym);
      });
    }
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
// Neto del día en ARS, para el separador (ver handoff de Movimientos): ingresos − gastos, sin
// tarjetas ni patas de cambio (misma regla que getArrastre(), más abajo). En el filtro Tarjeta
// es la suma de lo que se cargó ese día (siempre "sale", por eso va con signo −). 0 no se muestra.
function formatearNetoDelDia(items){
  let neto;
  if(filtro==="Tarjeta"){
    neto = -items.filter(m=>m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0);
  } else {
    neto=0;
    items.forEach(m=>{
      if(m._isTc || esPataDeCambio(m) || m.moneda==="USD") return;
      if(esIngreso(m)) neto+=(m.importe||0);
      else if(esConsumo(m)) neto-=(m.importe||0);
    });
  }
  neto=Math.round(neto*100)/100;
  if(neto===0) return "";
  return (neto>0?"+":"−")+fmtS(Math.abs(neto));
}
// Recorre un lote de movimientos y arma su HTML agrupando cada día en su propio <div
// class="tx-day">, con el separador de fecha (+ el neto del día) encabezándolo. Como
// construirLotesPorDia() garantiza que un lote nunca corta un día a la mitad, cada lote abre y
// cierra sus propios grupos sin necesitar reabrir uno que ya quedó insertado en el DOM.
let txUltimaFechaSeparador=null;
function renderLoteConSeparadores(lote){
  let html="";
  let grupoAbierto=false;
  lote.forEach(m=>{
    const fechaItem=m.fecha||"";
    if(fechaItem!==txUltimaFechaSeparador){
      if(grupoAbierto) html+="</div>";
      txUltimaFechaSeparador=fechaItem;
      const itemsDelDia=lote.filter(x=>(x.fecha||"")===fechaItem);
      const netoTxt=formatearNetoDelDia(itemsDelDia);
      html+=`<div class="tx-date-sep"><span>${formatearFechaSeparador(fechaItem)}</span>${netoTxt?`<span class="tx-date-sep-net">${netoTxt}</span>`:""}</div>`;
      html+=`<div class="tx-day">`;
      grupoAbierto=true;
    }
    html+=renderTxItemHTML(m);
  });
  if(grupoAbierto) html+="</div>";
  return html;
}

// ═══════════════════════════════════════════
// LAZY LOADING de la lista de Movimientos
// ═══════════════════════════════════════════
// Renderizar de una sola vez un mes con cientos de movimientos puede trabar el DOM.
// Se renderiza un primer lote y, con un IntersectionObserver mirando un "centinela" al final
// de la lista, se van agregando más lotes a medida que el usuario scrollea.
const TX_LOTE_SIZE=25;
let txListObserver=null;
let txListaCompleta=[]; // la lista filtrada completa (show), para que el observer sepa qué falta
// Orden cronológico estricto: más reciente primero; a igual fecha, id más alto primero
// (estabilidad para que no "salten" de lugar entre renders).
function ordenCronologico(a, b){
  const dateA = a.fecha || "";
  const dateB = b.fecha || "";
  if (dateA !== dateB) return dateB.localeCompare(dateA);
  return (b.id || 0) - (a.id || 0);
}
// Arma lotes de ~tamanoObjetivo movimientos SIN cortar un día a la mitad: show ya viene
// ordenado cronológicamente, así que las fechas iguales quedan siempre juntas, y alcanza con
// seguir sumando al lote actual hasta terminar el día en curso antes de cerrarlo. Sin esto, el
// <div class="tx-day"> de un día que cae justo en el borde de dos lotes quedaría cerrado a
// mitad de camino y el resto aparecería en un grupo nuevo más abajo en vez de seguir el mismo.
function construirLotesPorDia(show, tamanoObjetivo){
  const lotes=[];
  let loteActual=[];
  let fechaActual=null;
  show.forEach(m=>{
    const f=m.fecha||"";
    if(f!==fechaActual && loteActual.length>=tamanoObjetivo){
      lotes.push(loteActual);
      loteActual=[];
    }
    fechaActual=f;
    loteActual.push(m);
  });
  if(loteActual.length) lotes.push(loteActual);
  return lotes;
}

function renderTxListaLazy(show){
  txListaCompleta=show;
  const list=document.getElementById("tx-list");
  // Si había un observer de un render anterior, lo desconecto (evita que se acumulen)
  if(txListObserver){ txListObserver.disconnect(); txListObserver=null; }
  txItemDataCache.clear(); // limpio la caché de datos de <tx-item> del render anterior
  txUltimaFechaSeparador=null; // reset: es un render de lista completa, arranca de cero
  const lotes=construirLotesPorDia(show, TX_LOTE_SIZE);
  list.innerHTML=renderLoteConSeparadores(lotes[0]||[]);
  if(lotes.length<=1) return; // entra todo en un lote, no hace falta centinela
  list.insertAdjacentHTML("beforeend", `<div id="tx-list-sentinel" style="padding:14px;text-align:center;color:var(--muted);font-size:12px">Cargando más…</div>`);
  let loteIdx=1;
  const sentinel=document.getElementById("tx-list-sentinel");
  txListObserver=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      if(loteIdx>=lotes.length) return;
      sentinel.insertAdjacentHTML("beforebegin", renderLoteConSeparadores(lotes[loteIdx]));
      loteIdx++;
      if(loteIdx>=lotes.length){
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
  // TODO gasto cuenta como gasto (ver el modelo en estado-categorias.js): el consumo normal,
  // los depósitos al fondo y las compras pagadas con ahorros. Los otros dos arrays son
  // subconjuntos, solo para los chips informativos y para sumar el retiro como ingreso.
  const gastosArr=mesMovs.filter(esGasto);
  const ahorrosArr=mesMovs.filter(esDepositoAhorro);
  const retirosArr=mesMovs.filter(esRetiroAhorro);
  // Las sumas y el balance salen de totalesDePlata() (estado-categorias.js), que es la única
  // que sabe la regla y la única que se puede probar sin levantar la pantalla entera.
  // La ganancia de inversión del período sale de resultado-inversiones.js, que mira TODA la
  // historia: por una lista de un mes suelto no se puede saber si una venta fue ganancia.
  const ganInv = filtroFecha
    ? gananciaInvEntre(String(filtroFecha.desde).slice(0,7), String(filtroFecha.hasta).slice(0,7))
    : gananciaInvDelMes(mesActual);
  const flujoInv = filtroFecha ? null : flujoInvDelMes(mesActual);
  const totales=totalesDePlata(mesMovs, ganInv);
  const gas=totales.gastos;
  const aho=totales.depositos;
  const retirado=totales.retiros;
  // Inversiones del mes: impactan el balance desde la perspectiva de cash flow
  // - Suscripción/Compra → sale cash (resta del balance, igual que un gasto)
  // - Rescate/Venta → entra cash (suma al balance, igual que un ingreso)
  const invsMes=mesMovs.filter(m=>m.tipo==="Inversion");
  const invIngresos=totales.invEntra;
  const invGastos=totales.invSale;
  // Balance del mes = cuánto cambió la plata que tenés a mano.
  // ENTRA: ingresos + retiros del fondo + rescates de inversión.
  // SALE : todos los gastos (incluidos los depósitos al fondo y las compras con ahorros)
  //        + compras/suscripciones de inversión.
  // El retiro entra y su compra sale, así que se cancelan y el fondo baja: eso es lo que pasó.
  // Antes el retiro sumaba como ingreso y la compra no restaba nunca, así que el balance
  // quedaba inflado en exactamente la plata que sacabas del fondo.
  // Las tarjetas no afectan el balance.
  const balMes=totales.balance;

  // ── SELECTOR SEGMENTADO (reemplaza .filter-row): se reconstruye entero en cada render, con
  // la cantidad de movimientos de cada filtro — igual que ya hacían los sub-filtros de
  // categoría/tarjeta de siempre. Los conteos son del balde completo, sin pisarlos con los
  // sub-filtros de categoría/tarjeta ni con la búsqueda. ──
  const segCounts={
    Todos: mesMovs.length+mesTcs.length,
    Gasto: mesMovs.filter(m=>(m.tipo==="Gasto")||(m.tipo==="Inversion"&&!isInvSalida(m))).length,
    Ingreso: mesMovs.filter(m=>(m.tipo==="Ingreso")||(m.tipo==="Inversion"&&isInvSalida(m))).length,
    Tarjeta: mesTcs.length
  };
  const segLabels=[["Todos","Todos"],["Gasto","Gastos"],["Ingreso","Ingresos"],["Tarjeta","Tarjetas"]];
  document.getElementById("mov-filtros").innerHTML = segLabels.map(([key,label])=>
    `<button type="button" class="seg-btn${filtro===key?' active':''}" onclick="setFiltro('${key}')">${label}<span class="seg-btn-count">${segCounts[key]}</span></button>`
  ).join("");

  // ── RESUMEN ADAPTADO AL FILTRO ──
  const arrastreEl=document.getElementById("mov-arrastre");
  arrastreEl.className="info-line"; // Tarjeta lo cambia más abajo; el resto usa esta por default
  const periodoTxt = filtroFecha ? "en el período" : `en ${mesLbl(mesActual)}`;
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

    // Barras: un segmento por tarjeta, tonos de --warning (más clara cuanto más atrás).
    const porTarjeta={};
    mesTcsARS.forEach(m=>{ porTarjeta[m.tarjeta]=(porTarjeta[m.tarjeta]||0)+m.importe; });
    const tarjetasOrdenadas=Object.entries(porTarjeta).sort((a,b)=>b[1]-a[1]);
    const maxTc=Math.max(totalTcARS,1);
    const tonoTarjeta=i=>`color-mix(in srgb,var(--warning) ${Math.max(100-i*20,30)}%,var(--surface))`;

    let html=`<div class="mov-summary-num">
      <span class="mov-summary-label">Tarjetas ${periodoTxt}</span>
      <span class="mov-summary-val" style="color:var(--warning)">${fmtTotal(totalTcARS)}</span>
    </div>`;
    if(tarjetasOrdenadas.length){
      html+=`<div class="mov-bars"><div class="mov-bar-row">
        <span class="mov-bar-name">Tarj.</span>
        <div class="mov-bar-track">${tarjetasOrdenadas.map(([,v],i)=>`<span class="mov-bar-seg" style="width:${v/maxTc*100}%;background:${tonoTarjeta(i)}"></span>`).join("")}</div>
        <span class="mov-bar-val">${fmtTotal(totalTcARS)}</span>
      </div></div>
      <div class="mov-legend">${tarjetasOrdenadas.map(([t,v],i)=>`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:${tonoTarjeta(i)}"></span><span>${escapeHtml(t)}</span><strong>${fmtTotal(v)}</strong></div>`).join("")}
        ${totalTcUSD>0?`<div class="mov-legend-item"><span>USD</span><strong>USD ${totalTcUSD.toFixed(2)}</strong></div>`:""}
        <div class="mov-legend-item"><span>Gastos</span><strong>${cantTc}</strong></div>
      </div>`;
    }
    document.getElementById("mov-summary").innerHTML=html;
    // Línea informativa específica de tarjetas: ya no tiene superficie propia (ver handoff).
    arrastreEl.className="mov-tarjeta-info";
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
    // El chip grande suma SOLO consumo. Guardar plata —en el fondo o en una inversión— no es
    // gastarla: esos montos van a sus propios chips, abajo, y no se suman acá.
    const ahorradoARS=todoGastos.filter(m=>esDepositoAhorro(m)&&m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0);
    const suscripcionesARS=todoGastos.filter(m=>m.tipo==="Inversion"&&m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0);
    const suscripcionesUSD=todoGastos.filter(m=>m.tipo==="Inversion"&&(m.importeUSD||0)>0).reduce((s,m)=>s+m.importeUSD,0);
    // Con una categoría elegida el chip suma LO QUE SE VE en la lista, igual que en Ingresos.
    // Si no, al filtrar por una categoría de ahorro o de inversión el chip marcaba $0 con la
    // lista llena de movimientos, porque esos montos no son consumo.
    // Sin sub-filtro, además, se suma la PÉRDIDA reconocida de inversión del mes (si la hubo):
    // misma regla que ya usa la pestaña Ingresos con la ganancia (ver el chip "📊 Resultado
    // inv." de acá abajo), para que una pérdida se vea reflejada en algún lado y no solo en el
    // texto de "Todos" — antes de esto, una pérdida no aparecía en Ingresos NI en Gastos.
    const gananciaARS=filtroCategoria?0:(ganInv.ars||0);
    const gananciaUSD=filtroCategoria?0:(ganInv.usd||0);
    const gastosTotalARS = filtroCategoria
      ? todoGastos.filter(m=>m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0)
      : todoGastos.filter(m=>esConsumo(m)&&m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0) + Math.max(-gananciaARS,0);
    const gastosTotalUSD = filtroCategoria
      ? todoGastos.reduce((s,m)=>s+(m.moneda==="USD"?(m.importeOrig||0):0)+(m.tipo==="Inversion"?(m.importeUSD||0):0),0)
      : todoGastos.filter(m=>esConsumo(m)&&m.moneda==="USD"&&m.importeOrig).reduce((s,m)=>s+m.importeOrig,0) + Math.max(-gananciaUSD,0);

    // Barras: por categoría (top 4 + "Otros"), tonos de --danger. Con un sub-filtro activo, el
    // resto de los segmentos queda al 35% de opacidad y solo resalta el elegido.
    const porCatGasto={};
    todoGastos.forEach(m=>{ if(m.moneda!=="USD") porCatGasto[m.cat]=(porCatGasto[m.cat]||0)+(m.importe||0); });
    let catsOrdenadas=Object.entries(porCatGasto).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    if(catsOrdenadas.length>5){
      const otros=catsOrdenadas.slice(4).reduce((s,[,v])=>s+v,0);
      catsOrdenadas=catsOrdenadas.slice(0,4).concat(otros>0?[["Otros",otros]]:[]);
    }
    const maxGasto=Math.max(gastosTotalARS,1);
    const tonoGasto=i=>`color-mix(in srgb,var(--danger) ${Math.max(100-i*20,30)}%,var(--surface))`;

    const labelTxt=filtroCategoria?escapeHtml(filtroCategoria):`Gastado ${periodoTxt}`;
    let html=`<div class="mov-summary-num">
      <span class="mov-summary-label">${labelTxt}</span>
      <span class="mov-summary-val" style="color:var(--danger)">${fmtTotal(gastosTotalARS)}</span>
    </div>`;
    if(catsOrdenadas.length){
      html+=`<div class="mov-bars"><div class="mov-bar-row">
        <span class="mov-bar-name">Cat.</span>
        <div class="mov-bar-track">${catsOrdenadas.map(([c,v],i)=>`<span class="mov-bar-seg" style="width:${v/maxGasto*100}%;background:${tonoGasto(i)};opacity:${(!filtroCategoria||c===filtroCategoria)?1:.35}"></span>`).join("")}</div>
        <span class="mov-bar-val">${fmtTotal(gastosTotalARS)}</span>
      </div></div>
      <div class="mov-legend">${catsOrdenadas.map(([c,v],i)=>`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:${tonoGasto(i)}"></span><span>${escapeHtml(c)}</span><strong>${fmtTotal(v)}</strong></div>`).join("")}</div>`;
    }
    const extrasGasto=[];
    if(gastosTotalUSD>0) extrasGasto.push(`<div class="mov-legend-item"><span>USD</span><strong>USD ${gastosTotalUSD.toFixed(2)}</strong></div>`);
    // Chips informativos cuando no hay sub-filtro de categoría (desglose de qué compone el total)
    if(!filtroCategoria){
      if(Math.round(gananciaARS)!==0){
        const colorRes=gananciaARS>=0?"var(--success)":"var(--danger)";
        extrasGasto.push(`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:${colorRes}"></span><span style="color:${colorRes}">📊 Resultado inv.</span><strong style="color:${colorRes}">${gananciaARS>=0?"+":""}${fmtTotal(gananciaARS)}</strong></div>`);
      }
      if(ahorradoARS>0){
        extrasGasto.push(`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:var(--save)"></span><span style="color:var(--save)">🏦 Ahorrado</span><strong style="color:var(--save)">${fmtTotal(ahorradoARS)}</strong></div>`);
      }
      // En verde, no en rojo: poner plata en una inversión no es perderla.
      if(suscripcionesARS>0){
        extrasGasto.push(`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:var(--invest)"></span><span style="color:var(--invest)">◈ Invertido</span><strong style="color:var(--invest)">${fmtTotal(suscripcionesARS)}</strong></div>`);
      }
      if(suscripcionesUSD>0){
        extrasGasto.push(`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:var(--invest)"></span><span style="color:var(--invest)">◈ Invertido USD</span><strong style="color:var(--invest)">USD ${suscripcionesUSD.toFixed(2)}</strong></div>`);
      }
    }
    extrasGasto.push(`<div class="mov-legend-item"><span>Cantidad</span><strong>${todoGastos.length}</strong></div>`);
    html+=`<div class="mov-legend">${extrasGasto.join("")}</div>`;
    document.getElementById("mov-summary").innerHTML=html;
    arrastreEl.style.display="none";
    document.getElementById("mov-tarjeta-filtro").style.display="none";
  } else if(filtro==="Ingreso"){
    // Vista de ingresos: TODO lo que cuenta como "plata que entró a la mano"
    // - Ingresos normales
    // - Rescates/cupones de inversión (entran al bolsillo)
    // - Retiros del ahorro (usaAhorro): son tipo="Gasto" internamente, pero la plata vuelve a la mano,
    //   así que para que el total coincida con el chip de la vista Todos, también se incluyen acá.
    // La LISTA sigue mostrando todo lo que trae plata a la mano (rescates y retiros incluidos),
    // porque eso es lo que querés poder mirar. Los CHIPS, en cambio, suman solo ingresos de
    // verdad: un rescate es tu propia plata volviendo, no un ingreso.
    const ingresosArr=mesMovs.filter(m=>m.tipo==="Ingreso");
    const invRescates=mesMovs.filter(m=>m.tipo==="Inversion"&&isInvSalida(m));
    const retirosAhorro=mesMovs.filter(esRetiroAhorro);
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

    // Con una categoría elegida, el chip tiene que ser la suma de LO QUE SE VE en la lista: si
    // decís "Salario", el número al lado tiene que ser tu salario. La ganancia de inversión es
    // del mes entero, no de una categoría, así que sumarla ahí hacía que "Salario" mostrara
    // $1.655.232 cuando el único movimiento era de $1.607.621 — el resto era la ganancia del FCI.
    // Sin filtro, en cambio, el chip responde "cuánto entró de verdad": ingresos + ganancia.
    const ingTotalARS = filtroCategoria
      ? todoIngresos.filter(m=>m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0)
      : todoIngresos.filter(m=>m.tipo==="Ingreso"&&m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0) + Math.max(ganInv.ars||0, 0);
    const ingTotalUSD = filtroCategoria
      ? todoIngresos.reduce((s,m)=>s+(m.moneda==="USD"?(m.importeOrig||0):0)+(m.tipo==="Inversion"?(m.importeUSD||0):0),0)
      : todoIngresos.filter(m=>m.tipo==="Ingreso"&&m.moneda==="USD"&&m.importeOrig).reduce((s,m)=>s+m.importeOrig,0) + Math.max(ganInv.usd||0, 0);
    // Barras: por categoría (top 4 + "Otros"), tonos de --success.
    const porCatIng={};
    todoIngresos.forEach(m=>{ if(m.moneda!=="USD") porCatIng[m.cat]=(porCatIng[m.cat]||0)+(m.importe||0); });
    let catsIngOrdenadas=Object.entries(porCatIng).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    if(catsIngOrdenadas.length>5){
      const otros=catsIngOrdenadas.slice(4).reduce((s,[,v])=>s+v,0);
      catsIngOrdenadas=catsIngOrdenadas.slice(0,4).concat(otros>0?[["Otros",otros]]:[]);
    }
    const maxIng=Math.max(ingTotalARS,1);
    const tonoIng=i=>`color-mix(in srgb,var(--success) ${Math.max(100-i*20,30)}%,var(--surface))`;

    const labelIngTxt=filtroCategoria?escapeHtml(filtroCategoria):`Ingresó ${periodoTxt}`;
    let html=`<div class="mov-summary-num">
      <span class="mov-summary-label">${labelIngTxt}</span>
      <span class="mov-summary-val" style="color:var(--success)">${fmtTotal(ingTotalARS)}</span>
    </div>`;
    if(catsIngOrdenadas.length){
      html+=`<div class="mov-bars"><div class="mov-bar-row">
        <span class="mov-bar-name">Cat.</span>
        <div class="mov-bar-track">${catsIngOrdenadas.map(([c,v],i)=>`<span class="mov-bar-seg" style="width:${v/maxIng*100}%;background:${tonoIng(i)};opacity:${(!filtroCategoria||c===filtroCategoria)?1:.35}"></span>`).join("")}</div>
        <span class="mov-bar-val">${fmtTotal(ingTotalARS)}</span>
      </div></div>
      <div class="mov-legend">${catsIngOrdenadas.map(([c,v],i)=>`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:${tonoIng(i)}"></span><span>${escapeHtml(c)}</span><strong>${fmtTotal(v)}</strong></div>`).join("")}</div>`;
    }
    const extrasIng=[];
    if(ingTotalUSD>0) extrasIng.push(`<div class="mov-legend-item"><span>USD</span><strong>USD ${ingTotalUSD.toFixed(2)}</strong></div>`);
    // Solo cuando no hay sub-filtro de categoría, para no confundir con totales parciales.
    if(!filtroCategoria){
      // El resultado del mes NO es rescates − suscripciones: eso es el flujo, y da negativo
      // cualquier mes en que pongas plata sin sacarla, como si hubieras perdido. Es la ganancia
      // reconocida: primero recuperás capital, después ganás.
      if(Math.round(ganInv.ars)!==0){
        const colorRes=ganInv.ars>=0?"var(--success)":"var(--danger)";
        extrasIng.push(`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:${colorRes}"></span><span style="color:${colorRes}">📊 Resultado inv.</span><strong style="color:${colorRes}">${ganInv.ars>=0?"+":""}${fmtTotal(ganInv.ars)}</strong></div>`);
      }
      const recuperado=todoIngresos.filter(m=>m.tipo==="Inversion"&&m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0);
      if(recuperado>0){
        extrasIng.push(`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:var(--invest)"></span><span style="color:var(--invest)">◈ Recuperado</span><strong style="color:var(--invest)">${fmtTotal(recuperado)}</strong></div>`);
      }
      const delFondo=todoIngresos.filter(m=>esRetiroAhorro(m)&&m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0);
      if(delFondo>0){
        extrasIng.push(`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:var(--save)"></span><span style="color:var(--save)">💸 Del fondo</span><strong style="color:var(--save)">${fmtTotal(delFondo)}</strong></div>`);
      }
    }
    extrasIng.push(`<div class="mov-legend-item"><span>Cantidad</span><strong>${todoIngresos.length}</strong></div>`);
    html+=`<div class="mov-legend">${extrasIng.join("")}</div>`;
    document.getElementById("mov-summary").innerHTML=html;
    arrastreEl.style.display="none";
    document.getElementById("mov-tarjeta-filtro").style.display="none";
  } else {
    // Vista "Todos": ingresos / gastos / balance del mes, más un chip por cada ticker operado.
    //
    // Ingresos y Gastos quedan LIMPIOS del FLUJO BRUTO de inversión (comprar/vender). Los montos
    // que movés al mercado son de otra escala que tu sueldo y el supermercado: mezclados ahí
    // tapan la única lectura que se mira todos los días, que es cuánto entró y cuánto se fue por
    // consumo. Ese flujo bruto se ve aparte, en el chip "◈ Invertido" y en un chip por ticker.
    //
    // Lo que SÍ entra a Ingresos/Gastos es el RESULTADO reconocido de esas inversiones (ganancia
    // o pérdida, no el capital que se mueve): antes esta pestaña no lo sumaba en ningún lado —
    // solo aparecía como texto informativo más abajo ("◈ Resultado: +$X") — mientras que la
    // pestaña Ingresos SÍ lo sumaba a su Ingresos. Mismo mes, mismo dato, dos Ingresos distintos
    // (bug reportado por el usuario). Ahora usan la misma regla en las dos pestañas: una
    // ganancia suma a Ingresos, una pérdida suma a Gastos — igual que ya hace totalesDePlata()
    // con ingresosTotal/gastosTotal (estado-categorias.js).
    //
    //     Balance = Ingresos − Gastos   (con el resultado de inversión ya adentro de los dos)
    //
    // INGRESOS: ingresos puros + los retiros del fondo que se consumieron + la ganancia (si la
    //           hubo). El retiro entra a la mano y su compra sale, así que se cancelan solos y
    //           el fondo baja: es lo que pasó. Un traspaso no entra por ningún lado — no lo
    //           gastaste, solo cambió de bolsillo.
    // GASTOS  : consumo (esConsumo) + la pérdida (si la hubo).
    const retirosGastados=mesMovs.filter(m=>esRetiroAhorro(m)&&esConsumo(m)&&m.moneda!=="USD")
      .reduce((s,m)=>s+(m.importe||0),0);
    const gananciaARS=ganInv.ars||0;
    const gananciaUSD=ganInv.usd||0;
    const ingTotal=Math.round((totales.ingresos+retirosGastados+Math.max(gananciaARS,0))*100)/100;
    const gasTotal=Math.round((totales.gastos+Math.max(-gananciaARS,0))*100)/100;

    // Un chip por ticker: neto = rescates − suscripciones. Negativo significa "hay plata puesta
    // ahí, todavía sin rescatar", no que hayas perdido; por eso va en color de inversión y no en
    // rojo de gasto. netoInv es la suma de todos los tickers juntos: el FLUJO de caja del mes
    // (cuánto se puso menos cuánto se sacó), que es una cuenta DISTINTA de la ganancia de arriba
    // — comprar algo que todavía no vendiste mueve caja pero no es ni ganancia ni pérdida.
    const netosTicker=netoPorTickerDelPeriodo(mesMovs);
    const netoInv=netoInvTotal(mesMovs);
    const balCaja=Math.round((ingTotal-gasTotal)*100)/100;

    // Cuánto se puso a trabajar en el mercado este mes, todos los activos juntos (el chip por
    // ticker ya lo desglosa uno por uno; este suma todo para no tener que sumarlos a mano).
    const invertidoARS=totales.invSale;
    const invertidoUSD=mesMovs.filter(m=>m.tipo==="Inversion"&&!isInvSalida(m)).reduce((s,m)=>s+(m.importeUSD||0),0);

    // Lo que pusiste a trabajar este mes en el fondo de ahorro (las inversiones ya tienen su chip).
    const guardado=aho;

    // Misma separación en dólares, con el mismo resultado de inversión adentro.
    const gastosUSDTotal=Math.round((mesMovs.filter(m=>esConsumo(m)&&m.moneda==="USD"&&m.importeOrig).reduce((s,m)=>s+m.importeOrig,0)+Math.max(-gananciaUSD,0))*100)/100;
    const ingresosUSDTotal=Math.round((mesMovs.filter(m=>m.tipo==="Ingreso"&&m.moneda==="USD"&&m.importeOrig).reduce((s,m)=>s+m.importeOrig,0)
      + mesMovs.filter(m=>esRetiroAhorro(m)&&esConsumo(m)&&m.moneda==="USD"&&m.importeOrig).reduce((s,m)=>s+m.importeOrig,0)
      + Math.max(gananciaUSD,0))*100)/100;

    // Barras: Entró (referencia) / Salió (consumo + lo guardado), relativas al mayor de los dos.
    const maxFlujo=Math.max(ingTotal,gasTotal,1);
    const consumoPortion=Math.max(gasTotal-Math.max(guardado,0),0);

    let html=`<div class="mov-summary-num">
      <span class="mov-summary-label">Balance ${periodoTxt}</span>
      <span class="mov-summary-val" id="chip-mov-bal" style="color:${balCaja>=0?"var(--success)":"var(--danger)"}">${fmtTotal(0)}</span>
      <div class="mov-legend" style="margin-top:4px">
        <div class="mov-legend-item"><span class="mov-legend-dot" style="background:var(--success)"></span><span>Entró</span><strong id="chip-mov-ing">${fmtTotal(0)}</strong></div>
        <div class="mov-legend-item"><span class="mov-legend-dot" style="background:var(--danger)"></span><span>Salió</span><strong id="chip-mov-gas">${fmtTotal(0)}</strong></div>
        ${Math.round(guardado)!==0?`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:var(--save)"></span><span>Ahorrado</span><strong>${fmtTotal(guardado)}</strong></div>`:""}
      </div>
    </div>
    <div class="mov-bars">
      <div class="mov-bar-row"><span class="mov-bar-name">Entró</span><div class="mov-bar-track"><span class="mov-bar-seg" style="width:${ingTotal/maxFlujo*100}%;background:var(--success)"></span></div><span class="mov-bar-val">${fmtTotal(ingTotal)}</span></div>
      <div class="mov-bar-row"><span class="mov-bar-name">Salió</span><div class="mov-bar-track"><span class="mov-bar-seg" style="width:${consumoPortion/maxFlujo*100}%;background:var(--danger)"></span>${guardado>0?`<span class="mov-bar-seg" style="width:${guardado/maxFlujo*100}%;background:var(--save)"></span>`:""}</div><span class="mov-bar-val">${fmtTotal(gasTotal)}</span></div>
    </div>`;
    const legendTodos=[];
    if(invertidoARS>0){
      legendTodos.push(`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:var(--invest)"></span><span style="color:var(--invest)">◈ Invertido</span><strong style="color:var(--invest)">${fmtTotal(invertidoARS)}</strong></div>`);
    }
    if(Math.round(netoInv.ars)!==0){
      const colorNeto=netoInv.ars>=0?"var(--success)":"var(--invest)";
      legendTodos.push(`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:${colorNeto}"></span><span style="color:${colorNeto}">◈ Neto inversión</span><strong style="color:${colorNeto}">${netoInv.ars>0?"+":""}${fmtTotal(netoInv.ars)}</strong></div>`);
    }
    if(ingresosUSDTotal>0){
      legendTodos.push(`<div class="mov-legend-item"><span>Ingresos USD</span><strong>USD ${ingresosUSDTotal.toFixed(2)}</strong></div>`);
    }
    if(gastosUSDTotal>0){
      legendTodos.push(`<div class="mov-legend-item"><span>Gastos USD</span><strong>USD ${gastosUSDTotal.toFixed(2)}</strong></div>`);
    }
    if(invertidoUSD>=0.01){
      legendTodos.push(`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:var(--invest)"></span><span style="color:var(--invest)">◈ Invertido USD</span><strong style="color:var(--invest)">USD ${invertidoUSD.toFixed(2)}</strong></div>`);
    }
    if(Math.abs(netoInv.usd)>=0.01){
      const colorNetoU=netoInv.usd>=0?"var(--success)":"var(--invest)";
      legendTodos.push(`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:${colorNetoU}"></span><span style="color:${colorNetoU}">◈ Neto inversión USD</span><strong style="color:${colorNetoU}">${netoInv.usd>0?"+":""}USD ${netoInv.usd.toFixed(2)}</strong></div>`);
    }
    // Los chips de inversión van al final, ya ordenados de mayor a menor por el módulo.
    netosTicker.forEach(t=>{
      const etiqueta=`◈ ${escapeHtml(t.ticker)}`;
      if(Math.round(t.ars)!==0){
        const color=t.ars>=0?"var(--success)":"var(--invest)";
        legendTodos.push(`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:${color}"></span><span style="color:${color}">${etiqueta}</span><strong style="color:${color}">${t.ars>0?"+":""}${fmtTotal(t.ars)}</strong></div>`);
      }
      if(Math.abs(t.usd)>=0.01){
        const colorU=t.usd>=0?"var(--success)":"var(--invest)";
        legendTodos.push(`<div class="mov-legend-item"><span class="mov-legend-dot" style="background:${colorU}"></span><span style="color:${colorU}">${etiqueta} USD</span><strong style="color:${colorU}">${t.usd>0?"+":""}USD ${t.usd.toFixed(2)}</strong></div>`);
      }
    });
    if(legendTodos.length) html+=`<div class="mov-legend">${legendTodos.join("")}</div>`;
    document.getElementById("mov-summary").innerHTML=html;
    animarNumero(document.getElementById("chip-mov-ing"), ingTotal, 700, fmtTotal);
    animarNumero(document.getElementById("chip-mov-gas"), gasTotal, 700, fmtTotal);
    animarNumero(document.getElementById("chip-mov-bal"), balCaja, 700, fmtTotal);
    document.getElementById("mov-tarjeta-filtro").style.display="none";
    document.getElementById("mov-cat-filtro").style.display="none";
    // Línea informativa: extras del mes (sin arrastre)
    const partes=[];
    // El movido bruto ya lo dicen los chips por ticker. Acá queda el resultado, que es otra cosa:
    // el neto de un chip es el FLUJO del mes (negativo si pusiste plata y no la sacaste), y esto
    // es lo que realmente ganaste o perdiste, llevando el capital por ticker desde el principio.
    if(Math.round(ganInv.ars)!==0){
      const cg=ganInv.ars>=0?"var(--success)":"var(--danger)";
      partes.push(`◈ Resultado: <strong style="color:${cg}">${ganInv.ars>=0?"+":""}${fmtS(ganInv.ars)}</strong>`);
    }
    if(aho>0){
      partes.push(`🏦 Ahorrado: <strong style="color:var(--save)">${fmtS(aho)}</strong>`);
    }
    if(retirado>0){
      partes.push(`💸 De ahorros: <strong style="color:var(--save)">${fmtS(retirado)}</strong>`);
    }
    // Total a recuperar (gastos compartidos)
    const recup=mesMovs.filter(m=>esConsumo(m)&&m.recuperable>0).reduce((s,m)=>s+m.recuperable,0);
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
      if(!esGasto(m)) return;
      gastoCat[m.cat]=(gastoCat[m.cat]||0)+m.importe;
    });
    let html=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px">
      <div class="seccion-label mb-8">📊 Presupuestos del mes</div>`;
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
  const todosMovsConInv = [...mesMovs, ...mesTcs].sort(ordenCronologico);
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
  // Ordenar SIEMPRE, sea cual sea la solapa. Antes solo se ordenaba la lista de "Todos": las
  // de Gastos, Ingresos y Tarjetas salían en el orden del array `movs`, que es el orden en que
  // los fuiste cargando. Como un movimiento nuevo se agrega al final, aparecía al fondo de la
  // lista en vez de arriba bajo "Hoy" — y con la carga por lotes quedaba directamente fuera de
  // la primera pantalla. Los encabezados de fecha, que se arman recorriendo la lista en orden,
  // salían además salteados y repetidos.
  show=show.slice().sort(ordenCronologico);
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
  // Un cambio de moneda son DOS movimientos ligados (los pesos que salen y los dólares que
  // entran). Borrar uno solo deja la mitad huérfana y descuadra el balance para siempre, así
  // que se borran juntos y se avisa antes.
  if(m && esPataDeCambio(m)){
    const info=leerCambio(patasDelCambio(m.cambioId, movs));
    const detalle = info
      ? `${fmtS(info.montoARS)} ↔ USD ${info.montoUSD.toFixed(2)}${info.tc?` (a ${fmtS(info.tc)} por dólar)`:""}`
      : "las dos patas";
    if(!await mostrarConfirm(`Este movimiento es la mitad de un cambio de moneda.\n\n${detalle}\n\nSe eliminan las dos mitades juntas: borrar una sola dejaría el balance descuadrado.`,
      {titulo:"Eliminar el cambio", textoOk:"Eliminar las dos", peligroso:true})) return;
    // Si esta compra se había guardado al fondo (ver crearDepositoAhorroUSD), ese depósito no
    // comparte cambioId con las dos patas — sin este filtro extra quedaría huérfano, sumando
    // para siempre a un Fondo USD de un cambio que ya no existe.
    movs=movs.filter(x=>x.cambioId!==m.cambioId && x.origenCambioId!==m.cambioId);
    save();
    showToast("Cambio de moneda eliminado");
    renderMovs();
    return;
  }
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
    // Misma regla que el balance del mes: guardar plata no es gastarla, y las inversiones no son
    // ingreso ni gasto. Antes sumaba los rescates y restaba las suscripciones enteros, así que el
    // arrastre subía y bajaba con cada rotación sin que hubiera cambiado nada.
    if(esIngreso(m)) acum+=m.importe;
    else if(esConsumo(m)) acum-=m.importe;
  });
  // Y aparte, el resultado de las inversiones de esos meses: lo único que sí movió el patrimonio.
  acum += gananciaInvEntre(yrActual+"-01", addMonths(ymActual,-1)).ars;
  return Math.round(acum*100)/100;
}

