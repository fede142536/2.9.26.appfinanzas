// ═══════════════════════════════════════════
// NOVEDADES: qué cambió en esta versión y dónde está
// ═══════════════════════════════════════════
// Al abrir una versión nueva, una hoja cuenta en dos o tres líneas lo nuevo desde la última que viste, con un botón "Ver" que te lleva a donde está. Antes los
// cambios llegaban sin aviso: no se sabía que existían ni dónde buscarlos. La lista es a mano (no sale del historial técnico): una entrada por versión que trae algo
// que se ve o se usa; las que solo corrigen algo interno no hace falta anotarlas. Hay un test que pide que la versión actual tenga la suya.
// Cada entrada: {v: número de versión, titulo, texto, ir: nombre de una de las acciones de NOVEDADES_IR (opcional)}.
const NOVEDADES=[
  {v:267, titulo:"Reglas automáticas", texto:"Decile a la app «si la nota dice Netflix, es Suscripciones» y lo pone sola al cargar, en la carga rápida y al importar. Te sugiere reglas según lo que ya cargaste.", ir:"reglas"},
  {v:266, titulo:"Ajustar el saldo de una cuenta", texto:"En Dashboard › Ver el año completo › Saldo por cuenta, tocá una cuenta y cargá lo que dice el banco: la app sigue el saldo y, si no coincide, registra la diferencia como ajuste.", ir:"saldoCuenta"},
  {v:265, titulo:"Nueva barra de abajo", texto:"Movimientos, Tarjetas e Inversiones a un toque, el + del medio para cargar y «Más» para el resto (Dashboard, Ahorros, Cerrar el mes, Configuración, Ayuda…). Reemplaza al menú ☰."},
  {v:264, titulo:"Secciones de a una", texto:"En Configuración y en el manual, al abrir una sección se cierra la que estaba abierta: la pantalla queda corta y ordenada."},
  {v:263, titulo:"Manual de uso", texto:"En Configuración › Ayuda y manual: cómo cargar cada movimiento y preguntas frecuentes, con un buscador y un botón que te lleva a cada pantalla.", ir:"manual"},
  {v:262, titulo:"Novedades al actualizar", texto:"Cada vez que la app se actualiza te cuenta qué hay de nuevo y dónde está. Podés volver a verlas en Configuración › General › Versión de la app."},
  {v:261, titulo:"Revisión de tus inversiones", texto:"Detecta ventas contadas casi enteras como ganancia, compras cargadas dos veces, nominales que no cierran y tickers escritos distinto, con el arreglo de cada uno.", ir:"revision"},
  {v:261, titulo:"La compra del fondo, una sola vez", texto:"Al cargar una compra, «Es de mi fondo de ahorro» crea el depósito al fondo solo (se tilda sola si el ticker ya va a un fondo).", ir:"cargarInversion"},
  {v:260, titulo:"Editar por partes", texto:"Al editar cualquier movimiento, los campos se agrupan (Datos · Fecha y cuenta · Opciones · Todo) para no recorrer un formulario larguísimo."},
  {v:259, titulo:"Inversiones de todo el año", texto:"En la card Inversiones de Movimientos, «Todo el año» muestra cómo rindió cada instrumento de enero a diciembre.", ir:"movimientos"},
  {v:258, titulo:"Una sola card de Inversiones", texto:"En Movimientos, invertido, resultado y neto van en una card; al tocarla ves cada instrumento y cómo rindió.", ir:"movimientos"},
  {v:256, titulo:"Splits y compras desde el fondo", texto:"Registrá un desdoblamiento en la hoja de cada ticker, y creá las compras que solo estaban como depósitos al fondo.", ir:"cartera"},
  {v:254, titulo:"Ticker y cantidad en el fondo", texto:"Los depósitos y retiros del fondo de ahorro guardan el ticker y cuántos nominales compraste o vendiste.", ir:"ahorros"},
  {v:253, titulo:"Completar cantidades", texto:"En Inversiones › Cartera, una pantalla para cargar de una vez las cantidades de las compras y ventas viejas.", ir:"cartera"},
  {v:251, titulo:"Tu cartera como en el broker", texto:"Nominales, precio promedio, valor inicial y, con el precio de hoy, rendimiento, días de tenencia y TNA.", ir:"cartera"},
  {v:250, titulo:"Valor actual de tus fondos", texto:"En Ahorros, cargá cuánto vale hoy un fondo y ves la ganancia sin realizar.", ir:"ahorros"},
  {v:249, titulo:"Filtros en el gasto frecuente", texto:"El editor de un gasto frecuente de tarjeta se ve por partes: Datos, Tarjeta, Fechas y Monto."}
];
const NOVEDADES_VISTA_KEY="fnovedadesvista";
const NOVEDADES_MAX=4;   // más que esto y deja de leerse: se muestran las más nuevas
const irAPagina=p=>showPage(p, document.querySelector(`.nav-btn[onclick*="'${p}'"]`));
const NOVEDADES_IR={
  revision:()=>{ irAPagina("inv"); setInvVista("cart"); abrirRevisionInversiones(); },
  cartera:()=>{ irAPagina("inv"); setInvVista("cart"); },
  movimientos:()=>irAPagina("mov"),
  ahorros:()=>irAPagina("ahorro"),
  cargarInversion:()=>{ irAPagina("cargar"); if(typeof setTipo==="function") setTipo("Inversion"); },
  manual:()=>abrirManual(),
  dashboard:()=>irAPagina("dash"),
  saldoCuenta:()=>irASaldoPorCuenta(),
  reglas:()=>irAReglas()
};
// La versión que está corriendo, del <meta name="enola-version" content="enola-v262"> (el mismo número que el caché del service worker).
function versionActualApp(){
  const m=document.querySelector('meta[name="enola-version"]');
  const n=parseInt(String(m && m.content || "").replace(/\D+/g,""),10);
  return isFinite(n) ? n : 0;
}
// Pura. Las novedades que no viste: las de versiones posteriores a `vista` y hasta `actual`, las más nuevas primero (como mucho NOVEDADES_MAX).
// Sin `vista` (nunca se mostraron): las de la versión actual.
function novedadesPendientes(vista, actual, lista){
  const desde=vista>0 ? vista : actual-1;
  return (lista||NOVEDADES).filter(n=>n.v>desde && n.v<=actual).sort((a,b)=>b.v-a.v).slice(0, NOVEDADES_MAX);
}
function novedadesHTML(items, todas){
  return items.map(n=>`<div class="nov-item">
      <div class="nov-cab"><strong>${escapeHtml(n.titulo)}</strong><span class="nov-v">v${n.v}</span></div>
      <p class="nov-txt">${escapeHtml(n.texto)}</p>
      ${n.ir && NOVEDADES_IR[n.ir] ? `<button type="button" class="btn-sm" onclick="verNovedad(${attrJS(n.ir)})">Ver</button>` : ""}
    </div>`).join("")+(todas ? "" : `<button type="button" class="nov-todas" onclick="verTodasLasNovedades()">Ver todas las novedades</button>`);
}
function abrirNovedades(items, todas){
  document.getElementById("novedades-contenido").innerHTML=novedadesHTML(items, todas);
  document.getElementById("modal-novedades").classList.add("open");
}
function cerrarNovedades(){
  document.getElementById("modal-novedades").classList.remove("open");
  guardarPreferencia(NOVEDADES_VISTA_KEY, String(versionActualApp()));
}
function verNovedad(clave){ cerrarNovedades(); try{ NOVEDADES_IR[clave](); }catch(e){ console.warn("No se pudo abrir la novedad:", e); } }
function verTodasLasNovedades(){ abrirNovedades(NOVEDADES.slice().sort((a,b)=>b.v-a.v), true); }
// Al arrancar: si hay novedades sin ver, se muestran — pero sin tapar otro aviso (backup, vencimientos, huella): si hay uno abierto, se reintenta un poco después.
// En la primera vez que se usa la app (sin datos) no se muestran: no hay nada "nuevo" para alguien que recién empieza.
const bloqueoVisible=()=>{ const l=document.getElementById("lock-screen"); return !!l && l.style.display!=="none"; };
function avisarNovedades(intento){
  const actual=versionActualApp(); if(!actual) return;
  const vista=parseInt(localStorage.getItem(NOVEDADES_VISTA_KEY)||"0",10)||0;
  if(vista>=actual) return;
  if(!movs.length && !tcs.length){ guardarPreferencia(NOVEDADES_VISTA_KEY, String(actual)); return; }
  if(document.querySelector(".modal-overlay.open") || document.querySelector("#modal-dialogo.open") || bloqueoVisible()){
    if((intento||0)<6) setTimeout(()=>avisarNovedades((intento||0)+1), 4000);
    return;
  }
  const items=novedadesPendientes(vista, actual);
  if(!items.length){ guardarPreferencia(NOVEDADES_VISTA_KEY, String(actual)); return; }
  abrirNovedades(items, false);
}
