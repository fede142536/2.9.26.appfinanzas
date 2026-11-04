// ═══════════════════════════════════════════
// CACHÉ DE VISTAS (dirty tracking centralizado)
// ═══════════════════════════════════════════
// En vez de marcar "sucio" a mano en cada una de las ~57 funciones que mutan datos
// (altísimo riesgo de olvidarse una y mostrar una pestaña con datos viejos), se incrementa
// un contador de versión desde los 6 puntos de guardado reales (save() + las 5 funciones
// de persistencia paralelas de categorías/íconos/cuentas/tarjetas/presupuestos). Cualquier
// mutación real termina pasando por una de esas 6, así que alcanza con instrumentarlas ahí.
let datosVersion=0;
function marcarDatosSucios(){ datosVersion++; }
// Guarda con qué versión de datos se renderizó por última vez cada pestaña
let paginaVersionRenderizada={};

// ═══════════════════════════════════════════
// GUARDADO CON RED DE SEGURIDAD
// ═══════════════════════════════════════════
// Si el almacenamiento del dispositivo se llena, localStorage.setItem() tira
// QuotaExceededError. Antes eso salía como un banner rojo con texto técnico, el cambio se
// quedaba SOLO en memoria (o sea: se veía en la lista como si estuviera guardado) y al
// recargar la app no estaba. Perdías lo último que cargaste sin que nada te lo dijera.
//
// Cómo se resuelve sin perder nada: el backup se arma desde la MEMORIA, no desde el disco
// (ver exportarBackup), así que se puede bajar aunque no entre un byte más. Entonces, cuando
// un guardado falla:
//   1. se devuelven a disco las claves que sí llegaron a escribirse, para no dejarlo a medio
//      camino (los movimientos nuevos guardados pero las tarjetas no, por ejemplo);
//   2. se te ofrece bajar el backup AHORA — con el cambio adentro, porque la memoria todavía
//      lo tiene;
//   3. recién después se revierte la memoria a la última foto que sí se guardó, así lo que
//      ves en pantalla vuelve a ser exactamente lo que está en disco.

// Guarda una PREFERENCIA (el tema, la vista elegida, si ya viste el onboarding, cuándo fue
// el último backup...). Son cosas que si se pierden no duele, así que un fallo de escritura
// se traga: justo cuando el disco está lleno es cuando más importa que la app siga andando y
// que el diálogo que te explica qué hacer no quede tapado por un banner rojo de contabilidad
// interna. Para los datos de verdad está save(), que sí avisa y revierte.
function guardarPreferencia(clave, valor){
  try{ localStorage.setItem(clave, valor); return true; }
  catch(e){ console.warn(`No se pudo guardar la preferencia "${clave}":`, e); return false; }
}

// La última foto que SÍ quedó escrita. Es de dónde se saca el "volver atrás".
let ultimoGuardadoOk = null;

const CLAVES_GUARDADO = {
  fmovs3:   {valor: ()=>JSON.stringify(movs),   defecto: "[]",  aplicar: v=>{ movs   = JSON.parse(v); }},
  ftcs3:    {valor: ()=>JSON.stringify(tcs),    defecto: "[]",  aplicar: v=>{ tcs    = JSON.parse(v); }},
  fcustom3: {valor: ()=>JSON.stringify(custom), defecto: '{"Gasto":{},"Ingreso":{},"Inversion":{},"Tarjeta":{}}', aplicar: v=>{ custom = JSON.parse(v); }},
  fmetas:   {valor: ()=>JSON.stringify(metas),  defecto: "[]",  aplicar: v=>{ metas  = JSON.parse(v); }}
};

// Lo que hay escrito ahora mismo. Se usa como punto de retorno la primera vez, cuando
// todavía no hubo ningún guardado exitoso en esta sesión.
function fotoEnDisco(){
  const foto={};
  Object.entries(CLAVES_GUARDADO).forEach(([k,def])=>{ foto[k]=getSensitiveRaw(k, def.defecto); });
  return foto;
}

function save(){
  // El resultado de inversiones se calcula sobre toda la historia y se guarda cacheado; si no se
  // invalida acá, un alta, una edición o un borrado siguen viéndose con el cálculo viejo.
  if(typeof invalidarResultadoInv==="function") invalidarResultadoInv();
  if(!ultimoGuardadoOk) ultimoGuardadoOk = fotoEnDisco();
  const nuevo={};
  Object.entries(CLAVES_GUARDADO).forEach(([k,def])=>{ nuevo[k]=def.valor(); });

  const yaEscritas=[];
  try{
    Object.keys(CLAVES_GUARDADO).forEach(k=>{ setSensitiveRaw(k, nuevo[k]); yaEscritas.push(k); });
  }catch(err){
    // Paso 1: dejar el disco consistente. Volver a poner los valores viejos es escribir algo
    // igual o más chico que lo que ya entraba, así que no debería fallar; si igual falla, no
    // hay nada mejor que hacer y el aviso de abajo es lo que importa.
    yaEscritas.forEach(k=>{ try{ setSensitiveRaw(k, ultimoGuardadoOk[k]); }catch(e){} });
    // Pasos 2 y 3 (diálogo, backup y vuelta atrás de la memoria): son asíncronos.
    avisarGuardadoFallido(err);
    // Se corta acá para que el código que sigue al save() —el toast de "guardado ✓", el
    // reseteo del formulario— no se ejecute: no se guardó nada.
    const e=new Error("No se pudo guardar: "+(err&&err.message||err));
    e.__guardadoManejado=true;  // el banner global se calla: ya hay un diálogo explicándolo
    throw e;
  }
  ultimoGuardadoOk = nuevo;
  marcarDatosSucios();
  // Los vencimientos viven también en Google Calendar: tras cada guardado se manda lo que haya cambiado.
  if(typeof programarSyncCalendario==="function") programarSyncCalendario();
  return true;
}

// Revierte la memoria a la última foto guardada y vuelve a dibujar.
function revertirALoGuardado(){
  if(!ultimoGuardadoOk) return;
  Object.entries(CLAVES_GUARDADO).forEach(([k,def])=>{
    try{ def.aplicar(ultimoGuardadoOk[k]); }catch(e){ /* dato ilegible: se deja como está */ }
  });
  marcarDatosSucios();
  if(typeof renderMovs==="function") renderMovs();
}

// `puedeRevertir` en false es el caso del cifrado con PIN: ahí el guardado real es diferido,
// así que cuando se entera del fallo ya pasó tiempo y revertir podría llevarse puesto algo
// más que el último cambio. En ese caso se avisa y se ofrece el backup, pero no se toca nada.
async function avisarGuardadoFallido(err, opciones){
  const puedeRevertir = !opciones || opciones.puedeRevertir!==false;
  const lleno = /quota|exceeded|storage/i.test(String((err&&err.name)||"")+" "+String((err&&err.message)||""));
  const causa = lleno
    ? "El almacenamiento del dispositivo está lleno."
    : `El navegador rechazó la escritura (${(err&&err.name)||"error"}).`;
  const queSigue = puedeRevertir
    ? "Tu último cambio NO quedó guardado. Bajate el backup ahora: se arma desde la memoria, así que incluye ese cambio aunque no haya entrado en el disco. Después de bajarlo, la pantalla vuelve a mostrar lo último que sí está guardado."
    : "Los cambios de los últimos segundos pueden no haber quedado guardados. Bajate el backup ahora: se arma desde la memoria, así que los incluye.";
  const bajar = await mostrarConfirm(`${causa}\n\n${queSigue}`,
    {titulo:"No se pudieron guardar tus datos", textoOk:"Bajar backup ahora",
     textoCancelar: puedeRevertir?"Descartar el cambio":"Ahora no", peligroso:true});
  if(bajar && typeof exportarBackup==="function"){
    try{ exportarBackup(); }
    catch(e){ mostrarErrorGlobal("Tampoco se pudo generar el backup", String(e&&e.message||e)); }
  }
  if(puedeRevertir) revertirALoGuardado();
  if(lleno){
    await mostrarAlerta("Para liberar espacio: borrá movimientos viejos desde Importar → Limpieza de datos, o sacá alguna app del celular. Después volvé a cargar el movimiento.",
      "Cómo hacer lugar");
  }
}
// Vibración nativa (haptic feedback). No todos los dispositivos/navegadores lo soportan
// (iOS Safari no lo tiene, por ejemplo) — por eso el chequeo antes de llamar.
// Anima un número desde 0 hasta valorFinal con requestAnimationFrame, escribiendo el
// resultado formateado en el elemento en cada frame. Uso: primero renderizar el chip con
// el valor en 0 (o vacío), guardando un id en el elemento; después, en la MISMA función de
// render, llamar animarNumero(document.getElementById(esteId), valorReal, 700, fmtS).
// Una sola respuesta para toda la app. El @media de CSS no alcanza: no llega al canvas de los
// gráficos ni a nada que decidamos en JS, así que hace falta poder preguntarlo desde acá.
function prefiereMenosMovimiento(){
  try{
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }catch(e){ return false; }   // matchMedia puede no existir en entornos de prueba
}

// Desliza el contenido al cambiar de mes, en la dirección en la que te moviste.
//
// La clase se saca al terminar y se vuelve a poner en el próximo cambio: si quedara puesta, la
// animación no se reiniciaría y tocando la flecha dos veces seguidas solo se vería la primera.
// El reflow intermedio es lo que fuerza al navegador a tratarlo como una animación nueva.
function animarCambioDeMes(direccion, ...elementos){
  if(prefiereMenosMovimiento()) return;
  const clase = direccion>=0 ? "mes-desde-der" : "mes-desde-izq";
  elementos.filter(Boolean).forEach(el=>{
    el.classList.remove("mes-desde-der","mes-desde-izq");
    void el.offsetWidth;
    el.classList.add(clase);
    el.addEventListener("animationend", ()=>el.classList.remove(clase), {once:true});
  });
}

// Anima todos los números marcados con data-animar dentro de un contenedor.
//
// El render pinta el valor final en el atributo y un cero formateado como texto; esto los hace
// contar hasta el valor. Se resuelve con un atributo y no con un id por cada número porque los
// chips se generan en lote: con ids habría que inventar uno por chip y acordarse de cablearlo.
//
// data-animar-fmt elige el formateador (fmtTotal por defecto). Son funciones declaradas en el
// scope global de scripts clásicos, así que viven en window y se pueden buscar por nombre.
function animarNumerosDe(cont){
  if(!cont) return;
  const menos=prefiereMenosMovimiento();
  cont.querySelectorAll("[data-animar]").forEach(el=>{
    const valor=parseFloat(el.dataset.animar);
    if(!isFinite(valor)) return;      // un número roto se deja como lo dejó el render ("—")
    const fn=(typeof window[el.dataset.animarFmt]==="function") ? window[el.dataset.animarFmt] : fmtTotal;
    if(menos){ el.textContent=fn(valor); return; }
    animarNumero(el, valor, 700, fn);
  });
}

function animarNumero(elemento, valorFinal, duracion, formatoFn){
  if(!elemento) return;
  duracion = duracion || 700;
  formatoFn = formatoFn || (v=>Math.round(v).toString());
  const inicio = performance.now();
  function frame(ahora){
    const progreso = Math.min((ahora-inicio)/duracion, 1);
    // easeOutExpo: arranca rápido y desacelera al final — se siente más premium que lineal
    const eased = progreso>=1 ? 1 : 1-Math.pow(2,-10*progreso);
    elemento.textContent = formatoFn(valorFinal*eased);
    if(progreso<1) requestAnimationFrame(frame);
    else elemento.textContent = formatoFn(valorFinal); // asegura el valor EXACTO al terminar
  }
  requestAnimationFrame(frame);
}
// ═══════════════════════════════════════════
// SWIPE-TO-DISMISS en modales (arrastrar hacia abajo desde el handle para cerrar)
// ═══════════════════════════════════════════
// Delegado en document (hay más de 25 modales distintos, todos con la misma estructura
// .modal-overlay > .modal > .modal-handle) — así no hace falta cablear cada uno a mano.
// [AAA navegacion] Al pasar el umbral NO se saca la clase "open" a mano: se hace click sobre el
// propio overlay, igual que Escape, así corre el cierre real de cada hoja (con su limpieza) y, en
// el diálogo genérico, se resuelve su promesa (antes quedaba colgada con el listener de teclado
// puesto). Y el gesto solo arranca si la hoja no está scrolleada: si no, pelea con el scroll.
(function(){
  const UMBRAL=100;
  let startY=0, currentY=0, dragging=false, activeModal=null;
  document.addEventListener("touchstart", e=>{
    const modal=e.target.closest(".modal");
    if(!modal) return;
    const overlay=modal.closest(".modal-overlay");
    if(!overlay || !overlay.classList.contains("open")) return;
    // Solo arranca el gesto si el toque empieza en el handle o en la franja superior
    // (~60px) del modal — así no interfiere con el scroll normal de su contenido
    const rect=modal.getBoundingClientRect();
    const y=e.touches[0].clientY;
    const enHandle=!!e.target.closest(".modal-handle");
    const enZonaArrastre = enHandle || ((y-rect.top)<60 && modal.scrollTop<=0);
    if(!enZonaArrastre) return;
    activeModal=modal;
    startY=y;
    currentY=0;
    dragging=true;
    modal.style.transition="none";
  }, {passive:true});
  document.addEventListener("touchmove", e=>{
    if(!dragging || !activeModal) return;
    currentY=e.touches[0].clientY-startY;
    if(currentY<0) currentY=0; // solo se arrastra hacia abajo, no hacia arriba
    activeModal.style.transform=`translateY(${currentY}px)`;
  }, {passive:true});
  const onEnd=()=>{
    if(!dragging || !activeModal) return;
    dragging=false;
    const modal=activeModal;
    modal.style.transition="transform var(--dur-2) var(--ease)";
    const limpiar=()=>{ modal.style.transition=""; modal.style.transform=""; };
    if(currentY>UMBRAL){
      // Pasó el umbral: termina de salir de pantalla y recién ahí se cierra de verdad
      const overlay=modal.closest(".modal-overlay");
      const altura=modal.getBoundingClientRect().height;
      modal.style.transform=`translateY(${altura+40}px)`;
      setTimeout(()=>{
        if(overlay) overlay.click();   // el cierre propio de la hoja (ver arriba)
        // Si la hoja no se cerró (no tiene cierre por toque afuera), vuelve a su lugar
        if(overlay && overlay.classList.contains("open")) modal.style.transform="translateY(0)";
        setTimeout(limpiar, 240);
      }, 200);
    } else {
      // No llegó al umbral: rebota a su posición original
      modal.style.transform="translateY(0)";
      setTimeout(limpiar, 240);
    }
    currentY=0;
    activeModal=null;
  };
  document.addEventListener("touchend", onEnd);
  document.addEventListener("touchcancel", onEnd);
})();

function vibrar(ms){ if(navigator.vibrate) navigator.vibrate(ms); }
// ═══════════════════════════════════════════
// AVISOS (toast)
// ═══════════════════════════════════════════
// [AAA navegacion] El aviso vive ABAJO, por encima del botón del perro y de la barra de Guardar (antes tapaba la
// barra superior), es una región "status" (aria-live=polite: el lector de pantalla lo lee solo) y, al irse, se
// vacía: no queda ni texto viejo ni un botón "Deshacer" invisible que el Tab pueda alcanzar. Un aviso con botón
// no se va mientras el foco o el mouse están encima (WCAG 2.2.1), y Esc lo descarta.
let toastTimer=null, toastLimpiar=null, toastPausado=false, toastRestante=0, toastFin=0;
// Cuánto se queda un aviso en pantalla: 2,2 s y, si el texto es largo (se lee en varias líneas), un poco más por cada letra de más.
function duracionToast(msg){ return Math.min(2200+Math.max(String(msg||"").length-40,0)*45, 7000); }
function _toastProgramar(ms){
  clearTimeout(toastTimer);
  toastRestante=ms; toastFin=Date.now()+ms;
  if(!toastPausado) toastTimer=setTimeout(ocultarToast, ms);
}
// Si hay un aviso de error abajo, el aviso se apoya encima de él en vez de pisarlo.
function _toastUbicar(t){
  const eb=document.getElementById("error-banner");
  const h=(eb && eb.style && eb.style.display && eb.style.display!=="none") ? (eb.offsetHeight||0) : 0;
  if(t.style && t.style.setProperty) t.style.setProperty("--toast-extra", h+"px");
}
function ocultarToast(){
  const t=document.getElementById("toast");
  if(!t) return;
  clearTimeout(toastTimer); toastPausado=false;
  t.classList.remove("show");
  // Recién cuando terminó de irse se vacía (si en el medio llegó otro aviso, no se toca).
  clearTimeout(toastLimpiar);
  toastLimpiar=setTimeout(()=>{ if(!t.classList.contains("show")){ t.classList.remove("con-accion"); t.textContent=""; } }, 320);
}
function showToast(msg){
  const t=document.getElementById("toast");
  clearTimeout(toastLimpiar); toastPausado=false;
  t.classList.remove("con-accion");
  t.textContent=msg;
  _toastUbicar(t);
  t.classList.add("show");
  _toastProgramar(duracionToast(msg));
}
// Un aviso con un botón (p. ej. "Deshacer"): dura más, para dar tiempo a tocarlo. Un aviso nuevo lo reemplaza.
function showToastAccion(msg, textoAccion, fn, ms){
  const t=document.getElementById("toast");
  clearTimeout(toastLimpiar); toastPausado=false;
  t.textContent="";
  const span=document.createElement("span"); span.textContent=msg;
  const b=document.createElement("button"); b.type="button"; b.className="toast-accion"; b.textContent=textoAccion;
  b.onclick=()=>{ ocultarToast(); fn(); };
  t.append(span,b);
  _toastUbicar(t);
  t.classList.add("show","con-accion");
  _toastProgramar(ms||7000);
}
(function(){
  const t=document.getElementById("toast");
  if(!t || !t.addEventListener) return;
  const pausar=()=>{ if(toastPausado || !t.classList.contains("show")) return; toastPausado=true; clearTimeout(toastTimer); toastRestante=Math.max(toastFin-Date.now(),0); };
  const reanudar=()=>{ if(!toastPausado) return; toastPausado=false; if(t.classList.contains("show")){ toastFin=Date.now()+Math.max(toastRestante,2000); toastTimer=setTimeout(ocultarToast, Math.max(toastRestante,2000)); } };
  t.addEventListener("focusin", pausar);
  t.addEventListener("focusout", e=>{ if(!e.relatedTarget || !t.contains(e.relatedTarget)) reanudar(); });
  t.addEventListener("pointerenter", e=>{ if(e.pointerType==="mouse") pausar(); });
  t.addEventListener("pointerleave", e=>{ if(e.pointerType==="mouse") reanudar(); });
})();

// ═══════════════════════════════════════════
// ACCESIBILIDAD: TECLADO
// ═══════════════════════════════════════════
// Varios elementos que actúan como botones son <div>/<span> con onclick (chips de filtro,
// pestañas de año, filas de detalle). Se les puso role="button" y tabindex="0" para que
// el navegador los anuncie y los enfoque; esto completa el trato: Enter y Espacio los
// activan, igual que a un <button> de verdad. Un solo listener delegado cubre también los
// que se generan dinámicamente.
document.addEventListener("keydown", (e)=>{
  if(e.key!=="Enter" && e.key!==" ") return;
  const el=e.target.closest && e.target.closest('[role="button"]');
  if(!el) return;
  e.preventDefault();
  el.click();
});

// Escape cierra lo de más arriba: el aviso con foco, la hoja abierta más reciente o el menú lateral. Se dispara un
// click sobre el propio overlay en vez de sacarle la clase a mano: así corre el onclick que ya tiene cada modal
// (que llama a SU función de cierre real, con la limpieza que corresponda).
document.addEventListener("keydown", (e)=>{
  if(e.key!=="Escape") return;
  const aviso=document.getElementById("toast");
  if(aviso && aviso.classList && aviso.classList.contains("show") && aviso.contains && aviso.contains(document.activeElement)){ ocultarToast(); return; }
  const generico=document.getElementById("modal-dialogo");
  if(generico && generico.classList.contains("open")) return; // tiene su propio manejo
  const abiertos=document.querySelectorAll(".modal-overlay.open");
  if(abiertos.length){ abiertos[abiertos.length-1].click(); return; }
  const menu=document.getElementById("side-menu");
  if(menu && menu.classList.contains("open") && typeof closeSideMenu==="function") closeSideMenu();
});

// ═══════════════════════════════════════════
// FOCO EN HOJAS, DIÁLOGOS Y MENÚ  [AAA navegacion]
// ═══════════════════════════════════════════
// Con el teclado (o un lector de pantalla), el Tab recorría 30 controles de la pantalla de atrás antes de llegar al
// primer campo de la hoja. Ahora, mientras hay una capa abierta (hoja .modal-overlay.open o el menú lateral):
//   · el foco entra a la capa (a la propia hoja, no a un campo: en el celular un campo levantaría el teclado);
//   · Tab y Shift+Tab dan la vuelta DENTRO de la capa de más arriba;
//   · al cerrarse, el foco vuelve al botón que la abrió (si sigue ahí y a nadie le importa a dónde fue el foco).
// No se mete con la pantalla de bloqueo ni con la bienvenida (si una de ellas es lo más alto, no atrapa nada), y no
// toca el cierre ni el contenido de ningún modal: observa la clase "open" de cada capa, así no hay que cablear cada uno.
const _CAPAS=".modal-overlay.open, #side-menu.open";
const _FOCUSABLES='a[href],button,input,select,textarea,summary,[tabindex],[contenteditable="true"]';
const _capasAbiertas=new Map();   // capa → botón que la abrió
const _historialFoco=[];          // últimos controles enfocados (null = el foco se perdió); de ahí sale "quién abrió la capa"
let _modoTeclado=false;           // la última interacción fue con teclado (si no, no se devuelve el foco a un campo de texto)

function _visible(el){ return !!el && el.isConnected && getComputedStyle(el).visibility!=="hidden" && (el.offsetWidth>0 || el.offsetHeight>0 || el.getClientRects().length>0); }
function _focusables(caja){
  return Array.from(caja.querySelectorAll(_FOCUSABLES)).filter(el=>{
    if(el.disabled || el.getAttribute("tabindex")==="-1" || el.closest("[inert],[hidden]")) return false;
    if(el.tagName==="INPUT" && el.type==="hidden") return false;
    return _visible(el);
  });
}
function _cajaDeCapa(capa){ return capa.id==="side-menu" ? capa : (capa.querySelector(".modal") || capa); }
// La capa que de verdad está arriba (por z-index, y a igual z-index la última del documento). null si no hay o si
// arriba hay una pantalla propia (bloqueo / bienvenida), que maneja su foco sola.
function _capaSuperior(){
  const candidatas=Array.from(document.querySelectorAll(_CAPAS));
  ["lock-screen","onboarding-screen"].forEach(id=>{ const el=document.getElementById(id); if(el && el.isConnected && getComputedStyle(el).display!=="none") candidatas.push(el); });
  let mejor=null, zMejor=-Infinity;
  candidatas.forEach(el=>{ const z=parseInt(getComputedStyle(el).zIndex,10)||0; if(z>=zMejor){ mejor=el; zMejor=z; } });
  return (mejor && mejor.id!=="lock-screen" && mejor.id!=="onboarding-screen") ? mejor : null;
}
function _esCampoDeTexto(el){ return !!el && (el.tagName==="TEXTAREA" || el.tagName==="SELECT" || (el.tagName==="INPUT" && !/^(button|checkbox|radio|submit|reset|range|color|file)$/.test(el.type))); }

function _entrarEnCapa(capa){
  const caja=_cajaDeCapa(capa);
  if(caja.contains(document.activeElement)) return;     // ya hay foco adentro (p. ej. el diálogo lo pone solo)
  if(!caja.hasAttribute("tabindex")) caja.setAttribute("tabindex","-1");
  caja.focus({preventScroll:true});
}
function _devolverFoco(capa, abridor){
  const a=document.activeElement;
  // Si el foco ya se fue a otro lado (la persona tocó otra cosa, o hay otra capa), no se lo roba.
  if(a && a!==document.body && !capa.contains(a)) return;
  if(abridor && _visible(abridor) && !abridor.disabled && (_modoTeclado || !_esCampoDeTexto(abridor))){
    abridor.focus({preventScroll:true});
  } else if(_modoTeclado && (!a || a===document.body || capa.contains(a))){
    // El botón que abrió la capa ya no está (p. ej. el menú cambió de pantalla): el foco pasa a la pantalla activa.
    const pag=document.querySelector(".page.active");
    if(pag){ if(!pag.hasAttribute("tabindex")) pag.setAttribute("tabindex","-1"); pag.focus({preventScroll:true}); }
  }
}
// El último control enfocado ANTES de que se abriera la capa c (los que están dentro de c no cuentan). Si en el medio
// el foco se perdió (tocar algo no enfocable), no hay a quién devolverlo.
function _abridorDe(c){
  for(let i=_historialFoco.length-1;i>=0;i--){
    const x=_historialFoco[i];
    if(x===null) return null;
    if(x.isConnected && !c.contains(x)) return x;
  }
  return null;
}
function _sincronizarCapas(){
  const abiertas=new Set(document.querySelectorAll(_CAPAS));
  abiertas.forEach(c=>{
    if(_capasAbiertas.has(c)) return;
    _capasAbiertas.set(c, _abridorDe(c));
    if(_capaSuperior()===c) _entrarEnCapa(c);
  });
  Array.from(_capasAbiertas.keys()).forEach(c=>{
    if(abiertas.has(c)) return;
    const abridor=_capasAbiertas.get(c);
    _capasAbiertas.delete(c);
    _devolverFoco(c, abridor);
  });
  // El botón ☰ anuncia si el menú está abierto.
  const menuAbierto=!!document.querySelector("#side-menu.open");
  document.querySelectorAll('[onclick*="toggleSideMenu"]').forEach(b=>b.setAttribute("aria-expanded", String(menuAbierto)));
}
let _observarCapa=()=>{};   // registra una capa creada después del arranque (las del HTML se registran solas)
(function(){
  if(typeof MutationObserver==="undefined") return;
  const menu=document.getElementById("side-menu");
  if(menu){   // el menú es un diálogo modal con nombre (el HTML solo trae el <div>)
    menu.setAttribute("role","dialog"); menu.setAttribute("aria-modal","true"); menu.setAttribute("aria-label","Menú principal");
  }
  document.querySelectorAll('[onclick*="toggleSideMenu"]').forEach(b=>{ b.setAttribute("aria-haspopup","dialog"); b.setAttribute("aria-controls","side-menu"); b.setAttribute("aria-expanded","false"); });
  const mo=new MutationObserver(_sincronizarCapas);
  _observarCapa=c=>mo.observe(c,{attributes:true,attributeFilter:["class"]});
  document.querySelectorAll(".modal-overlay, #side-menu").forEach(_observarCapa);
  document.addEventListener("focusin", e=>{ _historialFoco.push(e.target); if(_historialFoco.length>8) _historialFoco.shift(); }, true);
  document.addEventListener("focusout", e=>{ if(!e.relatedTarget){ _historialFoco.push(null); if(_historialFoco.length>8) _historialFoco.shift(); } }, true);
  document.addEventListener("keydown", e=>{ _modoTeclado=true; }, true);
  document.addEventListener("pointerdown", ()=>{ _modoTeclado=false; }, true);
  document.addEventListener("keydown", e=>{
    if(e.key!=="Tab" || e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
    // Un aviso con botón ("Deshacer") queda al final del documento: con el foco perdido, el primer Tab va directo a él.
    const aviso=document.getElementById("toast");
    const boton=aviso && aviso.classList && aviso.classList.contains("show") && aviso.querySelector ? aviso.querySelector(".toast-accion") : null;
    const sup=_capaSuperior();
    if(boton && !e.shiftKey && !sup && (!document.activeElement || document.activeElement===document.body)){ e.preventDefault(); boton.focus(); return; }
    if(!sup) return;
    const caja=_cajaDeCapa(sup), f=_focusables(caja), a=document.activeElement;
    if(!f.length){ e.preventDefault(); _entrarEnCapa(sup); return; }
    if(!caja.contains(a) || a===caja){ e.preventDefault(); (e.shiftKey ? f[f.length-1] : f[0]).focus(); return; }
    if(!e.shiftKey && a===f[f.length-1]){ e.preventDefault(); f[0].focus(); }
    else if(e.shiftKey && a===f[0]){ e.preventDefault(); f[f.length-1].focus(); }
  }, true);
})();

// ═══════════════════════════════════════════
// BOTÓN DEL PERRO (#fab-cargar) Y TECLADO EN PANTALLA  [AAA navegacion]
// ═══════════════════════════════════════════
// El botón flotante tapaba el importe de la última fila visible y el botón "Pagar" de Tarjetas. Ahora, mientras
// bajás por una lista, se esconde (se desliza hacia abajo) y vuelve apenas subís un poco, en el borde de arriba o de
// abajo de la página, o si lo enfocás con el teclado. Es lo que hacen los botones flotantes de las apps nativas.
function fabCargarMostrar(){
  const fab=document.getElementById("fab-cargar");
  if(fab) fab.classList.remove("fab-oculto");
  _fabUltimoY=window.scrollY;
}
let _fabUltimoY=0;
(function(){
  const fab=document.getElementById("fab-cargar");
  if(!fab || !fab.classList) return;
  let pendiente=false;
  const evaluar=()=>{
    pendiente=false;
    const y=window.scrollY, dy=y-_fabUltimoY;
    const maximo=document.documentElement.scrollHeight-window.innerHeight;
    if(y<=24 || y>=maximo-8) { fab.classList.remove("fab-oculto"); _fabUltimoY=y; return; }
    if(dy>=8){ fab.classList.add("fab-oculto"); _fabUltimoY=y; }
    else if(dy<=-8){ fab.classList.remove("fab-oculto"); _fabUltimoY=y; }
  };
  window.addEventListener("scroll", ()=>{ if(!pendiente){ pendiente=true; requestAnimationFrame(evaluar); } }, {passive:true});
})();
// Teclado en pantalla: en Chrome del celular el teclado tapa lo que está fijo abajo (el aviso). --kb es lo que
// mide el teclado; el aviso se apoya encima de él. Con el zoom del pellizco no se calcula.
(function(){
  const vv=window.visualViewport;
  if(!vv) return;
  const medir=()=>{
    const kb=(vv.scale>1.01) ? 0 : Math.max(0, Math.round(window.innerHeight-vv.height-vv.offsetTop));
    document.documentElement.style.setProperty("--kb", kb+"px");
  };
  vv.addEventListener("resize", medir); vv.addEventListener("scroll", medir);
})();

// ═══════════════════════════════════════════
// ERRORES VISIBLES
// ═══════════════════════════════════════════
// En el celular no hay consola: sin esto, un error no atrapado se traduce en "la app no
// hace nada" y no hay manera de saber por qué. Cualquier falla queda acá, legible y
// copiable, para poder diagnosticarla sin adivinar.
let _ultimoError="";

function mostrarErrorGlobal(titulo, detalle){
  _ultimoError=`${titulo}\n\n${detalle||""}`.trim();
  const el=document.getElementById("error-banner");
  if(!el){ console.error(titulo, detalle); return; }
  document.getElementById("error-banner-msg").textContent=titulo;
  const pre=document.getElementById("error-banner-detalle");
  pre.textContent=detalle||"(sin detalle)";
  pre.style.display="none";
  document.getElementById("error-banner-toggle").textContent="Ver detalle";
  el.style.display="flex";
}
function toggleErrorDetalle(){
  const pre=document.getElementById("error-banner-detalle");
  const abierto=pre.style.display!=="none";
  pre.style.display=abierto?"none":"block";
  document.getElementById("error-banner-toggle").textContent=abierto?"Ver detalle":"Ocultar detalle";
}
function cerrarErrorBanner(){
  const el=document.getElementById("error-banner");
  if(el) el.style.display="none";
}
function copiarError(){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(_ultimoError).then(
      ()=>showToast("Error copiado al portapapeles"),
      ()=>showToast("No se pudo copiar")
    );
  } else {
    showToast("Este navegador no permite copiar automáticamente");
  }
}

window.addEventListener("error", (e)=>{
  // Sin `message` es un recurso que no cargó (por ejemplo un CDN caído), no un error de
  // código: eso ya se maneja aparte y no tiene sentido alarmar al usuario.
  if(!e.message) return;
  if(e.error && e.error.__guardadoManejado) return;
  mostrarErrorGlobal(e.message, `${e.filename||"?"}:${e.lineno||"?"}:${e.colno||"?"}\n\n${(e.error&&e.error.stack)||""}`);
});
window.addEventListener("unhandledrejection", (e)=>{
  const r=e.reason;
  // Un fallo de guardado ya abrió su propio diálogo explicando qué pasó y ofreciendo el
  // backup: encima de eso, el banner rojo con el stack solo asusta.
  if(r && r.__guardadoManejado) return;
  const titulo=(r && (r.message||typeof r==="string")) ? String(r.message||r) : "Una operación falló sin dar motivo";
  mostrarErrorGlobal(titulo, (r && r.stack) ? r.stack : "");
});

// ═══════════════════════════════════════════
// DIÁLOGOS PROPIOS (reemplazan alert/confirm/prompt nativos)
// ═══════════════════════════════════════════
// Los diálogos nativos del navegador pueden no tener dónde renderizarse en una PWA
// instalada (modo standalone, sin barra de navegador): quedan bloqueando la ejecución a la
// espera de una interacción imposible y la app se cuelga sin mostrar nada. Nos pasó con el
// alert() de la migración del PIN y dejó al usuario sin poder entrar a su propia app.
//
// A diferencia de los nativos, estos NO son bloqueantes: devuelven una Promesa. Por eso
// quien los llama tiene que ser `async` y usar `await`.
//   await mostrarAlerta("Listo")                 → undefined
//   await mostrarConfirm("¿Seguro?")             → true / false
//   await mostrarPrompt("¿Nombre?")              → texto / null (igual que prompt nativo)
const _dialogo={resolver:null, tipo:"alert"};

function _dialogoValorCancelado(){
  if(_dialogo.tipo==="prompt") return null;   // prompt nativo devuelve null al cancelar
  if(_dialogo.tipo==="confirm") return false;
  return undefined;
}

let _dialogoFocusTimer=null;

function _dialogoCerrar(valor){
  const ov=document.getElementById("modal-dialogo");
  if(ov) ov.classList.remove("open");
  const campo=document.getElementById("dialogo-input"), ver=document.getElementById("dialogo-ver");
  if(campo && ver && ver.style.display!=="none"){ campo.value=""; campo.type="password"; }   // una clave no se queda escrita en la pantalla, ni a la vista
  document.removeEventListener("keydown", _dialogoTecla);
  // Si el diálogo se cierra antes de que pasen los 250ms de abajo, ese timer todavía no
  // disparó. Sin cancelarlo, el input del diálogo YA CERRADO recibía foco y selección solo
  // medio segundo después: en el celular eso podía levantar el teclado de nuevo justo
  // después de que el usuario había cancelado.
  if(_dialogoFocusTimer){ clearTimeout(_dialogoFocusTimer); _dialogoFocusTimer=null; }
  const r=_dialogo.resolver;
  _dialogo.resolver=null;
  if(r) r(valor);
}

function _dialogoCancelar(){ _dialogoCerrar(_dialogoValorCancelado()); }

// Muestra u oculta lo que se escribe en un campo de clave del diálogo.
function _dialogoVer(){
  const input=document.getElementById("dialogo-input"), ver=document.getElementById("dialogo-ver");
  if(!input || !ver) return;
  const mostrar=input.type==="password";
  input.type=mostrar ? "text" : "password";
  ver.textContent=mostrar ? "Ocultar" : "Mostrar";
  ver.setAttribute("aria-pressed", String(mostrar));
  input.focus();
}

function _dialogoAceptar(){
  if(_dialogo.tipo==="prompt"){
    _dialogoCerrar(document.getElementById("dialogo-input").value);
  } else {
    _dialogoCerrar(_dialogo.tipo==="confirm" ? true : undefined);
  }
}

function _dialogoTecla(e){
  if(e.key==="Escape"){ e.preventDefault(); _dialogoCancelar(); }
  else if(e.key==="Enter"){
    // [AAA navegacion] Con el foco en un botón (Cancelar, Mostrar…) Enter lo activa a él: antes aceptaba el diálogo
    // igual, o sea que Enter sobre "Cancelar" confirmaba un borrado.
    if(e.target && e.target.closest && e.target.closest("button,a[href]")) return;
    e.preventDefault(); _dialogoAceptar();
  }
}

function _dialogoAbrir(opts){
  const ov=document.getElementById("modal-dialogo");
  // Si por lo que sea el modal no está en el HTML, es preferible caer a los diálogos
  // nativos antes que dejar al usuario sin ninguna forma de responder.
  if(!ov){
    if(opts.tipo==="prompt") return Promise.resolve(prompt(opts.mensaje, opts.valorInicial||""));
    if(opts.tipo==="confirm") return Promise.resolve(confirm(opts.mensaje));
    alert(opts.mensaje);
    return Promise.resolve(undefined);
  }
  // Si quedaba otro abierto, se cancela para no dejar su promesa colgada para siempre
  if(_dialogo.resolver) _dialogoCancelar();

  _dialogo.tipo=opts.tipo;
  const elTitulo=document.getElementById("dialogo-titulo");
  elTitulo.textContent=opts.titulo||"";
  elTitulo.style.display=opts.titulo?"block":"none";
  document.getElementById("dialogo-mensaje").textContent=opts.mensaje||"";

  const grupo=document.getElementById("dialogo-input-group");
  const input=document.getElementById("dialogo-input");
  if(opts.tipo==="prompt"){
    grupo.style.display="block";
    input.type=opts.tipoInput||"text";
    // Un campo de clave se puede mostrar para ver lo que se escribe (se vuelve a esconder cada vez que se abre el diálogo).
    const ver=document.getElementById("dialogo-ver");
    if(ver){ ver.style.display=opts.tipoInput==="password" ? "" : "none"; ver.textContent="Mostrar"; ver.setAttribute("aria-pressed","false"); }
    input.inputMode=opts.inputMode||"text";
    input.placeholder=opts.placeholder||"";
    input.value=opts.valorInicial!==undefined&&opts.valorInicial!==null?String(opts.valorInicial):"";
  } else {
    grupo.style.display="none";
  }

  const btnOk=document.getElementById("dialogo-btn-ok");
  btnOk.textContent=opts.textoOk||"Aceptar";
  btnOk.style.background=opts.peligroso?"var(--danger)":"var(--accent)";
  btnOk.style.color="#fff";
  const btnCancel=document.getElementById("dialogo-btn-cancelar");
  btnCancel.textContent=opts.textoCancelar||"Cancelar";
  btnCancel.style.display=(opts.tipo==="alert")?"none":"block";

  // [AAA navegacion] Un lector de pantalla lo lee como diálogo de alerta (o como diálogo común si pide un texto), con su título y mensaje.
  const caja=ov.querySelector ? ov.querySelector(".modal") : null;
  if(caja){
    caja.setAttribute("role", opts.tipo==="prompt" ? "dialog" : "alertdialog");
    caja.setAttribute("aria-labelledby", opts.titulo ? "dialogo-titulo" : "dialogo-mensaje");
    caja.setAttribute("aria-describedby", "dialogo-mensaje");
  }
  ov.classList.add("open");
  document.addEventListener("keydown", _dialogoTecla);
  // El foco va después de la animación de entrada del modal (250ms): en el celular es lo
  // que levanta el teclado sin que el modal "salte" mientras se está moviendo.
  if(_dialogoFocusTimer) clearTimeout(_dialogoFocusTimer);
  if(opts.tipo==="prompt") _dialogoFocusTimer=setTimeout(()=>{ input.focus(); input.select(); }, 250);
  // Alerta y confirmación: el foco entra al diálogo ya, en el botón que corresponde (en un borrado, el seguro: Cancelar).
  else (opts.peligroso && opts.tipo==="confirm" ? btnCancel : btnOk).focus({preventScroll:true});

  return new Promise(resolve=>{ _dialogo.resolver=resolve; });
}

function mostrarAlerta(mensaje, titulo){
  return _dialogoAbrir({tipo:"alert", mensaje, titulo:titulo||"", textoOk:"Entendido"});
}
function mostrarConfirm(mensaje, opts){
  return _dialogoAbrir(Object.assign({tipo:"confirm", mensaje}, opts||{}));
}
function mostrarPrompt(mensaje, opts){
  return _dialogoAbrir(Object.assign({tipo:"prompt", mensaje}, opts||{}));
}

