// ═══════════════════════════════════════════
// ATAJOS DESDE EL ÍCONO DE LA APP
// ═══════════════════════════════════════════
// Manteniendo apretado el ícono de la app instalada, el celular ofrece accesos directos (manifest.json › shortcuts). Cada uno abre
// la app con ?accion=… y acá se la lleva directo a lo que pediste. Nada se guarda: solo se abre la pantalla.
//   gasto → Cargar, como gasto · ingreso → Cargar, como ingreso · rapida → Cargar, con el cursor en la carga rápida · cierre → cierre del mes

const ATAJOS_VALIDOS=["gasto","ingreso","rapida","cierre"];

// Pura. Saca la acción de un "?accion=gasto" (o cualquier otro texto de URL). Devuelve "" si no hay una acción conocida.
function accionDeUrl(search){
  try{
    const a=String(new URLSearchParams(String(search||"").replace(/^[^?]*\?/,"?")).get("accion")||"").trim().toLowerCase();
    return ATAJOS_VALIDOS.includes(a) ? a : "";
  }catch(e){ return ""; }
}

// Lleva a la pantalla del atajo. Devuelve true si hizo algo.
function ejecutarAtajo(accion){
  if(!ATAJOS_VALIDOS.includes(accion)) return false;
  if(accion==="cierre"){ abrirCierreMes(); return true; }
  abrirCarga();
  if(accion==="gasto" || accion==="ingreso") setTipo(accion==="gasto" ? "Gasto" : "Ingreso");
  const campo=document.getElementById(accion==="rapida" ? "carga-rapida" : "inp-importe");
  // Con un pequeño retraso: el teclado no sube si se enfoca mientras la pantalla todavía se está mostrando.
  if(campo) setTimeout(()=>{ try{ campo.focus(); }catch(e){ /* sin foco */ } }, 250);
  return true;
}

// Al abrir la app: si vino de un atajo, lo ejecuta. La dirección se limpia unos segundos después (no enseguida): cuando la app se
// actualiza, se recarga sola una vez, y esa recarga todavía tiene que encontrar el atajo. Limpia para que un "actualizar" posterior no lo repita.
const ATAJO_LIMPIAR_MS=6000;
function atajoAlArrancar(){
  const accion=accionDeUrl(location.search);
  if(!accion) return false;
  setTimeout(()=>{ try{ history.replaceState(null, "", location.pathname + location.hash); }catch(e){ /* sin historial */ } }, ATAJO_LIMPIAR_MS);
  return ejecutarAtajo(accion);
}
