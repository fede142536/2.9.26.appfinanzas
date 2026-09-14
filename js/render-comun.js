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

