// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// ONBOARDING (pantalla de bienvenida, solo usuarios nuevos)
// ═══════════════════════════════════════════
let obStep=0;
// Se muestra únicamente si nunca se vio Y no hay datos cargados (usuario 100% nuevo).
// Si alguien actualiza desde una versión vieja de la app con datos propios, se marca
// como "ya visto" sin mostrar nada, para no interrumpirle el uso normal.
function checkOnboarding(){
  if(localStorage.getItem("fonboarded")) return;
  if(movs.length>0 || tcs.length>0){
    localStorage.setItem("fonboarded","1");
    return;
  }
  obStep=0;
  actualizarOnboardingUI();
  document.getElementById("onboarding-screen").style.display="flex";
}
function actualizarOnboardingUI(){
  for(let i=0;i<3;i++){
    document.getElementById("ob-slide-"+i).style.display = i===obStep ? "block" : "none";
    document.getElementById("ob-dot-"+i).classList.toggle("active", i===obStep);
  }
  document.getElementById("ob-btn-siguiente").textContent = obStep===2 ? "Empezar" : "Siguiente";
  document.getElementById("ob-btn-saltar").style.visibility = obStep===2 ? "hidden" : "visible";
}
function onboardingSiguiente(){
  if(obStep<2){ obStep++; actualizarOnboardingUI(); }
  else { cerrarOnboarding(); }
}
function cerrarOnboarding(){
  localStorage.setItem("fonboarded","1");
  document.getElementById("onboarding-screen").style.display="none";
}

// ═══════════════════════════════════════════
// DRAG & DROP GLOBAL DE ARCHIVOS (Excel/CSV/JSON)
// ═══════════════════════════════════════════
// Arrastrar un archivo sobre CUALQUIER parte de la app (no solo la pestaña Import) muestra
// un overlay y, al soltarlo, lo procesa con los mismos handleXlsx()/restaurarBackup() de
// siempre — se les pasa un objeto liviano {files:[file]} en vez de un <input> real, porque
// esas funciones solo usan input.files[0] (y a veces input.value=""), así que no hace falta
// tocarlas para nada.
let dragCounter=0;
// Estos listeners se registran al cargar el archivo, o sea ANTES de que el usuario ingrese
// el PIN. Sin este chequeo se podía soltar un backup sobre la pantalla de bloqueo: se
// importaba sin haber desbloqueado y, con el cifrado activo, los datos terminaban guardados
// en texto plano y encima invisibles (al desbloquear se lee el sobre cifrado, no esas claves).
function appBloqueada(){
  const lock=document.getElementById("lock-screen");
  return !!(lock && getComputedStyle(lock).display!=="none");
}
document.addEventListener("dragenter", (e)=>{
  if(appBloqueada()) return;
  if(!e.dataTransfer || !Array.from(e.dataTransfer.types||[]).includes("Files")) return;
  e.preventDefault();
  dragCounter++;
  document.getElementById("drop-overlay").style.display="flex";
});
document.addEventListener("dragover", (e)=>{
  if(!e.dataTransfer || !Array.from(e.dataTransfer.types||[]).includes("Files")) return;
  e.preventDefault(); // obligatorio: sin esto el navegador no permite soltar
});
document.addEventListener("dragleave", (e)=>{
  dragCounter=Math.max(0,dragCounter-1);
  if(dragCounter===0) document.getElementById("drop-overlay").style.display="none";
});
document.addEventListener("drop", (e)=>{
  if(appBloqueada()) return;
  if(!e.dataTransfer) return;
  e.preventDefault();
  dragCounter=0;
  document.getElementById("drop-overlay").style.display="none";
  const file=e.dataTransfer.files && e.dataTransfer.files[0];
  if(!file) return;
  procesarArchivoSoltado(file);
});
function procesarArchivoSoltado(file){
  const nombre=(file.name||"").toLowerCase();
  const fakeInput={files:[file], value:""};
  if(nombre.endsWith(".json")){
    restaurarBackup(fakeInput);
  } else if(nombre.endsWith(".xlsx")||nombre.endsWith(".xls")||nombre.endsWith(".csv")){
    handleXlsx(fakeInput);
  } else {
    showToast("Formato no soportado. Usá .xlsx, .xls, .csv o .json");
  }
}

// Arranque de la app. checkLock() muestra (si corresponde) la pantalla de PIN y devuelve
// una Promise que recién se resuelve cuando no hace falta PIN o cuando el correcto ya fue
// ingresado (y, si el cifrado está activo, los datos ya quedaron descifrados en memoria).
// Los datos sensibles NO se cargan a memoria (loadSensitiveIntoMemory) hasta ese momento:
// antes del PIN no hay nada de movs/tcs/etc. cargado, ni init()/renderMovs() corren todavía.
async function bootApp(){
  await checkLock();
  loadSensitiveIntoMemory();
  init();
  // Arranca mostrando Movimientos en vez de Cargar.
  // IMPORTANTE: se llama renderMovs() explícitamente DESPUÉS de showPage(). showPage() tiene
  // un caché de vistas (paginaVersionRenderizada vs datosVersion) que saltea el render si cree
  // que la pestaña ya está al día — y en el arranque esa comparación puede dar "al día" cuando
  // en realidad nunca se pintó nada, dejando la lista en blanco. El render inicial no puede
  // depender de ese caché.
  showPage('mov', document.querySelector('.nav-btn[onclick*="\'mov\'"]'));
  renderMovs();
  checkOnboarding();
  // Con delay: que el usuario vea primero sus datos, no un diálogo tapando la pantalla
  // apenas abre la app. avisarSiFaltaBackup() decide adentro si corresponde mostrar algo.
  setTimeout(avisarSiFaltaBackup, 1300);
}
bootApp();

// Chart.js se carga con defer (ver el comentario en index.html), así que cuando se pinta
// la primera pantalla puede no estar disponible todavía. Los gráficos se saltean solos en
// ese caso, pero el caché de vistas (paginaVersionRenderizada) daría la pestaña por "al
// día" y los dejaría vacíos hasta que el usuario cambiara de pestaña y volviera. Cuando
// termina de cargar todo, se invalida ese caché y se repinta la pestaña activa.
window.addEventListener("load", () => {
  if(typeof Chart==="undefined") return; // no llegó (sin conexión): los gráficos quedan vacíos, el resto anda
  const lock=document.getElementById("lock-screen");
  if(lock && getComputedStyle(lock).display!=="none") return; // todavía bloqueada: no hay datos en memoria
  ["dash","inv","ahorro"].forEach(p=>{ delete paginaVersionRenderizada[p]; });
  const activa=document.querySelector(".page.active");
  if(!activa) return;
  const id=activa.id.replace(/^page-/,"");
  if(id==="dash") renderDash();
  else if(id==="inv") renderInv();
  else if(id==="ahorro") renderAhorro();
});

// ═══════════════════════════════════════════
// VERSIÓN DE LA APP (diagnóstico de caché)
// ═══════════════════════════════════════════
// Muestra en Config qué versión de caché tiene activa el Service Worker.
// Sirve para diagnosticar si el celular quedó con una versión vieja.
function mostrarVersionApp(){
  const el=document.getElementById("app-version-label");
  if(!el) return;
  if(!("serviceWorker" in navigator)){
    el.textContent="Sin service worker";
    return;
  }
  navigator.serviceWorker.getRegistration().then(reg=>{
    const sw=reg && (reg.active||reg.waiting||reg.installing);
    if(!sw){ el.textContent="No instalado"; return; }
    // Pedimos la versión directo al SW vía postMessage/MessageChannel
    const canal=new MessageChannel();
    canal.port1.onmessage=(ev)=>{
      el.textContent=ev.data?.version || "desconocida";
    };
    sw.postMessage({tipo:"GET_VERSION"}, [canal.port2]);
    // Timeout por si el SW no responde
    setTimeout(()=>{ if(el.textContent==="verificando...") el.textContent="sin respuesta (probá forzar actualización)"; },1500);
  }).catch(()=>{ el.textContent="error"; });
}

// Fuerza una revisión de actualización + limpia caches viejos + recarga
async function forzarActualizacionApp(){
  showToast("Buscando actualizaciones...");
  try{
    if("serviceWorker" in navigator){
      const reg=await navigator.serviceWorker.getRegistration();
      if(reg){
        await reg.update();
        // Si hay un worker esperando, activarlo ya
        if(reg.waiting){
          reg.waiting.postMessage({tipo:"SKIP_WAITING"});
        }
      }
    }
    // Pequeña espera y recarga forzada sin caché
    setTimeout(()=>{ window.location.reload(); }, 800);
  } catch(err){
    console.warn("Error al forzar actualización:", err);
    window.location.reload();
  }
}

// ═══════════════════════════════════════════
// SERVICE WORKER (PWA)
// ═══════════════════════════════════════════
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // updateViaCache:"none" evita que el navegador use su caché HTTP normal
    // para el archivo sw.js: así SIEMPRE revisa bytes frescos del servidor
    // y detecta actualizaciones rápido (antes podía tardar horas/días en notarlo).
    navigator.serviceWorker.register("sw.js", {updateViaCache: "none"})
      .then(reg => {
        console.log("Service worker registrado:", reg.scope);
        // Forzar una revisión de actualización apenas carga la app
        reg.update();
        // Si se detecta un SW nuevo instalándose, cuando termine de activar
        // recargamos la página automáticamente para que el usuario vea los cambios ya.
        reg.addEventListener("updatefound", () => {
          const nuevoSW = reg.installing;
          if(!nuevoSW) return;
          nuevoSW.addEventListener("statechange", () => {
            if(nuevoSW.state==="installed" && navigator.serviceWorker.controller){
              // Hay una versión nueva activa: recargar para aplicarla
              window.location.reload();
            }
          });
        });
      })
      .catch(err => console.warn("Error al registrar service worker:", err));
    // Si el controller cambia (nueva versión tomó control), recargar una sola vez
    let yaRecargo=false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if(yaRecargo) return;
      yaRecargo=true;
      window.location.reload();
    });
  });
  // Pedir storage persistente para que Android no borre los datos
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(granted => {
      console.log(granted ? "Storage persistente concedido" : "Storage persistente denegado");
    });
  }
}
