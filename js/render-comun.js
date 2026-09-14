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

function save(){
  setSensitiveRaw("fmovs3",JSON.stringify(movs));
  setSensitiveRaw("ftcs3",JSON.stringify(tcs));
  setSensitiveRaw("fcustom3",JSON.stringify(custom));
  setSensitiveRaw("fmetas",JSON.stringify(metas));
  marcarDatosSucios();
}
// Vibración nativa (haptic feedback). No todos los dispositivos/navegadores lo soportan
// (iOS Safari no lo tiene, por ejemplo) — por eso el chequeo antes de llamar.
// Anima un número desde 0 hasta valorFinal con requestAnimationFrame, escribiendo el
// resultado formateado en el elemento en cada frame. Uso: primero renderizar el chip con
// el valor en 0 (o vacío), guardando un id en el elemento; después, en la MISMA función de
// render, llamar animarNumero(document.getElementById(esteId), valorReal, 700, fmtS).
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
// Delegado en document (hay 12 modales distintos, todos con la misma estructura
// .modal-overlay > .modal > .modal-handle) — así no hace falta cablear cada uno a mano.
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
    const enZonaArrastre = e.target.closest(".modal-handle") || (y-rect.top)<60;
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
    modal.style.transition="transform .24s cubic-bezier(.22,.9,.35,1)";
    if(currentY>UMBRAL){
      // Pasó el umbral: termina de salir de pantalla y recién ahí se cierra de verdad
      const overlay=modal.closest(".modal-overlay");
      const altura=modal.getBoundingClientRect().height;
      modal.style.transform=`translateY(${altura+40}px)`;
      setTimeout(()=>{
        if(overlay) overlay.classList.remove("open");
        modal.style.transition="";
        modal.style.transform="";
      }, 240);
    } else {
      // No llegó al umbral: rebota a su posición original
      modal.style.transform="translateY(0)";
      setTimeout(()=>{ modal.style.transition=""; modal.style.transform=""; }, 240);
    }
    currentY=0;
    activeModal=null;
  };
  document.addEventListener("touchend", onEnd);
  document.addEventListener("touchcancel", onEnd);
})();

function vibrar(ms){ if(navigator.vibrate) navigator.vibrate(ms); }
function showToast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200);}

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

// Escape cierra el modal abierto más reciente. Se dispara un click sobre el propio overlay
// en vez de sacarle la clase a mano: así corre el onclick que ya tiene cada modal (que
// llama a SU función de cierre real, con la limpieza que corresponda).
document.addEventListener("keydown", (e)=>{
  if(e.key!=="Escape") return;
  const generico=document.getElementById("modal-dialogo");
  if(generico && generico.classList.contains("open")) return; // tiene su propio manejo
  const abiertos=document.querySelectorAll(".modal-overlay.open");
  if(!abiertos.length) return;
  abiertos[abiertos.length-1].click();
});

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
  el.style.display="block";
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
  mostrarErrorGlobal(e.message, `${e.filename||"?"}:${e.lineno||"?"}:${e.colno||"?"}\n\n${(e.error&&e.error.stack)||""}`);
});
window.addEventListener("unhandledrejection", (e)=>{
  const r=e.reason;
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

function _dialogoCerrar(valor){
  const ov=document.getElementById("modal-dialogo");
  if(ov) ov.classList.remove("open");
  document.removeEventListener("keydown", _dialogoTecla);
  const r=_dialogo.resolver;
  _dialogo.resolver=null;
  if(r) r(valor);
}

function _dialogoCancelar(){ _dialogoCerrar(_dialogoValorCancelado()); }

function _dialogoAceptar(){
  if(_dialogo.tipo==="prompt"){
    _dialogoCerrar(document.getElementById("dialogo-input").value);
  } else {
    _dialogoCerrar(_dialogo.tipo==="confirm" ? true : undefined);
  }
}

function _dialogoTecla(e){
  if(e.key==="Escape"){ e.preventDefault(); _dialogoCancelar(); }
  else if(e.key==="Enter"){ e.preventDefault(); _dialogoAceptar(); }
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

  ov.classList.add("open");
  document.addEventListener("keydown", _dialogoTecla);
  // El foco va después de la animación de entrada del modal (250ms): en el celular es lo
  // que levanta el teclado sin que el modal "salte" mientras se está moviendo.
  if(opts.tipo==="prompt") setTimeout(()=>{ input.focus(); input.select(); }, 250);

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

